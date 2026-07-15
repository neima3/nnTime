/**
 * Optional Resend transport. When RESEND_API_KEY is unset, callers should
 * fall back to console logging (dev) without failing auth flows.
 */
import "server-only";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }
  const from =
    process.env.EMAIL_FROM ?? "Kairo <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      html: opts.html ?? `<p>${opts.text.replace(/\n/g, "<br/>")}</p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[email] Resend failed:", res.status, body.slice(0, 200));
    return { sent: false, reason: `resend ${res.status}` };
  }
  return { sent: true };
}
