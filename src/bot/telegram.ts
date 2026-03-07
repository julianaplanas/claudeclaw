import { Telegraf } from 'telegraf';
import { config } from '../config/index.js';
import { chat } from '../llm/index.js';
import { sessionManager } from '../session/index.js';

const MAX_MESSAGE_LENGTH = 4096;

function chunkText(text: string, maxLen = MAX_MESSAGE_LENGTH): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.substring(0, maxLen));
    remaining = remaining.substring(maxLen);
  }
  return chunks;
}

function isAllowed(userId: string): boolean {
  if (config.telegram.allowedUsers.length === 0) return true;
  return config.telegram.allowedUsers.includes(userId);
}

export function createTelegramBot() {
  if (!config.telegram.token) {
    console.log('[telegram] Bot disabled (no TELEGRAM_BOT_TOKEN)');
    return null;
  }

  const bot = new Telegraf(config.telegram.token);

  bot.start((ctx) => {
    ctx.reply(
      `Hey! I'm Openclaw, your personal AI assistant.\n\nI can help you with:\n- Email (read/send)\n- Calendar events\n- Notes in Notion\n- GitHub repos & code\n- Code execution\n\nJust send me a message! Use /clear to reset the conversation.`,
    );
  });

  bot.command('clear', async (ctx) => {
    const userId = String(ctx.from?.id);
    await sessionManager.clear(userId, 'telegram');
    ctx.reply('Conversation cleared!');
  });

  bot.command('help', (ctx) => {
    ctx.reply(`Commands:\n/clear - Reset conversation\n/help - Show this message\n\nJust type your request naturally.`);
  });

  bot.on('text', async (ctx) => {
    const userId = String(ctx.from?.id);
    const username = ctx.from?.username || ctx.from?.first_name || userId;

    if (!isAllowed(userId)) {
      ctx.reply('Sorry, you are not authorized to use this bot.');
      return;
    }

    const userMessage = ctx.message.text;
    console.log(`[telegram] ${username} (${userId}): ${userMessage.substring(0, 100)}`);

    await ctx.sendChatAction('typing');

    try {
      // Add user message to session
      await sessionManager.addUserMessage(userId, 'telegram', userMessage);

      // Get full session history
      const session = await sessionManager.get(userId, 'telegram');

      // Keep typing indicator alive during long operations
      const typingInterval = setInterval(() => {
        ctx.sendChatAction('typing').catch(() => {});
      }, 4000);

      let response: string;
      try {
        response = await chat(session.messages);
      } finally {
        clearInterval(typingInterval);
      }

      // Save assistant response to session
      await sessionManager.addAssistantMessage(userId, 'telegram', response);

      // Send response in chunks if needed
      const chunks = chunkText(response);
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }
    } catch (err: any) {
      console.error('[telegram] Error:', err.message);
      await ctx.reply(`Sorry, I ran into an error: ${err.message.substring(0, 200)}`);
    }
  });

  bot.catch((err: any) => {
    console.error('[telegram] Unhandled error:', err);
  });

  return bot;
}
