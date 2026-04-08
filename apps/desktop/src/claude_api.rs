//! Anthropic Claude API integration for service summary generation.
//!
//! Uses the claude-sonnet-4-6 model via the Messages API.
//! The API key is stored in the system keychain via the `keychain` module.

use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};

use crate::service::ServiceProject;

const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL: &str = "claude-sonnet-4-6";
const ANTHROPIC_VERSION: &str = "2023-06-01";

// ─── Request / Response types (subset of Anthropic Messages API) ──────────────

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ClaudeMessage>,
}

#[derive(Serialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
}

#[derive(Deserialize)]
struct ClaudeContent {
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
}

// ─── Public API ───────────────────────────────────────────────────────────────

/// Generate a markdown-formatted service summary using Claude.
///
/// Returns the summary text, or an error if the API call fails.
pub async fn generate_summary(
    api_key: &str,
    project: &ServiceProject,
) -> Result<String> {
    if api_key.is_empty() {
        bail!("Anthropic API key is not set");
    }

    let prompt = build_prompt(project);

    let request = ClaudeRequest {
        model: CLAUDE_MODEL.into(),
        max_tokens: 1024,
        messages: vec![ClaudeMessage {
            role: "user".into(),
            content: prompt,
        }],
    };

    let client = reqwest::Client::new();
    let response = client
        .post(CLAUDE_API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        bail!("Claude API returned {status}: {body}");
    }

    let resp: ClaudeResponse = response.json().await?;
    let text = resp
        .content
        .into_iter()
        .find(|c| c.content_type == "text")
        .and_then(|c| c.text)
        .unwrap_or_default();

    if text.is_empty() {
        bail!("Claude returned an empty response");
    }

    Ok(text)
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

fn build_prompt(project: &ServiceProject) -> String {
    let mut parts: Vec<String> = Vec::new();

    parts.push(format!(
        "You are writing a concise worship service summary for a church congregation newsletter.\n\
         Service name: **{}**\n",
        project.name
    ));

    if project.items.is_empty() {
        parts.push(
            "No content was recorded for this service.\n\
             Please write a brief note that the service occurred but no content details were captured."
                .into(),
        );
    } else {
        parts.push("The following scriptures and content were presented during the service:\n".into());
        for item in &project.items {
            parts.push(format!("- {} ({}): {}", item.reference, item.translation, item.text));
        }
    }

    parts.push(
        "\nPlease write a warm, concise summary (2–4 paragraphs) that:\n\
         1. Names the scriptures and songs featured\n\
         2. Identifies 2–3 key themes from the content\n\
         3. Ends with an encouraging closing sentence\n\
         \n\
         Format the output as clean Markdown with bold headers where appropriate.\n\
         Keep the tone reverent, warm, and accessible to a general congregation."
            .into(),
    );

    parts.join("\n")
}
