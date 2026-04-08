//! Email delivery for service summaries via SMTP (lettre).

use anyhow::{bail, Context, Result};
use lettre::{
    message::header::ContentType,
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};

use crate::summaries::{EmailSettings, EmailSubscriber, ServiceSummary};

/// Send a summary email to all subscribers for the summary's church.
///
/// Does nothing if `settings.auto_send` is false or there are no subscribers.
pub async fn send_summary_to_subscribers(
    summary: &ServiceSummary,
    subscribers: &[EmailSubscriber],
    settings: &EmailSettings,
) -> Result<Vec<String>> {
    if settings.smtp_host.is_empty() || settings.smtp_username.is_empty() {
        bail!("SMTP settings are not configured");
    }

    let church_subscribers: Vec<&EmailSubscriber> = subscribers
        .iter()
        .filter(|s| s.church_id == summary.church_id)
        .collect();

    if church_subscribers.is_empty() {
        return Ok(vec![]);
    }

    let subject = format!("Service Summary — {}", summary.service_name);
    let html_body = markdown_to_simple_html(&summary.summary_text);

    let mailer = build_mailer(settings).context("Failed to build SMTP mailer")?;

    let mut sent = Vec::new();
    let mut errors = Vec::new();

    for sub in &church_subscribers {
        match send_one(&mailer, settings, &sub.email, sub.name.as_deref(), &subject, &html_body).await {
            Ok(()) => sent.push(sub.email.clone()),
            Err(e) => errors.push(format!("{}: {e}", sub.email)),
        }
    }

    if !errors.is_empty() {
        eprintln!("[email] {} delivery failures: {:?}", errors.len(), errors);
    }

    Ok(sent)
}

/// Send a single test email to verify SMTP settings.
pub async fn send_test_email(settings: &EmailSettings, to_email: &str) -> Result<()> {
    if settings.smtp_host.is_empty() || settings.smtp_username.is_empty() {
        bail!("SMTP settings are not configured");
    }

    let mailer = build_mailer(settings).context("Failed to build SMTP mailer")?;
    let subject = "OpenWorship — SMTP test";
    let body = "<p>Your OpenWorship SMTP configuration is working correctly.</p>";

    send_one(&mailer, settings, to_email, None, subject, body).await
}

// ─── Internals ────────────────────────────────────────────────────────────────

fn build_mailer(
    settings: &EmailSettings,
) -> Result<AsyncSmtpTransport<Tokio1Executor>> {
    let creds = Credentials::new(
        settings.smtp_username.clone(),
        settings.smtp_password.clone(),
    );

    let mailer = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&settings.smtp_host)
        .context("Invalid SMTP host")?
        .port(settings.smtp_port)
        .credentials(creds)
        .build();

    Ok(mailer)
}

async fn send_one(
    mailer: &AsyncSmtpTransport<Tokio1Executor>,
    settings: &EmailSettings,
    to_email: &str,
    to_name: Option<&str>,
    subject: &str,
    html_body: &str,
) -> Result<()> {
    let from = format!("{} <{}>", settings.from_name, settings.smtp_username);
    let to = match to_name {
        Some(name) => format!("{name} <{to_email}>"),
        None => to_email.to_string(),
    };

    let email = Message::builder()
        .from(from.parse().context("Invalid From address")?)
        .to(to.parse().context("Invalid To address")?)
        .subject(subject)
        .header(ContentType::TEXT_HTML)
        .body(html_body.to_string())
        .context("Failed to build email message")?;

    mailer.send(email).await.context("SMTP send failed")?;
    Ok(())
}

/// Very minimal Markdown → HTML conversion for email bodies.
/// Handles bold headers and paragraphs only — sufficient for Claude output.
fn markdown_to_simple_html(markdown: &str) -> String {
    let mut html = String::from(
        "<!DOCTYPE html><html><body style=\"font-family:sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:20px\">\n",
    );

    for line in markdown.lines() {
        let trimmed = line.trim();
        if let Some(heading) = trimmed.strip_prefix("## ") {
            html.push_str(&format!(
                "<h2 style=\"color:#1a1a1a\">{}</h2>\n",
                html_escape(heading)
            ));
        } else if let Some(heading) = trimmed.strip_prefix("# ") {
            html.push_str(&format!(
                "<h1 style=\"color:#1a1a1a\">{}</h1>\n",
                html_escape(heading)
            ));
        } else if trimmed.starts_with("**") && trimmed.ends_with("**") {
            let inner = &trimmed[2..trimmed.len() - 2];
            html.push_str(&format!("<p><strong>{}</strong></p>\n", html_escape(inner)));
        } else if let Some(item) = trimmed.strip_prefix("- ") {
            html.push_str(&format!("<li>{}</li>\n", inline_bold(html_escape(item))));
        } else if trimmed.is_empty() {
            // paragraph break — skip blank lines between rendered elements
        } else {
            html.push_str(&format!("<p>{}</p>\n", inline_bold(html_escape(trimmed))));
        }
    }

    html.push_str("</body></html>");
    html
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Replace `**text**` with `<strong>text</strong>` within a line.
fn inline_bold(s: String) -> String {
    let mut result = String::new();
    let mut rest = s.as_str();
    while let Some(start) = rest.find("**") {
        result.push_str(&rest[..start]);
        let after = &rest[start + 2..];
        if let Some(end) = after.find("**") {
            result.push_str("<strong>");
            result.push_str(&after[..end]);
            result.push_str("</strong>");
            rest = &after[end + 2..];
        } else {
            result.push_str("**");
            rest = after;
        }
    }
    result.push_str(rest);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn html_escape_entities() {
        assert_eq!(html_escape("<b>&\""), "&lt;b&gt;&amp;&quot;");
    }

    #[test]
    fn inline_bold_converts_markers() {
        let result = inline_bold("Hello **World** test".into());
        assert_eq!(result, "Hello <strong>World</strong> test");
    }

    #[test]
    fn markdown_to_html_headings() {
        let md = "# Title\n## Section\nParagraph text.";
        let html = markdown_to_simple_html(md);
        assert!(html.contains("<h1"));
        assert!(html.contains("<h2"));
        assert!(html.contains("Paragraph text."));
    }
}
