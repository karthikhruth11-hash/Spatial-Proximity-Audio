import express, { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { healthRouter } from "./api/health.js";
import { authRouter } from "./api/auth.js";
import { officeRouter } from "./api/offices.js";
import { metricsRegistry } from "./observability/metrics.js";
import { logger } from "./observability/logger.js";

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
    }),
  );

  // Strict CORS
  const allowedOrigins = [
    env.CLIENT_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS blocked for origin: ${origin}`));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Cookie parsing with secret
  app.use(cookieParser(env.COOKIE_SECRET));

  // Body parsing with size cap
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Prometheus metrics endpoint
  app.get("/metrics", async (_req: Request, res: Response) => {
    try {
      res.set("Content-Type", metricsRegistry.contentType);
      const metrics = await metricsRegistry.metrics();
      res.end(metrics);
    } catch (err) {
      res.status(500).end(err);
    }
  });

  // API Routes
  app.use("/api", healthRouter);
  app.use("/api", authRouter);
  app.use("/api", officeRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found",
      },
    });
  });

  // Central error handling
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "Unhandled Express error");
    res.status(500).json({
      ok: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: env.NODE_ENV === "production" ? "Internal server error" : err.message,
      },
    });
  });

  return app;
}
