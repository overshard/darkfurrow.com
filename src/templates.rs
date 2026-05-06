use minijinja::{path_loader, AutoEscape, Environment, Error, Output, State};
use minijinja::value::Value;
use serde_json::Value as JsonValue;
use std::path::Path;

/// Custom formatter that matches Jinja2's HTML escape (does NOT escape `/`).
/// Without this, minijinja escapes `/` in URLs as `&#x2f;` which is ugly even
/// though browsers parse it the same.
fn jinja2_html_formatter(out: &mut Output, state: &State, value: &Value) -> Result<(), Error> {
    if value.is_safe() {
        write!(out, "{value}").map_err(Error::from)?;
        return Ok(());
    }
    let auto_escape = match state.auto_escape() {
        AutoEscape::Html => true,
        AutoEscape::None => false,
        _ => return minijinja::escape_formatter(out, state, value),
    };
    if !auto_escape {
        write!(out, "{value}").map_err(Error::from)?;
        return Ok(());
    }
    if let Some(s) = value.as_str() {
        write_jinja2_html(out, s).map_err(Error::from)?;
    } else if value.is_undefined() || value.is_none() {
        // emit nothing
    } else {
        let stringified = value.to_string();
        write_jinja2_html(out, &stringified).map_err(Error::from)?;
    }
    Ok(())
}

fn write_jinja2_html(out: &mut Output, s: &str) -> std::fmt::Result {
    let mut last = 0;
    for (i, b) in s.bytes().enumerate() {
        let escape = match b {
            b'&' => "&amp;",
            b'<' => "&lt;",
            b'>' => "&gt;",
            b'"' => "&#34;",
            b'\'' => "&#39;",
            _ => continue,
        };
        if last < i {
            out.write_str(&s[last..i])?;
        }
        out.write_str(escape)?;
        last = i + 1;
    }
    if last < s.len() {
        out.write_str(&s[last..])?;
    }
    Ok(())
}

fn read_manifest(path: &Path) -> JsonValue {
    let text = std::fs::read_to_string(path).unwrap_or_else(|_| "{}".to_string());
    serde_json::from_str(&text).unwrap_or(JsonValue::Null)
}

fn lookup_asset(manifest: &JsonValue, entry: &str, kind: &str) -> String {
    if let Some(chunk) = manifest.get(entry) {
        if kind == "css" {
            if let Some(css_arr) = chunk.get("css").and_then(|v| v.as_array()) {
                if let Some(first) = css_arr.first().and_then(|v| v.as_str()) {
                    return format!("/static/{first}");
                }
            }
        }
        if let Some(file) = chunk.get("file").and_then(|v| v.as_str()) {
            return format!("/static/{file}");
        }
    }
    format!("/static/{entry}")
}

pub fn build_env(templates_dir: &Path, manifest_path: &Path) -> Environment<'static> {
    let mut env = Environment::new();
    env.set_loader(path_loader(templates_dir));
    env.set_formatter(jinja2_html_formatter);

    // Vite manifest:
    // - debug builds re-read on every call so Vite watcher rebuilds show up
    //   immediately
    // - release builds load once at startup and reuse the cached value
    #[cfg(debug_assertions)]
    {
        let path = manifest_path.to_path_buf();
        env.add_function(
            "vite_asset",
            move |entry: String, kind: Option<String>| -> Result<String, Error> {
                let kind = kind.unwrap_or_else(|| "file".to_string());
                let manifest = read_manifest(&path);
                Ok(lookup_asset(&manifest, &entry, &kind))
            },
        );
    }
    #[cfg(not(debug_assertions))]
    {
        let manifest = read_manifest(manifest_path);
        env.add_function(
            "vite_asset",
            move |entry: String, kind: Option<String>| -> Result<String, Error> {
                let kind = kind.unwrap_or_else(|| "file".to_string());
                Ok(lookup_asset(&manifest, &entry, &kind))
            },
        );
    }

    env
}
