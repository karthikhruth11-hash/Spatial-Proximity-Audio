import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../observability/logger.js";
import { databaseUpGauge } from "../observability/metrics.js";

export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });
    databaseUpGauge.set(1);
    logger.info({ uri: env.MONGODB_URI.replace(/\/\/.*@/, "//***@") }, "Connected to MongoDB");
    return conn;
  } catch (error) {
    databaseUpGauge.set(0);
    logger.error({ err: error }, "Failed to connect to MongoDB");
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    databaseUpGauge.set(0);
    logger.info("Disconnected from MongoDB");
  } catch (error) {
    logger.error({ err: error }, "Error disconnecting from MongoDB");
  }
}

export function isDatabaseHealthy(): boolean {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  return mongoose.connection.readyState === 1;
}
