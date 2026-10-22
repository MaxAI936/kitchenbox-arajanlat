import { env } from "./config";
import type { Quote } from "./store";
import { createAttachmentUrl } from "./attachments";
export async function sendEmail(q: Quote): Promise<string> {
  if (env("EMAIL_PROVIDER") !== "resend") return sendGhlEmail(q);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `kitchenbox/${q.id}`,
    },
    body: JSON.stringify({
      from: env("EMAIL_FROM"),
      to: [q.contact.email],
      subject: `Kitchen Box árajánlat - ${q.id}`,
      text: `Kedves ${q.contact.name}!\n\nCsatolva küldjük személyre szabott Kitchen Box ajánlatát.\n\nÜdvözlettel,\n${q.config.seller.name}`,
      attachments: [{ filename: `${q.id}.pdf`, content: q.pdf }],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("Nem igazolt küldés.");
  const data = await r.json();
  if (!data.id) throw new Error("Hiányzó küldési azonosító.");
  return data.id;
}
export async function sendGhlEmail(q: Quote): Promise<string> {
  const attachment = await createAttachmentUrl(q.id);
  const r = await fetch(
    "https://services.leadconnectorhq.com/conversations/messages",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("GHL_TOKEN")}`,
        Version: env("GHL_API_VERSION") || "2021-07-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "Email",
        contactId: q.contact.id,
        emailFrom: env("EMAIL_FROM"),
        emailTo: q.contact.email,
        subject: `Kitchen Box árajánlat - ${q.id}`,
        message: `Kedves ${q.contact.name}!\n\nCsatolva küldjük személyre szabott Kitchen Box ajánlatát.\n\nÜdvözlettel,\n${q.config.seller.name}`,
        attachments: [attachment],
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!r.ok) throw new Error("A GHL emailküldés eredménye nem igazolt.");
  const data = await r.json();
  if (!data.messageId) throw new Error("Hiányzó GHL üzenetazonosító.");
  return data.messageId;
}
