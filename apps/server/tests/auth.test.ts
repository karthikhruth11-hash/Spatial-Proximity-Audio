import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/database/mongoose.js";
import { UserModel } from "../src/models/User.js";

describe("Auth API Endpoints Integration", () => {
  const app = createApp();
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: "Password123!",
    displayName: "Test Pioneer",
  };

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await UserModel.deleteMany({ email: testUser.email });
    await disconnectDatabase();
  });

  it("POST /api/auth/register creates user and returns token & cookie", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.user.displayName).toBe(testUser.displayName);
    expect(res.body.data.token).toBeDefined();
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("proxispeak_token");
  });

  it("POST /api/auth/register rejects duplicate email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("USER_EXISTS");
  });

  it("POST /api/auth/login succeeds with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it("POST /api/auth/login rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: "WrongPassword999",
      });

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("GET /api/auth/me returns profile when authenticated", async () => {
    // First login to get token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    const token = loginRes.body.data.token;

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.ok).toBe(true);
    expect(meRes.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(meRes.body.data.user.displayName).toBe(testUser.displayName);
  });

  it("GET /api/auth/me rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });
});
