import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../observability/logger.js";
import { redisUpGauge } from "../observability/metrics.js";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redisClient.on("connect", () => {
      redisUpGauge.set(1);
      logger.info({ url: env.REDIS_URL.replace(/\/\/.*@/, "//***@") }, "Connected to Redis");
    });

    redisClient.on("error", (err) => {
      redisUpGauge.set(0);
      logger.error({ err }, "Redis client connection error");
    });

    redisClient.on("close", () => {
      redisUpGauge.set(0);
      logger.warn("Redis connection closed");
    });
  }

  return redisClient;
}

export async function connectRedis(): Promise<Redis> {
  const client = getRedisClient();
  if (client.status !== "ready" && client.status !== "connecting") {
    await client.connect();
  }
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => redisClient?.disconnect());
    redisClient = null;
    redisUpGauge.set(0);
    logger.info("Disconnected from Redis");
  }
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    if (!redisClient) return false;
    const res = await redisClient.ping();
    return res === "PONG";
  } catch {
    return false;
  }
}
