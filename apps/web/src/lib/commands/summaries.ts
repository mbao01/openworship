/**
 * @module commands/summaries
 *
 * Tauri command wrappers for AI-generated service summaries and
 * the email newsletter subscriber list.
 *
 * Summaries are generated via the Anthropic API (Claude) after a service
 * ends and can be dispatched to a mailing list via configured SMTP.
 */

import { z } from "zod";
import { invoke } from "../tauri";
import { invokeValidated } from "../validated-invoke";
import { EmailSubscriberSchema, ServiceSummarySchema } from "../schemas";
import type { EmailSubscriber, ServiceSummary } from "../types";

// ─── Service Summaries ────────────────────────────────────────────────────────

/**
 * Triggers asynchronous AI summary generation for a completed service project.
 * Listen to backend events for completion notification.
 */
export async function generateServiceSummary(projectId: string): Promise<void> {
  return invoke("generate_service_summary", { projectId });
}

/**
 * Returns all previously generated service summaries, newest first.
 */
export async function listServiceSummaries(): Promise<ServiceSummary[]> {
  return invokeValidated(
    "list_service_summaries",
    z.array(ServiceSummarySchema),
  );
}

/**
 * Permanently deletes a service summary.
 */
export async function deleteServiceSummary(summaryId: string): Promise<void> {
  return invoke("delete_service_summary", { summaryId });
}

/**
 * Dispatches a generated summary to all configured email subscribers.
 * Requires SMTP settings to be configured.
 */
export async function sendSummaryEmail(summaryId: string): Promise<void> {
  return invoke("send_summary_email", { summaryId });
}

// ─── Email Subscribers ────────────────────────────────────────────────────────

/**
 * Returns all email newsletter subscribers for this church.
 */
export async function listEmailSubscribers(): Promise<EmailSubscriber[]> {
  return invokeValidated(
    "list_email_subscribers",
    z.array(EmailSubscriberSchema),
  );
}

/**
 * Adds a new subscriber to the newsletter mailing list.
 */
export async function addEmailSubscriber(
  email: string,
  name?: string,
): Promise<EmailSubscriber> {
  return invokeValidated("add_email_subscriber", EmailSubscriberSchema, {
    email,
    name,
  });
}

/**
 * Removes a subscriber from the mailing list.
 */
export async function removeEmailSubscriber(
  subscriberId: string,
): Promise<void> {
  return invoke("remove_email_subscriber", { subscriberId });
}

/**
 * Sends a test email to the given address to verify SMTP configuration.
 */
export async function sendTestEmail(toEmail: string): Promise<void> {
  return invoke("send_test_email", { toEmail });
}
