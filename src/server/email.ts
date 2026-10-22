import { env } from "./config";
import type { Quote } from "./store";
export async function sendEmail(q: Quote): Promise<string> {
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
