import { Router, Request, Response } from "express";
import { isDatabaseHealthy } from "../database/mongoose.js";
import { isRedisHealthy } from "../redis/client.js";
import { env } from "../config/env.js";

export const healthRouter: Router = Router();

/**
 * Liveness probe: returns 200 as long as the Express process is running.
 */
healthRouter.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    data: {
      status: "live",
      instanceId: env.INSTANCE_ID,
      uptime: process.uptime(),
      timestamp: Date.now(),
    },
  });
});

/**
 * Readiness probe: checks both MongoDB and Redis connectivity.
 * Returns 200 if both are healthy, 503 if either is unhealthy.
 */
healthRouter.get("/ready", async (_req: Request, res: Response) => {
  const mongoHealthy = isDatabaseHealthy();
  const redisHealthy = await isRedisHealthy();

  const isReady = mongoHealthy && redisHealthy;

  if (isReady) {
    res.status(200).json({
      ok: true,
      data: {
        status: "ready",
        instanceId: env.INSTANCE_ID,
        mongo: "healthy",
        redis: "healthy",
      },
    });
  } else {
    res.status(503).json({
      ok: false,
      error: {
        code: "NOT_READY",
        message: "Underlying services not ready",
        details: {
          mongo: mongoHealthy ? "healthy" : "unhealthy",
          redis: redisHealthy ? "healthy" : "unhealthy",
        },
      },
    });
  }
});
