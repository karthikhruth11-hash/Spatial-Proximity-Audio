import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/database/mongoose.js";
import { connectRedis, disconnectRedis } from "../src/redis/client.js";

describe("Health & Readiness API Endpoints", () => {
  const app = createApp();

  beforeAll(async () => {
    // Attempt connections to local running services
    try {
      await connectDatabase();
    } catch {
      // Ignored if local db not present in offline test mode
    }

    try {
      await connectRedis();
    } catch {
      // Ignored if local redis not present in offline test mode
    }
  });

  afterAll(async () => {
    await disconnectRedis();
    await disconnectDatabase();
  });

  it("GET /api/health returns 200 with liveness envelope", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("live");
    expect(typeof res.body.data.uptime).toBe("number");
    expect(typeof res.body.data.timestamp).toBe("number");
  });

  it("GET /metrics returns prometheus metrics format", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("proxispeak_connected_sockets");
  });

  it("GET /api/ready responds with correct structured envelope", async () => {
    const res = await request(app).get("/api/ready");
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.ok).toBe(true);
      expect(res.body.data.mongo).toBe("healthy");
      expect(res.body.data.redis).toBe("healthy");
    } else {
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("NOT_READY");
    }
  });

  it("GET /nonexistent returns 404 in standard error envelope", async () => {
    const res = await request(app).get("/api/unknown-endpoint");
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
