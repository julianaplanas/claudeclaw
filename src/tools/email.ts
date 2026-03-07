import { google } from 'googleapis';
import { config } from '../config/index.js';

function getGmailClient() {
  if (!config.google.clientId || !config.google.refreshToken) {
    throw new Error('Google credentials not configured (GOOGLE_CLIENT_ID, GOOGLE_REFRESH_TOKEN)');
  }

  const auth = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
  );
  auth.setCredentials({ refresh_token: config.google.refreshToken });
  return google.gmail({ version: 'v1', auth });
}

function decodeBase64(encoded: string): string {
  return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload: any): string {
  if (!payload) return '';

  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
    // Fallback to HTML if no plain text
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64(part.body.data);
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      // Recursive for nested parts
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }

  return '';
}

export async function readEmails(args: { count?: number; query?: string }): Promise<string> {
  const gmail = getGmailClient();
  const count = Math.min(args.count ?? 10, 50);
  const query = args.query || '';

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: count,
  });

  const messages = listRes.data.messages;
  if (!messages || messages.length === 0) {
    return query ? `No emails matching "${query}".` : 'No emails found.';
  }

  const results: string[] = [];

  for (const msg of messages) {
    const msgRes = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'full',
    });

    const headers = msgRes.data.payload?.headers || [];
    const get = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const body = extractBody(msgRes.data.payload);
    const preview = body.substring(0, 300).trim();

    results.push(
      `Subject: ${get('Subject')}\nFrom: ${get('From')}\nDate: ${get('Date')}\nPreview: ${preview}${body.length > 300 ? '...' : ''}`,
    );
  }

  return results.join('\n\n---\n\n');
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}): Promise<string> {
  const gmail = getGmailClient();
  const from = config.google.gmailUser;

  let rawEmail = `From: ${from}\nTo: ${args.to}\n`;
  if (args.cc) rawEmail += `Cc: ${args.cc}\n`;
  rawEmail += `Subject: ${args.subject}\nContent-Type: text/plain; charset=utf-8\n\n${args.body}`;

  const encoded = Buffer.from(rawEmail).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });

  return `Email sent to ${args.to} with subject "${args.subject}".`;
}
