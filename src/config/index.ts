import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}

export const config = {
  llm: {
    // Anthropic takes priority; falls back to OpenRouter
    provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openrouter',
    anthropicApiKey: optional('ANTHROPIC_API_KEY'),
    openrouterApiKey: optional('OPENROUTER_API_KEY'),
    model: optional('LLM_MODEL', 'claude-opus-4-6'),
  },

  telegram: {
    token: optional('TELEGRAM_BOT_TOKEN'),
    allowedUsers: (optional('TELEGRAM_ALLOWED_USERS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  whatsapp: {
    accountSid: optional('TWILIO_ACCOUNT_SID'),
    authToken: optional('TWILIO_AUTH_TOKEN'),
    phoneNumber: optional('TWILIO_WHATSAPP_NUMBER'),
    allowedNumbers: (optional('WHATSAPP_ALLOWED_NUMBERS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  google: {
    clientId: optional('GOOGLE_CLIENT_ID'),
    clientSecret: optional('GOOGLE_CLIENT_SECRET'),
    refreshToken: optional('GOOGLE_REFRESH_TOKEN'),
    gmailUser: optional('GMAIL_USER'),
  },

  notion: {
    token: optional('NOTION_TOKEN'),
    notesDatabaseId: optional('NOTION_NOTES_DATABASE_ID'),
  },

  github: {
    token: optional('GITHUB_TOKEN'),
    username: optional('GITHUB_USERNAME'),
    defaultRepo: optional('GITHUB_DEFAULT_REPO'),
  },

  redis: {
    url: optional('REDIS_URL'),
  },

  server: {
    port: parseInt(optional('PORT', '3000')),
    webhookUrl: optional('WEBHOOK_URL'),
    webhookSecret: optional('WEBHOOK_SECRET', 'openclaw-secret'),
  },
};

export function validateConfig() {
  const errors: string[] = [];

  if (!config.llm.anthropicApiKey && !config.llm.openrouterApiKey) {
    errors.push('At least one of ANTHROPIC_API_KEY or OPENROUTER_API_KEY is required');
  }
  if (!config.telegram.token && !config.whatsapp.accountSid) {
    errors.push('At least one of TELEGRAM_BOT_TOKEN or TWILIO_ACCOUNT_SID is required');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:\n' + errors.map((e) => `  - ${e}`).join('\n'));
    process.exit(1);
  }

  console.log(`[config] LLM provider: ${config.llm.provider} (model: ${config.llm.model})`);
  console.log(`[config] Telegram: ${config.telegram.token ? 'enabled' : 'disabled'}`);
  console.log(`[config] WhatsApp: ${config.whatsapp.accountSid ? 'enabled' : 'disabled'}`);
  console.log(`[config] Gmail: ${config.google.clientId ? 'enabled' : 'disabled'}`);
  console.log(`[config] Calendar: ${config.google.clientId ? 'enabled' : 'disabled'}`);
  console.log(`[config] Notion: ${config.notion.token ? 'enabled' : 'disabled'}`);
  console.log(`[config] GitHub: ${config.github.token ? 'enabled' : 'disabled'}`);
}
