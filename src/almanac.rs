use chrono::{DateTime, Datelike, NaiveDate, Timelike};
use chrono_tz::Tz;

use crate::astro::{moon_phase, sky_data_lines};
use crate::content::{parse_frontmatter, parse_list_items, ListItems, MoonTip, Season, SiteData};
use crate::markdown::{render_block, render_inline};
use crate::rng::{day_hash, pick_items, Mulberry32};

pub struct Assembled {
    pub date_line: String,
    pub season_name: String,
    pub season_note: String,
    pub season_key: String,
    pub time_key: String,
    pub haiku_html: String,
    pub sections_html: String,
    pub footer_text: String,
    pub season_nav_html: String,
}

struct Time {
    name: &'static str,
    start: u32,
    end: u32,
}

const TIMES: &[Time] = &[
    Time { name: "night", start: 0, end: 5 },
    Time { name: "dawn", start: 5, end: 8 },
    Time { name: "morning", start: 8, end: 12 },
    Time { name: "afternoon", start: 12, end: 17 },
    Time { name: "evening", start: 17, end: 21 },
    Time { name: "night", start: 21, end: 24 },
];

fn time_of_day(date: DateTime<Tz>) -> &'static str {
    let h = date.hour();
    for t in TIMES {
        if h >= t.start && h < t.end {
            return t.name;
        }
    }
    "night"
}

const MONTHS: [&str; 12] = [
    "january", "february", "march", "april", "may", "june", "july", "august", "september",
    "october", "november", "december",
];

const ORDINALS: [&str; 32] = [
    "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth",
    "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth",
    "seventeenth", "eighteenth", "nineteenth", "twentieth", "twenty-first", "twenty-second",
    "twenty-third", "twenty-fourth", "twenty-fifth", "twenty-sixth", "twenty-seventh",
    "twenty-eighth", "twenty-ninth", "thirtieth", "thirty-first",
];

fn written_date(date: DateTime<Tz>) -> String {
    let time = time_of_day(date);
    let day = date.day() as usize;
    let month = (date.month() - 1) as usize;
    format!("{time}, the {} of {}", ORDINALS[day], MONTHS[month])
}

fn get_season_for_date(date: DateTime<Tz>, seasons: &[Season]) -> &Season {
    let m = date.month();
    let d = date.day();
    for s in seasons {
        let after_start = m > s.start.0 || (m == s.start.0 && d >= s.start.1);
        let before_end = m < s.end.0 || (m == s.end.0 && d <= s.end.1);
        if after_start && before_end {
            return s;
        }
    }
    &seasons[0]
}

struct NextSeason {
    days: i64,
    label: String,
}

fn days_until_next_season(date: DateTime<Tz>, seasons: &[Season]) -> NextSeason {
    let current = get_season_for_date(date, seasons);
    let today = date.date_naive();
    for s in seasons {
        let s_date = NaiveDate::from_ymd_opt(date.year(), s.start.0, s.start.1).unwrap();
        if s_date > today && s.name != current.name {
            return NextSeason {
                days: (s_date - today).num_days(),
                label: s.label.clone(),
            };
        }
    }
    let first = &seasons[0];
    let next_date = NaiveDate::from_ymd_opt(date.year() + 1, first.start.0, first.start.1).unwrap();
    NextSeason {
        days: (next_date - today).num_days(),
        label: first.label.clone(),
    }
}

fn moon_garden_tip(phase: f64, tips: &[MoonTip]) -> String {
    for t in tips {
        if t.lo <= phase && phase < t.hi {
            return t.text.clone();
        }
    }
    tips.last().map(|t| t.text.clone()).unwrap_or_default()
}

fn weather_mood(season_name: &str, time: &str, moods: &std::collections::HashMap<String, std::collections::HashMap<String, String>>) -> String {
    if let Some(season_moods) = moods.get(season_name) {
        if let Some(text) = season_moods.get(time) {
            if !text.is_empty() {
                return render_inline(text);
            }
        }
    }
    String::new()
}

fn read_md_parts<'a>(path: &str, files: &'a std::collections::HashMap<String, String>) -> Option<ListItems> {
    let body = files.get(path)?;
    let parsed = parse_frontmatter(body);
    Some(parse_list_items(&parsed.body))
}

#[derive(Debug)]
struct Group {
    label: &'static str,
    items: Vec<String>,
}

#[derive(Debug)]
struct Section {
    key: &'static str,
    title: &'static str,
    intro: String,
    groups: Vec<Group>,
    lore: Vec<String>,
}

fn section_sky(now: DateTime<Tz>, season: &Season, data: &SiteData, rng: &mut Mulberry32) -> Section {
    let intro = weather_mood(&season.name, time_of_day(now), &data.moods);

    let mut lore = Vec::new();
    let tip = moon_garden_tip(moon_phase(now), &data.moon_tips);
    if !tip.is_empty() {
        lore.push(render_inline(&tip));
    }

    for path in [
        format!("sky/{}.md", season.name),
        format!("storms/{}.md", season.name),
    ] {
        let Some(items) = read_md_parts(&path, &data.files) else {
            continue;
        };
        let mut candidates: Vec<String> = items.bullets.clone();
        candidates.extend(items.prose.clone());
        if !candidates.is_empty() {
            let pick = pick_items(&candidates, 1, rng).remove(0);
            lore.push(render_inline(&pick));
        }
    }

    Section {
        key: "sky",
        title: "sky",
        intro,
        groups: vec![Group {
            label: "",
            items: sky_data_lines(now),
        }],
        lore,
    }
}

fn section_garden(season: &Season, data: &SiteData, rng: &mut Mulberry32) -> Section {
    let mut groups = Vec::new();

    if let Some(items) = read_md_parts(&format!("planting/{}.md", season.name), &data.files) {
        if !items.bullets.is_empty() {
            let n = items.bullets.len().min(4);
            let picks = pick_items(&items.bullets, n, rng);
            groups.push(Group {
                label: "in the ground now",
                items: picks.iter().map(|s| render_inline(s)).collect(),
            });
        }
    }

    if let Some(items) = read_md_parts(
        &format!("planting/{}-indoors.md", season.name),
        &data.files,
    ) {
        if !items.bullets.is_empty() {
            let n = items.bullets.len().min(3);
            let picks = pick_items(&items.bullets, n, rng);
            groups.push(Group {
                label: "starting indoors",
                items: picks.iter().map(|s| render_inline(s)).collect(),
            });
        }
    }

    if let Some(items) = read_md_parts(&format!("chores/{}.md", season.name), &data.files) {
        if !items.bullets.is_empty() {
            let n = items.bullets.len().min(2);
            let picks = pick_items(&items.bullets, n, rng);
            groups.push(Group {
                label: "this week",
                items: picks.iter().map(|s| render_inline(s)).collect(),
            });
        }
    }

    Section {
        key: "garden",
        title: "garden",
        intro: String::new(),
        groups,
        lore: Vec::new(),
    }
}

fn section_kitchen(season: &Season, data: &SiteData, rng: &mut Mulberry32) -> Section {
    let mut groups = Vec::new();

    if let Some(items) = read_md_parts(&format!("kitchen/{}.md", season.name), &data.files) {
        if !items.bullets.is_empty() {
            let bullets = items.bullets.clone();
            let n = bullets.len().min(4);
            let picks = pick_items(&bullets, n, rng);
            groups.push(Group {
                label: "in season",
                items: picks.iter().map(|s| render_inline(s)).collect(),
            });
            let remaining: Vec<String> = bullets
                .iter()
                .filter(|b| !picks.contains(b))
                .cloned()
                .collect();
            let tonight = if remaining.is_empty() {
                picks.last().cloned().unwrap_or_default()
            } else {
                pick_items(&remaining, 1, rng).remove(0)
            };
            groups.push(Group {
                label: "tonight",
                items: vec![render_inline(&tonight)],
            });
        }
    }

    if let Some(items) = read_md_parts(&format!("preserving/{}.md", season.name), &data.files) {
        if !items.bullets.is_empty() {
            let n = items.bullets.len().min(2);
            let picks = pick_items(&items.bullets, n, rng);
            groups.push(Group {
                label: "putting up",
                items: picks.iter().map(|s| render_inline(s)).collect(),
            });
        }
    }

    Section {
        key: "kitchen",
        title: "kitchen",
        intro: String::new(),
        groups,
        lore: Vec::new(),
    }
}

fn section_foraging(season: &Season, data: &SiteData, rng: &mut Mulberry32) -> Section {
    let mut groups = Vec::new();
    let mut lore = Vec::new();
    if let Some(items) = read_md_parts(&format!("foraging/{}.md", season.name), &data.files) {
        if !items.bullets.is_empty() {
            let n = items.bullets.len().min(4);
            let picks = pick_items(&items.bullets, n, rng);
            groups.push(Group {
                label: "",
                items: picks.iter().map(|s| render_inline(s)).collect(),
            });
        }
        if let Some(first) = items.prose.first() {
            lore.push(render_inline(first));
        }
    }
    Section {
        key: "foraging",
        title: "foraging",
        intro: String::new(),
        groups,
        lore,
    }
}

fn section_folklore(season: &Season, data: &SiteData, rng: &mut Mulberry32) -> Section {
    let mut lore = Vec::new();

    if let Some(items) = read_md_parts(&format!("names/{}.md", season.name), &data.files) {
        if let Some(first) = items.prose.first() {
            lore.push(render_inline(first));
        } else if !items.bullets.is_empty() {
            let n = items.bullets.len().min(2);
            let picks = pick_items(&items.bullets, n, rng);
            let joined: Vec<String> = picks.iter().map(|s| render_inline(s)).collect();
            lore.push(joined.join(" "));
        }
    }

    if let Some(items) = read_md_parts(&format!("remedies/{}.md", season.name), &data.files) {
        let mut parts = Vec::new();
        if !items.bullets.is_empty() {
            let pick = pick_items(&items.bullets, 1, rng).remove(0);
            parts.push(render_inline(&pick));
        }
        if let Some(first) = items.prose.first() {
            parts.push(render_inline(first));
        }
        if !parts.is_empty() {
            lore.push(parts.join(" "));
        }
    }

    if let Some(items) = read_md_parts(&format!("bugs/{}.md", season.name), &data.files) {
        if !items.bullets.is_empty() {
            let pick = pick_items(&items.bullets, 1, rng).remove(0);
            lore.push(render_inline(&pick));
        }
    }

    Section {
        key: "folklore",
        title: "folklore",
        intro: String::new(),
        groups: Vec::new(),
        lore,
    }
}

fn render_sections_html(sections: &[Section]) -> String {
    let mut out = String::new();
    for s in sections {
        if s.groups.is_empty() && s.lore.is_empty() && s.intro.is_empty() {
            continue;
        }
        out.push_str(&format!("<section class=\"bucket bucket-{}\">", s.key));
        out.push_str(&format!("<h2>{}</h2>", s.title));
        if !s.intro.is_empty() {
            out.push_str(&format!("<p class=\"bucket-intro\">{}</p>", s.intro));
        }
        for g in &s.groups {
            if !g.label.is_empty() {
                out.push_str(&format!("<p class=\"bucket-label\">{}</p>", g.label));
            }
            out.push_str("<ul class=\"bucket-list\">");
            for item in &g.items {
                out.push_str(&format!("<li>{item}</li>"));
            }
            out.push_str("</ul>");
        }
        for line in &s.lore {
            out.push_str(&format!("<p class=\"bucket-lore\">{line}</p>"));
        }
        out.push_str("</section>");
    }
    out
}

fn build_season_nav(active: &Season, data: &SiteData) -> String {
    let mut out = String::new();
    for name in &data.seasons_order {
        let s = &data.seasons_by_name[name];
        let cls = if s.name == active.name {
            " class=\"active\" aria-current=\"true\""
        } else {
            ""
        };
        out.push_str(&format!(
            "<a data-season=\"{}\"{cls}>{}</a>",
            s.name, s.label
        ));
    }
    out
}

fn get_haiku<'a>(season_name: &str, date: DateTime<Tz>, data: &'a SiteData) -> Option<&'a [String; 3]> {
    let poems = data.haiku.get(season_name)?;
    if poems.is_empty() {
        return None;
    }
    let doy = date.ordinal() as usize;
    Some(&poems[doy % poems.len()])
}

pub fn assemble_content(now: DateTime<Tz>, data: &SiteData, season_override: Option<&str>) -> Assembled {
    let season = match season_override.and_then(|n| data.seasons_by_name.get(n)) {
        Some(s) => s.clone(),
        None => get_season_for_date(now, &data.seasons).clone(),
    };

    let real_time = time_of_day(now);

    let mut note_html = render_block(&season.note);
    let nxt = days_until_next_season(now, &data.seasons);
    if nxt.days <= 7 {
        let unit = if nxt.days == 1 { "day" } else { "days" };
        note_html.push_str(&format!("<p>{} begins in {} {unit}.</p>", nxt.label, nxt.days));
    }

    let haiku_html = match get_haiku(&season.name, now, data) {
        Some(lines) => lines
            .iter()
            .map(|l| format!("<span class=\"haiku-line\">{l}</span>"))
            .collect::<Vec<_>>()
            .join(""),
        None => String::new(),
    };

    let mut rng = Mulberry32::new(day_hash(now));
    let sky = section_sky(now, &season, data, &mut rng);
    let garden = section_garden(&season, data, &mut rng);
    let kitchen = section_kitchen(&season, data, &mut rng);
    let foraging = section_foraging(&season, data, &mut rng);
    let folklore = section_folklore(&season, data, &mut rng);
    let sections = vec![sky, garden, kitchen, foraging, folklore];
    let sections_html = render_sections_html(&sections);

    let footer_text = format!(
        "{} days until {} \u{00b7} zone 7a \u{00b7} north carolina",
        nxt.days, nxt.label
    );

    Assembled {
        date_line: written_date(now),
        season_name: season.label.clone(),
        season_note: note_html,
        season_key: season.name.clone(),
        time_key: real_time.to_string(),
        haiku_html,
        sections_html,
        footer_text,
        season_nav_html: build_season_nav(&season, data),
    }
}

