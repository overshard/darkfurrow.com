use anyhow::{Context, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct Frontmatter {
    pub meta: HashMap<String, String>,
    pub body: String,
}

#[derive(Debug, Default)]
pub struct ListItems {
    pub bullets: Vec<String>,
    pub prose: Vec<String>,
}

pub fn parse_frontmatter(text: &str) -> Frontmatter {
    if let Some(rest) = text.strip_prefix("---\n") {
        if let Some(end) = rest.find("\n---\n") {
            let meta_str = &rest[..end];
            let body = &rest[end + 5..];
            let mut meta = HashMap::new();
            for line in meta_str.split('\n') {
                if let Some((k, v)) = line.split_once(':') {
                    meta.insert(k.trim().to_string(), v.trim().to_string());
                }
            }
            return Frontmatter {
                meta,
                body: body.trim().to_string(),
            };
        }
    }
    Frontmatter {
        meta: HashMap::new(),
        body: text.to_string(),
    }
}

/// Walk lines, splitting `- ` bullets from free-form prose paragraphs.
/// Mirrors python `parse_list_items` exactly.
pub fn parse_list_items(body: &str) -> ListItems {
    let mut bullets = Vec::new();
    let mut prose = Vec::new();
    let mut in_prose = false;
    let mut current = String::new();

    for line in body.split('\n') {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("- ") {
            if in_prose && !current.is_empty() {
                prose.push(std::mem::take(&mut current).trim().to_string());
                in_prose = false;
            }
            bullets.push(rest.to_string());
        } else if trimmed.is_empty() {
            if in_prose && !current.is_empty() {
                prose.push(std::mem::take(&mut current).trim().to_string());
                in_prose = false;
            }
        } else {
            in_prose = true;
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(trimmed);
        }
    }

    if in_prose && !current.is_empty() {
        prose.push(current.trim().to_string());
    }

    ListItems { bullets, prose }
}

#[derive(Debug, Clone)]
pub struct Season {
    pub name: String,
    pub label: String,
    pub start: (u32, u32),
    pub end: (u32, u32),
    pub note: String,
}

#[derive(Debug, Clone)]
pub struct MoonTip {
    pub lo: f64,
    pub hi: f64,
    pub text: String,
}

#[derive(Deserialize, Debug)]
pub struct ManifestEntry {
    pub path: String,
}

pub struct SiteData {
    pub files: HashMap<String, String>,
    pub seasons: Vec<Season>,
    /// canonical-order map (insertion order preserved) so the nav reads
    /// winter -> early spring -> ... -> late fall.
    pub seasons_order: Vec<String>,
    pub seasons_by_name: HashMap<String, Season>,
    pub haiku: HashMap<String, Vec<[String; 3]>>,
    pub moods: HashMap<String, HashMap<String, String>>,
    pub moon_tips: Vec<MoonTip>,
}

fn parse_md_date(s: &str) -> Result<(u32, u32)> {
    let (m, d) = s.split_once('/').context("expected m/d")?;
    Ok((m.parse()?, d.parse()?))
}

pub fn load_data(data_dir: &Path) -> Result<SiteData> {
    let manifest_path = data_dir.join("manifest.json");
    let manifest_text = std::fs::read_to_string(&manifest_path)
        .with_context(|| format!("read manifest: {manifest_path:?}"))?;
    let manifest: Vec<ManifestEntry> = serde_json::from_str(&manifest_text)?;

    let mut files = HashMap::new();
    for entry in &manifest {
        let p = data_dir.join(&entry.path);
        if let Ok(text) = std::fs::read_to_string(&p) {
            files.insert(entry.path.clone(), text);
        }
    }

    let (seasons, seasons_order, seasons_by_name) = load_seasons(data_dir)?;
    let haiku = load_haiku(data_dir)?;
    let moods = load_moods(data_dir)?;
    let moon_tips = load_moon_tips(data_dir)?;

    Ok(SiteData {
        files,
        seasons,
        seasons_order,
        seasons_by_name,
        haiku,
        moods,
        moon_tips,
    })
}

fn load_seasons(
    data_dir: &Path,
) -> Result<(Vec<Season>, Vec<String>, HashMap<String, Season>)> {
    let dir = data_dir.join("seasons");
    let mut entries: Vec<_> = std::fs::read_dir(&dir)?
        .filter_map(Result::ok)
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("md"))
        .collect();
    entries.sort_by_key(|e| e.file_name());

    let mut seasons: Vec<Season> = Vec::new();
    for entry in entries {
        let text = std::fs::read_to_string(entry.path())?;
        let parsed = parse_frontmatter(&text);
        let name = parsed
            .meta
            .get("name")
            .cloned()
            .context("season missing name")?;
        let label = parsed
            .meta
            .get("label")
            .cloned()
            .context("season missing label")?;
        let start = parse_md_date(parsed.meta.get("start").context("season missing start")?)?;
        let end = parse_md_date(parsed.meta.get("end").context("season missing end")?)?;
        let note = parsed.body.trim().to_string();

        seasons.push(Season {
            name: name.clone(),
            label: label.clone(),
            start,
            end,
            note: note.clone(),
        });

        if let (Some(sa), Some(ea)) = (parsed.meta.get("start-alt"), parsed.meta.get("end-alt")) {
            seasons.push(Season {
                name,
                label,
                start: parse_md_date(sa)?,
                end: parse_md_date(ea)?,
                note,
            });
        }
    }

    seasons.sort_by_key(|s| (s.start.0, s.start.1));

    let mut seasons_order = Vec::new();
    let mut seasons_by_name: HashMap<String, Season> = HashMap::new();
    for s in &seasons {
        if !seasons_by_name.contains_key(&s.name) {
            seasons_order.push(s.name.clone());
            seasons_by_name.insert(s.name.clone(), s.clone());
        }
    }

    Ok((seasons, seasons_order, seasons_by_name))
}

fn load_haiku(data_dir: &Path) -> Result<HashMap<String, Vec<[String; 3]>>> {
    let dir = data_dir.join("haiku");
    let mut out: HashMap<String, Vec<[String; 3]>> = HashMap::new();
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let text = std::fs::read_to_string(entry.path())?;
        let parsed = parse_frontmatter(&text);
        let season = parsed
            .meta
            .get("season")
            .cloned()
            .context("haiku missing season")?;
        let mut poems = Vec::new();
        for block in parsed.body.split("---") {
            let lines: Vec<String> = block
                .trim()
                .split('\n')
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect();
            if lines.len() == 3 {
                poems.push([lines[0].clone(), lines[1].clone(), lines[2].clone()]);
            }
        }
        out.insert(season, poems);
    }
    Ok(out)
}

fn load_moods(data_dir: &Path) -> Result<HashMap<String, HashMap<String, String>>> {
    let dir = data_dir.join("moods");
    let mut out: HashMap<String, HashMap<String, String>> = HashMap::new();
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let text = std::fs::read_to_string(entry.path())?;
        let parsed = parse_frontmatter(&text);
        let season = parsed
            .meta
            .get("season")
            .cloned()
            .context("mood missing season")?;
        let mut by_time = HashMap::new();
        for line in parsed.body.split('\n') {
            let line = line.trim();
            if let Some(rest) = line.strip_prefix("- ") {
                if let Some((time, mood)) = rest.split_once(':') {
                    by_time.insert(time.trim().to_string(), mood.trim().to_string());
                }
            }
        }
        out.insert(season, by_time);
    }
    Ok(out)
}

fn load_moon_tips(data_dir: &Path) -> Result<Vec<MoonTip>> {
    let path = data_dir.join("moon-tips.md");
    let text = std::fs::read_to_string(&path)?;
    let parsed = parse_frontmatter(&text);
    let mut tips = Vec::new();
    for line in parsed.body.split('\n') {
        let line = line.trim();
        let Some(rest) = line.strip_prefix("- ") else {
            continue;
        };
        let Some((range_str, tip_text)) = rest.split_once(':') else {
            continue;
        };
        let Some((lo, hi)) = range_str.trim().split_once('-') else {
            continue;
        };
        tips.push(MoonTip {
            lo: lo.parse()?,
            hi: hi.parse()?,
            text: tip_text.trim().to_string(),
        });
    }
    Ok(tips)
}
