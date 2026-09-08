import express, { Request, Response } from "express";
import { Telegraf } from "telegraf";
import { BotContext } from "../types/context";
import { env } from "../config/env";

/**
 * Create the Express application.
 *
 * Exposes:
 *   POST /webhook  — Receives Telegram updates (production mode)
 *   GET  /health   — Health check for uptime monitoring / load balancers
 */
export function createExpressApp(bot: Telegraf<BotContext>): express.Application {
  const app = express();

  // Parse JSON bodies for all routes
  app.use(express.json());

  // ── Health check ───────────────────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
    });
  });

  // ── Telegram Webhook ───────────────────────────────────────────────────────
  // Validate the secret token header to reject spoofed requests
  app.post(
    "/webhook",
    (req: Request, res: Response, next) => {
      const secret = req.headers["x-telegram-bot-api-secret-token"];
      if (env.WEBHOOK_SECRET && secret !== env.WEBHOOK_SECRET) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    },
    (req: Request, res: Response) => {
      // Immediately acknowledge the request to prevent Telegram from retrying
      // and causing duplicate messages (especially on slower hosts like Render)
      res.sendStatus(200);

      // Hand the update off to Telegraf in the background
      bot.handleUpdate(req.body).catch((err) => {
        console.error("[webhook] Error handling update:", err);
      });
    }
  );

  return app;
}
