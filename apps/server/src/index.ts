import http from "http";
import { createApp } from "./app.js";
import { setupSocketServer } from "./sockets/gateway.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./database/mongoose.js";
import { connectRedis, disconnectRedis } from "./redis/client.js";
import { logger } from "./observability/logger.js";

async function bootstrap() {
  logger.info({ instanceId: env.INSTANCE_ID, port: env.PORT }, "Initializing ProxiSpeak server...");

  // Connect to underlying storage
  await connectDatabase();
  await connectRedis();

  const app = createApp();
  const server = http.createServer(app);
  setupSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info(`ProxiSpeak HTTP server listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Graceful shutdown initiated...");
    server.close(async () => {
      logger.info("HTTP server closed.");
      await disconnectRedis();
      await disconnectDatabase();
      logger.info("ProxiSpeak server terminated cleanly.");
      process.exit(0);
    });

    // Force exit after 10s if stuck
    setTimeout(() => {
      logger.error("Graceful shutdown timed out; forcing exit.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "Fatal error during server bootstrap");
  process.exit(1);
});
