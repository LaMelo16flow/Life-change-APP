import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export function isGmailConfigured(): boolean {
  return Boolean(Deno.env.get("GMAIL_USER") && Deno.env.get("GMAIL_APP_PASSWORD"));
}

export async function sendGmailEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const username = Deno.env.get("GMAIL_USER")!;
  const password = Deno.env.get("GMAIL_APP_PASSWORD")!;

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username, password },
    },
  });

  try {
    await client.send({
      from: `LifeChangers <${username}>`,
      to: params.to,
      subject: params.subject,
      content: "auto",
      html: params.html,
    });
  } finally {
    await client.close();
  }
}
