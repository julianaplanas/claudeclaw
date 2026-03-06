import express from 'express';
import { config, validateConfig } from './config';
import { sessionManager } from './session';
import { createTelegramBot } from './bot/telegram';
import { createWhatsAppRouter } from './bot/whatsapp';

async function main() {
  // Validate environment configuration
  validateConfig();

  // Initialize session manager (Redis or in-memory)
  await sessionManager.init();

  // Create Express server
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint (used by Railway)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      provider: config.llm.provider,
      model: config.llm.model,
      telegram: !!config.telegram.token,
      whatsapp: !!config.whatsapp.accountSid,
      uptime: process.uptime(),
    });
  });

  app.get('/', (_req, res) => {
    res.json({
      name: 'Openclaw',
      description: 'Personal AI assistant',
      status: 'running',
    });
  });

  // Mount WhatsApp webhook router
  const whatsAppRouter = createWhatsAppRouter();
  app.use(whatsAppRouter);

  // Start HTTP server
  const server = app.listen(config.server.port, () => {
    console.log(`\n🐾 Openclaw is running on port ${config.server.port}`);
  });

  // Set up Telegram bot
  const bot = createTelegramBot();

  if (bot) {
    if (config.server.webhookUrl) {
      // Webhook mode (production - Railway)
      const webhookPath = `/webhook/telegram/${config.server.webhookSecret}`;
      const webhookUrl = `${config.server.webhookUrl}${webhookPath}`;

      app.use(bot.webhookCallback(webhookPath));

      try {
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`[telegram] Webhook set: ${webhookUrl}`);
      } catch (err: any) {
        console.error('[telegram] Failed to set webhook:', err.message);
        // Fall back to polling
        await bot.telegram.deleteWebhook();
        bot.launch();
        console.log('[telegram] Falling back to long polling mode');
      }
    } else {
      // Long-polling mode (local development)
      await bot.telegram.deleteWebhook();
      bot.launch();
      console.log('[telegram] Bot started in long-polling mode (local dev)');
    }

    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }

  // Graceful server shutdown
  process.once('SIGTERM', () => {
    server.close(() => {
      console.log('[server] HTTP server closed');
      process.exit(0);
    });
  });

  console.log('\n✅ All services initialized. Ready to assist!\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
