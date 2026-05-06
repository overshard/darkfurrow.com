use comrak::{markdown_to_html, ComrakOptions};

fn options() -> ComrakOptions {
    let mut opts = ComrakOptions::default();
    opts.render.unsafe_ = true;
    opts
}

/// render markdown, then strip the single wrapping `<p>...</p>` if there's
/// exactly one. matches `render_md` in the original almanac.py.
pub fn render_inline(text: &str) -> String {
    let html = markdown_to_html(text, &options()).trim().to_string();
    if html.starts_with("<p>") && html.ends_with("</p>") && count_substr(&html, "<p>") == 1 {
        html[3..html.len() - 4].to_string()
    } else {
        html
    }
}

/// render markdown keeping block-level tags. matches `render_md_block`.
pub fn render_block(text: &str) -> String {
    markdown_to_html(text, &options()).trim().to_string()
}

fn count_substr(s: &str, needle: &str) -> usize {
    s.matches(needle).count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inline_strips_single_p() {
        assert_eq!(render_inline("simple text"), "simple text");
    }

    #[test]
    fn inline_keeps_bold() {
        assert_eq!(
            render_inline("**plant leafy things**: lettuce"),
            "<strong>plant leafy things</strong>: lettuce"
        );
    }

    #[test]
    fn block_keeps_paragraphs() {
        let out = render_block("paragraph one\n\nparagraph two");
        assert_eq!(out, "<p>paragraph one</p>\n<p>paragraph two</p>");
    }
}
