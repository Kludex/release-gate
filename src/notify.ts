import { type AuditEntry, audit } from "@/db/audit";
import { getPolicy } from "@/db/repos";
import { type ApprovalRequest, getRequest } from "@/db/requests";
import type { Env } from "@/env";

export const WEBHOOK_URL =
  /^https:\/\/(?:hooks\.slack\.com\/services\/[A-Za-z0-9/]+|(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+)$/;

type Action =
  | "request.pending"
  | "callback.delivered"
  | "callback.failed"
  | "policy.updated"
  | "invite.created"
  | "invite.accepted"
  | "approver.removed";
type Alert = AuditEntry & { repo: string; action: Action };
type Message = (entry: Alert, request: ApprovalRequest) => string;

const release: (r: ApprovalRequest) => string = (r) =>
  `${r.repo_full_name}: ${r.ref} to ${r.environment}`;

const MESSAGES: Record<Action, Message> = {
  "request.pending": (_, r) =>
    `${release(r)} is waiting for approval. Started by @${r.sender_login}.`,
  "callback.delivered": (_, r) => `${release(r)} - ${r.status_reason}.`,
  "callback.failed": (e, r) =>
    `${release(r)} was ${e.details?.state}, but GitHub did not get the decision. An admin can retry it.`,
  "policy.updated": (e) => `${e.repo}: @${e.actor?.login} changed the policy.`,
  "invite.created": (e) =>
    `${e.repo}: @${e.actor?.login} invited @${e.details?.login} as ${e.details?.role}.`,
  "invite.accepted": (e) => `${e.repo}: @${e.actor?.login} joined as ${e.details?.role}.`,
  "approver.removed": (e) => `${e.repo}: @${e.actor?.login} removed an approver.`,
};

/** Records `entry` in the audit log, and posts it to the repository's Slack or Discord webhook. */
export async function alert(env: Env, entry: Alert): Promise<void> {
  await audit(env.DB, entry);
  const url = (await getPolicy(env.DB, entry.repo))?.notify_url;
  if (!url) return;
  const request = entry.requestId ? await getRequest(env.DB, entry.requestId) : null;
  const link = request
    ? `${env.PUBLIC_ORIGIN}/requests/${request.id}`
    : `${env.PUBLIC_ORIGIN}/admin/${entry.repo}`;
  try {
    await post(url, MESSAGES[entry.action](entry, request as ApprovalRequest), link);
  } catch (error) {
    await audit(env.DB, {
      action: "notification.failed",
      repo: entry.repo,
      details: { error: String(error) },
    });
  }
}

/** Posts `text` and `link` to a Slack or Discord webhook. Throws when the webhook refuses it. */
export async function post(url: string, text: string, link: string): Promise<void> {
  // Refs and logins come from whoever pushed, so neither network may render them as markup or pings.
  const body = url.startsWith("https://hooks.slack.com/")
    ? {
        text: `${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}\n${link}`,
      }
    : {
        content: `${text.replace(/[\\*_~`|[\]()<>#]/g, "\\$&")}\n${link}`,
        allowed_mentions: { parse: [] },
      };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`the webhook returned HTTP ${response.status}`);
}
