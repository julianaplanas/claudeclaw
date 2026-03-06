# 🐾 Openclaw — Personal AI Assistant

A self-hosted personal assistant powered by Claude (Anthropic) or any model via OpenRouter. Accessible from **Telegram** and **WhatsApp**, deployable on **Railway** in minutes.

**Capabilities:**
- 📧 Read and send emails (Gmail)
- 📅 Read and create calendar events (Google Calendar)
- 📝 Read and create notes (Notion)
- 🐙 Manage GitHub repos: create repos, read/write files, create issues
- 💻 Execute Python and JavaScript code
- 🧠 Persistent conversation history (Redis or in-memory)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Local)](#quick-start-local)
3. [Step-by-Step Setup](#step-by-step-setup)
   - [LLM (Anthropic or OpenRouter)](#1-llm-anthropic-or-openrouter)
   - [Telegram Bot](#2-telegram-bot)
   - [WhatsApp via Twilio](#3-whatsapp-via-twilio)
   - [Gmail & Google Calendar](#4-gmail--google-calendar)
   - [Notion (Notes)](#5-notion-notes)
   - [GitHub](#6-github)
4. [Deploy to Railway](#deploy-to-railway)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Usage Examples](#usage-examples)
7. [Architecture](#architecture)

---

## Prerequisites

- Node.js 20+
- npm
- A [Railway](https://railway.app) account (free tier works)
- At least one of: Anthropic API key or OpenRouter API key
- At least one of: Telegram Bot Token or Twilio account

---

## Quick Start (Local)

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/openclaw.git
cd openclaw
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your values (see setup steps below)

# 3. Run locally
npm run dev
```

---

## Step-by-Step Setup

### 1. LLM (Anthropic or OpenRouter)

You need **at least one** of these. If both are set, Anthropic is used.

#### Option A: Anthropic (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Navigate to **API Keys** → Create a key
3. Set in `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   LLM_MODEL=claude-opus-4-6
   ```

Available models: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`

#### Option B: OpenRouter

1. Go to [openrouter.ai](https://openrouter.ai) → Sign up → Keys
2. Create an API key
3. Set in `.env`:
   ```
   OPENROUTER_API_KEY=sk-or-...
   LLM_MODEL=anthropic/claude-opus-4-6
   ```

OpenRouter model format: `provider/model-name`
- `anthropic/claude-opus-4-6`
- `google/gemini-2.0-flash-001`
- `openai/gpt-4o`

---

### 2. Telegram Bot

1. Open Telegram and message **@BotFather**
2. Send `/newbot`
3. Follow prompts to name your bot (e.g., "MyAssistant" / `myassistant_bot`)
4. BotFather will give you a token like `123456789:ABCdefGHI...`
5. Set in `.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHI...
   ```
6. **Get your Telegram user ID** (to restrict access):
   - Message **@userinfobot** on Telegram
   - It replies with your numeric ID
   ```
   TELEGRAM_ALLOWED_USERS=123456789
   ```
   Leave empty to allow anyone who finds the bot.

**Local development:** The bot uses long-polling automatically (no webhook needed).
**Production (Railway):** Set `WEBHOOK_URL` and the bot auto-switches to webhook mode.

---

### 3. WhatsApp via Twilio

WhatsApp requires a Twilio account. The sandbox is free for testing.

#### Step 1: Create Twilio account
1. Go to [twilio.com](https://www.twilio.com) → Sign up (free)
2. From the Console Dashboard, note your:
   - **Account SID** (starts with `AC...`)
   - **Auth Token**

#### Step 2: Set up WhatsApp Sandbox (for testing)
1. In Twilio Console → **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Follow instructions to join the sandbox (send a message to their number)
3. Set the sandbox **"When a message comes in"** webhook URL to:
   ```
   https://YOUR_RAILWAY_URL/webhook/whatsapp
   ```
4. Set in `.env`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   WHATSAPP_ALLOWED_NUMBERS=whatsapp:+YOUR_PHONE_NUMBER
   ```

#### Step 3: Production (WhatsApp Business)
For a permanent phone number, you need a [WhatsApp Business Account](https://www.twilio.com/en-us/whatsapp/pricing):
1. Apply for a WhatsApp Business profile in Twilio
2. Once approved, set `TWILIO_WHATSAPP_NUMBER` to your dedicated number

---

### 4. Gmail & Google Calendar

Both use the same Google OAuth2 credentials.

#### Step 1: Create a Google Cloud project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable these APIs:
   - **Gmail API**: Search "Gmail API" → Enable
   - **Google Calendar API**: Search "Google Calendar API" → Enable

#### Step 2: Create OAuth2 credentials
1. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
2. Application type: **Desktop app**
3. Name it "Openclaw"
4. Download or note:
   - **Client ID** (ends with `.apps.googleusercontent.com`)
   - **Client Secret**
5. Go to **OAuth consent screen** → Add your Gmail as a test user

#### Step 3: Configure OAuth consent screen
1. **APIs & Services** → **OAuth consent screen**
2. User type: **External** (or Internal if Google Workspace)
3. Fill in app name, your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/calendar`
5. Add yourself as a **test user**

#### Step 4: Get the refresh token
```bash
# In your project directory, with .env set up:
npm run get-google-token
```

This opens a URL — paste it in your browser, authorize, copy the code back, and it prints your refresh token.

```
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
GOOGLE_REFRESH_TOKEN=1//xxxx
GMAIL_USER=you@gmail.com
```

---

### 5. Notion (Notes)

#### Step 1: Create a Notion integration
1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **+ New integration**
3. Name it "Openclaw", select your workspace
4. Copy the **Internal Integration Token**

#### Step 2: Create a Notes database in Notion
1. In Notion, create a new page → **Table** database
2. Add these properties to the database:
   - `Name` (title) — already there by default
   - `Tags` (multi-select)
3. Click **...** (top right) → **Add connections** → Select "Openclaw"
4. Copy the **Database ID** from the URL:
   ```
   https://notion.so/yourworkspace/DATABASE_ID?v=...
   ```
   The Database ID is the 32-character string before the `?`

```
NOTION_TOKEN=secret_xxxx
NOTION_NOTES_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 6. GitHub

#### Create a Personal Access Token
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select scopes:
   - `repo` (full repository access)
   - `workflow` (to trigger GitHub Actions)
   - `read:user`
4. Generate and copy the token

```
GITHUB_TOKEN=ghp_xxxx
GITHUB_USERNAME=your-username
GITHUB_DEFAULT_REPO=my-projects   # optional default repo
```

---

## Deploy to Railway

### Step 1: Create Railway project

1. Go to [railway.app](https://railway.app) → Sign up/in
2. Click **New Project** → **Deploy from GitHub repo**
3. Connect your GitHub account and select the `openclaw` repo
   - Or: **New Project** → **Empty project** → Add service → GitHub repo

### Step 2: Add environment variables

In Railway dashboard → your project → **Variables** tab:

Add every variable from your `.env` file. The critical ones are:

```
ANTHROPIC_API_KEY       (or OPENROUTER_API_KEY)
TELEGRAM_BOT_TOKEN
TELEGRAM_ALLOWED_USERS
TWILIO_ACCOUNT_SID      (if using WhatsApp)
TWILIO_AUTH_TOKEN       (if using WhatsApp)
TWILIO_WHATSAPP_NUMBER  (if using WhatsApp)
WHATSAPP_ALLOWED_NUMBERS (if using WhatsApp)
GOOGLE_CLIENT_ID        (if using Gmail/Calendar)
GOOGLE_CLIENT_SECRET    (if using Gmail/Calendar)
GOOGLE_REFRESH_TOKEN    (if using Gmail/Calendar)
GMAIL_USER              (if using Gmail)
NOTION_TOKEN            (if using Notes)
NOTION_NOTES_DATABASE_ID (if using Notes)
GITHUB_TOKEN            (if using GitHub)
GITHUB_USERNAME         (if using GitHub)
```

### Step 3: Get your Railway URL

1. In Railway → your service → **Settings** → **Networking** → **Generate Domain**
2. Copy the URL (e.g., `https://openclaw-production.up.railway.app`)
3. Add it as an env variable:
   ```
   WEBHOOK_URL=https://openclaw-production.up.railway.app
   ```

### Step 4: Update Twilio webhook (WhatsApp)

In Twilio Console → **Messaging** → **WhatsApp Sandbox Settings** (or your number settings):
- Set **"When a message comes in"** to:
  ```
  https://openclaw-production.up.railway.app/webhook/whatsapp
  ```
- Method: `HTTP POST`

### Step 5: Add Redis (optional but recommended)

For persistent sessions (conversations survive restarts):

1. In Railway project → **+ New** → **Database** → **Redis**
2. Railway automatically sets `REDIS_URL` for your service
3. That's it — the app detects Redis automatically

### Step 6: Deploy

Railway deploys automatically on each push to your main branch.

Check deployment logs in Railway → your service → **Logs** tab.

Verify health: `https://YOUR_RAILWAY_URL/health`

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | One of these two | Direct Anthropic API key |
| `OPENROUTER_API_KEY` | One of these two | OpenRouter API key (fallback) |
| `LLM_MODEL` | No | Model to use (default: `claude-opus-4-6`) |
| `TELEGRAM_BOT_TOKEN` | One of bot options | Telegram bot token from @BotFather |
| `TELEGRAM_ALLOWED_USERS` | No | Comma-separated Telegram user IDs |
| `TWILIO_ACCOUNT_SID` | For WhatsApp | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | For WhatsApp | Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | For WhatsApp | `whatsapp:+14155238886` |
| `WHATSAPP_ALLOWED_NUMBERS` | No | Comma-separated allowed numbers |
| `GOOGLE_CLIENT_ID` | For Gmail/Calendar | OAuth2 Client ID |
| `GOOGLE_CLIENT_SECRET` | For Gmail/Calendar | OAuth2 Client Secret |
| `GOOGLE_REFRESH_TOKEN` | For Gmail/Calendar | OAuth2 Refresh Token |
| `GMAIL_USER` | For Gmail | Your Gmail address |
| `NOTION_TOKEN` | For Notes | Notion integration token |
| `NOTION_NOTES_DATABASE_ID` | For Notes | Notes database ID |
| `GITHUB_TOKEN` | For GitHub | Personal Access Token |
| `GITHUB_USERNAME` | For GitHub | Your GitHub username |
| `GITHUB_DEFAULT_REPO` | No | Default repo for file operations |
| `PORT` | No | HTTP port (default: 3000) |
| `WEBHOOK_URL` | For production | Your Railway public URL |
| `WEBHOOK_SECRET` | No | Random string for webhook security |
| `REDIS_URL` | No | Redis URL (auto-set by Railway add-on) |

---

## Usage Examples

Once running, just send natural language messages:

**Email:**
```
read my last 5 emails
show me emails from john@example.com
send an email to boss@company.com saying I'll be late tomorrow
```

**Calendar:**
```
what's on my calendar this week?
schedule a meeting with alice@co.com on Friday at 3pm for 1 hour called "Project Review"
```

**Notes:**
```
show my recent notes
create a note called "Meeting Notes" with: Discussed Q1 goals, next steps are...
search my notes for "project alpha"
```

**GitHub:**
```
list my repos
create a new private repo called "my-script"
write a Python script to parse CSV files and save it to my-script repo as src/parser.py
show me the contents of main.py in my-api repo
```

**Code:**
```
calculate the first 20 fibonacci numbers
write and run a Python script to generate a random password
what's 2^32?
```

**Combined (agentic):**
```
read my last 3 emails, summarize them and create a Notion note called "Email Summary - Today"
write a FastAPI hello world app and push it to my api-playground repo
check my calendar for tomorrow and send me a summary
```

**Conversation:**
```
/clear   — reset conversation history
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Railway                          │
│                                                      │
│  ┌──────────┐    ┌─────────────────────────────┐    │
│  │ Express  │    │    Agentic LLM Loop          │    │
│  │ Server   │───▶│  Anthropic / OpenRouter      │    │
│  └──────────┘    │  (claude-opus-4-6)           │    │
│       │          └─────────────┬───────────────┘    │
│       │                        │ tool calls          │
│  ┌────┴────┐    ┌──────────────▼──────────────┐    │
│  │Telegram │    │         Tools                │    │
│  │ Bot     │    │  email · calendar · notion   │    │
│  ├─────────┤    │  github · code execution     │    │
│  │WhatsApp │    └─────────────────────────────┘    │
│  │(Twilio) │                                        │
│  └─────────┘    ┌──────────────────────────────┐   │
│                  │   Session Storage             │   │
│                  │   Redis (or in-memory)        │   │
│                  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         │                          │
    Telegram API              External APIs
                         Gmail · GCal · Notion
                         GitHub · Twilio
```

**Flow:**
1. Message arrives via Telegram bot or WhatsApp webhook
2. User message added to session history
3. Full conversation sent to LLM with all tool definitions
4. LLM decides which tools to call → tools execute → results returned to LLM
5. Loop continues until LLM gives a final text response
6. Response sent back to user via same platform

---

## Local Development Tips

```bash
# Watch mode with auto-restart
npm run dev:watch

# Test Telegram without a server (uses long-polling automatically)
npm run dev

# Generate Google refresh token
npm run get-google-token

# Build for production
npm run build && npm start
```

For testing WhatsApp locally, use [ngrok](https://ngrok.com):
```bash
ngrok http 3000
# Then set WEBHOOK_URL=https://xxxx.ngrok.io in .env
# And update Twilio webhook to https://xxxx.ngrok.io/webhook/whatsapp
```

---

## Troubleshooting

**Bot doesn't respond:**
- Check Railway logs for errors
- Verify `WEBHOOK_URL` is correct and publicly accessible
- Test health: `curl https://YOUR_URL/health`

**Google auth fails:**
- Refresh token expires if unused for 6 months — re-run `npm run get-google-token`
- Make sure your email is added as a test user in OAuth consent screen

**Twilio webhook fails:**
- Verify the webhook URL is set correctly in Twilio console
- Check that Railway is running and `/health` returns 200

**"Tool not configured" errors:**
- Check that the relevant env vars are set in Railway
- Missing tools are skipped gracefully — the bot will tell you what's unavailable
