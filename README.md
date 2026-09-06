# FeedbackBot

A production-ready Telegram bot for collecting user feedback, built with **Node.js**, **TypeScript**, **Telegraf**, **Express**, and **PostgreSQL** via **Prisma ORM**.

---

## Features

| Feature | Description |
|---|---|
| **Feedback submission** | Text, photo, video, voice, document, audio, sticker |
| **Anonymous mode** | Toggle per-user; admins see `ANON-XXXXX` alias instead of name |
| **Admin notifications** | All submissions forwarded instantly with full context |
| **Bi-directional replies** | Admins reply in the admin chat → bot relays back to the original sender |
| **Dynamic categories** | Admins add/remove categories from the admin chat; picker appears automatically when at least one exists |
| **Rate limiting** | Sliding window anti-flood (configurable) |
| **Ban / Unban** | Admin commands to silence disruptive users |
| **Statistics** | `/stats` with totals, unique users, anonymous ratio, and per-category breakdown |
| **Persistent sessions** | Prisma-backed sessions — survives restarts |
| **Health check** | `GET /health` for uptime monitoring |
| **Webhook + Long polling** | Auto-selected based on `NODE_ENV` |

---

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (strict)
- **Bot Framework**: [Telegraf v4](https://telegraf.js.org/)
- **Web Server**: Express
- **ORM**: Prisma
- **Database**: PostgreSQL

---

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd feedbackbot
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | Yes | Your bot token from [@BotFather](https://t.me/BotFather) |
| `ADMIN_CHAT_ID` | Yes | Chat/channel ID to receive feedback notifications |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Express port (default: `3000`) |
| `NODE_ENV` | No | `development` or `production` |
| `WEBHOOK_DOMAIN` | No | Public HTTPS URL for webhooks (production only) |
| `WEBHOOK_SECRET` | No | Random string to validate webhook requests |
| `RATE_LIMIT_MAX` | No | Max messages per window (default: `3`) |
| `RATE_LIMIT_WINDOW_SECONDS` | No | Window duration in seconds (default: `30`) |

### 3. Set Up the Database

```bash
npm run prisma:migrate
```

### 4. Run

```bash
# Development (long polling)
npm run dev

# Production build
npm run build
npm start
```

---

## How to Get Your `ADMIN_CHAT_ID`

1. Add the bot to your group or channel as an admin.
2. Send a message in that chat.
3. Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` and find the `chat.id` field.
4. For channels and groups it will be a negative number like `-1001234567890`.
5. Paste that value into `ADMIN_CHAT_ID` in your `.env`.

---

## User Commands

| Command | Description |
|---|---|
| `/start` | Open the main menu |
| `/feedback` | Start a new feedback submission |
| `/anonymous` | Toggle anonymous mode on/off |
| `/cancel` | Cancel an in-progress submission |
| `/help` | Show help |

---

## Admin Commands

All admin commands only work inside the designated admin chat. They are silently ignored everywhere else.

### Moderation

| Command | Description |
|---|---|
| `/stats` | View feedback statistics |
| `/ban <telegramId> [reason]` | Ban a user from submitting feedback |
| `/unban <telegramId>` | Unban a user |

### Category Management

Categories are optional. When no categories are configured, the submission flow goes straight to the message — no picker is shown. As soon as you add one or more categories, a picker automatically appears for all new submissions. Removing all categories reverts to the direct flow.

| Command | Example | Description |
|---|---|---|
| `/addcategory <name>` | `/addcategory Bug Report` | Add a feedback category |
| `/removecategory <name>` | `/removecategory Bug Report` | Remove a category |
| `/listcategories` | | List all active categories |

---

## Anonymous Mode

When a user has anonymous mode **ON**:

- Their real name, username, and Telegram profile link are never shown to admins.
- The admin notification shows a random alias like `ANON-X7K2M`.
- Admin replies are still relayed back to the user — the alias is used as a routing key internally.
- Each submission gets a fresh alias (not persistent across submissions).

---

## Feedback Flow

```
User taps "Send Feedback"
        │
        ▼
 Categories configured?
   ├── No  → "Send your feedback" prompt (goes straight to submission)
   └── Yes → Category picker (inline keyboard built from DB)
                    │
                    ▼
             User picks category
        │
        ▼
User sends message (text / photo / video / voice / file)
        │
        ▼
Saved to DB → Admin notified → User receives confirmation
```

If an admin replies to a notification in the admin chat, the reply is automatically relayed to the original sender.

---

## Architecture

```
feedbackbot/
├── prisma/
│   └── schema.prisma          # User, Feedback, Category, BotSession models
├── src/
│   ├── index.ts               # Entry point (polling ↔ webhook auto-switch)
│   ├── config/
│   │   ├── env.ts             # Zod-validated env vars
│   │   └── prisma.ts          # Singleton Prisma client
│   ├── types/
│   │   └── context.ts         # BotContext + SessionData types
│   ├── utils/
│   │   └── nanoid.ts          # Crypto-random alias generator
│   ├── bot/
│   │   ├── index.ts           # Bot factory (middleware chain + command registration)
│   │   ├── commands/
│   │   │   ├── start.ts
│   │   │   ├── help.ts
│   │   │   ├── anonymous.ts
│   │   │   └── admin.ts       # stats, ban, unban, addcategory, removecategory, listcategories
│   │   ├── handlers/
│   │   │   ├── feedback.ts    # Submission flow (category-aware, dynamic)
│   │   │   ├── adminReply.ts  # Relay admin replies back to senders
│   │   │   └── callbackQuery.ts
│   │   └── middlewares/
│   │       ├── logger.ts
│   │       ├── rateLimit.ts
│   │       ├── bannedCheck.ts
│   │       └── sessionManager.ts
│   ├── services/
│   │   ├── userService.ts
│   │   ├── feedbackService.ts
│   │   ├── categoryService.ts  # Add, remove, list categories
│   │   └── notificationService.ts
│   └── server/
│       └── express.ts          # POST /webhook + GET /health
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Database Schema

| Model | Purpose |
|---|---|
| `User` | Telegram user records, anonymous flag, ban status |
| `Category` | Admin-managed feedback categories (optional) |
| `Feedback` | Submissions with optional category FK, media, status, admin message link |
| `BotSession` | Telegraf session persistence (keyed by `chatId:userId`) |

Run `npm run prisma:studio` to browse the database visually.

---

## Production Deployment

Set the following in `.env`:

```env
NODE_ENV=production
WEBHOOK_DOMAIN=https://yourdomain.com
WEBHOOK_SECRET=<random 32-char hex string>
```

Then:

```bash
npm run build
npm start
```

The bot registers its webhook with Telegram automatically on startup. Make sure your server has a valid TLS certificate — Telegram requires HTTPS for webhooks.

---

## License

MIT
