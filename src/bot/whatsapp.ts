import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { config } from '../config/index.js';
import { chat } from '../llm/index.js';
import { sessionManager } from '../session/index.js';

const MAX_WA_LENGTH = 1500; // WhatsApp message limit

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.substring(0, MAX_WA_LENGTH));
    remaining = remaining.substring(MAX_WA_LENGTH);
  }
  return chunks;
}

function isAllowed(from: string): boolean {
  if (config.whatsapp.allowedNumbers.length === 0) return true;
  return config.whatsapp.allowedNumbers.includes(from);
}

async function sendWhatsAppMessage(to: string, body: string) {
  const client = twilio(config.whatsapp.accountSid, config.whatsapp.authToken);
  await client.messages.create({
    from: config.whatsapp.phoneNumber,
    to,
    body,
  });
}

export function createWhatsAppRouter(): Router {
  const router = Router();

  if (!config.whatsapp.accountSid) {
    console.log('[whatsapp] Disabled (no TWILIO_ACCOUNT_SID)');
    return router;
  }

  // Twilio webhook for incoming WhatsApp messages
  router.post('/webhook/whatsapp', async (req: Request, res: Response) => {
    // Validate Twilio signature
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${config.server.webhookUrl}/webhook/whatsapp`;

    if (config.server.webhookUrl) {
      const isValid = twilio.validateRequest(
        config.whatsapp.authToken,
        signature,
        url,
        req.body,
      );
      if (!isValid) {
        console.warn('[whatsapp] Invalid Twilio signature');
        res.status(403).send('Forbidden');
        return;
      }
    }

    const from: string = req.body.From || '';
    const body: string = (req.body.Body || '').trim();

    if (!from || !body) {
      res.status(200).send('<Response></Response>');
      return;
    }

    if (!isAllowed(from)) {
      res.status(200).send('<Response></Response>');
      await sendWhatsAppMessage(from, 'Sorry, you are not authorized to use this assistant.');
      return;
    }

    // Respond immediately to Twilio (required within 15s)
    res.status(200).send('<Response></Response>');

    const userId = from.replace('whatsapp:', '');
    console.log(`[whatsapp] Message from ${from}: ${body.substring(0, 100)}`);

    // Handle /clear command
    if (body.toLowerCase() === '/clear' || body.toLowerCase() === 'clear') {
      await sessionManager.clear(userId, 'whatsapp');
      await sendWhatsAppMessage(from, 'Conversation cleared! Starting fresh.');
      return;
    }

    try {
      await sessionManager.addUserMessage(userId, 'whatsapp', body);
      const session = await sessionManager.get(userId, 'whatsapp');
      const response = await chat(session.messages);
      await sessionManager.addAssistantMessage(userId, 'whatsapp', response);

      const chunks = chunkText(response);
      for (const chunk of chunks) {
        await sendWhatsAppMessage(from, chunk);
      }
    } catch (err: any) {
      console.error('[whatsapp] Error:', err.message);
      await sendWhatsAppMessage(from, `Error: ${err.message.substring(0, 200)}`);
    }
  });

  return router;
}
