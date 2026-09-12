import "server-only";

import { serverEnv } from "@/lib/env";

export type Attachment = {
  filename: string;
  /** Base64, without a data: prefix. */
  content: string;
  contentType?: string;
};

export type MailMessage = {
  to: string;
  subject: string;
  /** Plain text. The HTML part is derived from it. */
  text: string;
  replyTo?: string | null;
  bcc?: string | null;
  attachments?: Attachment[];
};

export type MailResult =
  | { ok: true; id: string | null; delivered: boolean }
  | { ok: false; message: string };

/**
 * Outbound mail, over Resend's HTTP API.
 *
 * HTTP rather than SMTP deliberately: this runs on serverless functions where
 * a long-lived socket is a liability, and the whole transport is one fetch with
 * no dependency to keep current.
 *
 * With no API key configured the message is logged and reported as sent but
 * *not* delivered. That keeps local development and preview deploys working
 * without a mail provider, and the `delivered` flag means the caller can tell
 * the operator the truth rather than claiming an email went out.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const env = serverEnv();
  const from = env.MAIL_FROM;

  if (!env.RESEND_API_KEY || !from) {
    console.info(
      `[mail] not configured — would send to ${message.to}: ${message.subject}`,
    );
    return { ok: true, id: null, delivered: false };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        ...(message.bcc ? { bcc: [message.bcc] } : {}),
        ...(message.replyTo ? { reply_to: [message.replyTo] } : {}),
        subject: message.subject,
        text: message.text,
        html: textToHtml(message.text),
        ...(message.attachments?.length
          ? {
              attachments: message.attachments.map((file) => ({
                filename: file.filename,
                content: file.content,
                ...(file.contentType ? { content_type: file.contentType } : {}),
              })),
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[mail] provider rejected the message", detail);
      return {
        ok: false,
        message:
          response.status === 403
            ? "The mail provider rejected the From address. Verify the domain first."
            : "The mail provider rejected the message.",
      };
    }

    const body = (await response.json()) as { id?: string };
    return { ok: true, id: body.id ?? null, delivered: true };
  } catch (error) {
    console.error("[mail] send failed", error);
    return { ok: false, message: "The email could not be sent." };
  }
}

/** Whether a real provider is wired up, for telling the operator what happened. */
export function mailConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/**
 * The templates an operator writes are plain text, so the HTML part is derived
 * rather than authored. Escaped first, then linkified — doing it the other way
 * round would escape the anchors we just inserted.
 */
function textToHtml(text: string): string {
  const escaped = text.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char);

  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#12a594">$1</a>',
  );

  return [
    '<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1c1c1e">',
    linked
      .split(/\n{2,}/)
      .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
      .join(""),
    "</div>",
  ].join("");
}
