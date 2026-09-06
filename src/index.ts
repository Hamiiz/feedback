import { env, useWebhook } from "./config/env";
import { prisma } from "./config/prisma";
import { createBot } from "./bot";
import { createExpressApp } from "./server/express";

async function main(): Promise<void> {
  console.log(`🤖 Starting FeedbackBot [${env.NODE_ENV}]...`);

  // Verify database connectivity on startup
  try {
    await prisma.$connect();
    console.log("✅ Database connected.");
  } catch (err) {
    console.error("❌ Failed to connect to the database:", err);
    process.exit(1);
  }

  const bot = createBot();

  if (useWebhook) {
    // ── Production: Webhook mode ─────────────────────────────────────────────
    const webhookPath = "/webhook";
    const webhookUrl = `${env.WEBHOOK_DOMAIN}${webhookPath}`;

    // Register the webhook with Telegram
    await bot.telegram.setWebhook(webhookUrl, {
      secret_token: env.WEBHOOK_SECRET || undefined,
    });
    console.log(`🌐 Webhook registered at: ${webhookUrl}`);

    // Start Express to receive updates
    const app = createExpressApp(bot);
    app.listen(env.PORT, () => {
      console.log(`🚀 Express server listening on port ${env.PORT}`);
    });
  } else {
    // ── Development: Long polling mode ───────────────────────────────────────
    // Remove any previously registered webhook so polling works
    await bot.telegram.deleteWebhook();
    console.log("🔄 Starting in long polling mode...");

    bot.launch();
    console.log("✅ Bot is running (long polling).");

    // Also start Express for the health endpoint even in dev
    const app = createExpressApp(bot);
    app.listen(env.PORT, () => {
      console.log(`🚀 Express server listening on port ${env.PORT} (health check available)`);
    });
  }

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n⏹  Received ${signal}. Shutting down gracefully...`);
    bot.stop(signal);
    await prisma.$disconnect();
    console.log("✅ Shutdown complete.");
    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("💥 Fatal startup error:", err);
  process.exit(1);
});
