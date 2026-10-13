import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/database/mongoose.js";
import { UserModel } from "../src/models/User.js";
import { OfficeModel } from "../src/models/Office.js";
import { OfficeLayoutModel } from "../src/models/OfficeLayout.js";
import { RoomMembershipModel } from "../src/models/RoomMembership.js";
import { generateAuthToken } from "../src/auth/service.js";

describe("Offices & Layouts API Integration", () => {
  const app = createApp();
  let token: string;
  let userId: string;
  let createdOfficeId: string;

  beforeAll(async () => {
    await connectDatabase();

    const user = await UserModel.create({
      email: `office-owner-${Date.now()}@example.com`,
      displayName: "Office Architect",
      passwordHash: "hash123",
    });
    userId = user._id.toString();
    token = generateAuthToken({ userId, email: user.email });
  });

  afterAll(async () => {
    if (userId) await UserModel.findByIdAndDelete(userId);
    if (createdOfficeId) {
      await OfficeModel.findByIdAndDelete(createdOfficeId);
      await OfficeLayoutModel.deleteOne({ officeId: createdOfficeId });
      await RoomMembershipModel.deleteMany({ roomId: createdOfficeId });
    }
    await disconnectDatabase();
  });

  it("POST /api/offices creates new office with default layout and owner membership", async () => {
    const res = await request(app)
      .post("/api/offices")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Main Research Hub",
        accessPolicy: "public",
        dimensions: { width: 1600, height: 1200 },
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    createdOfficeId = res.body.data.id;
    expect(res.body.data.name).toBe("Main Research Hub");
    expect(res.body.data.ownerId).toBe(userId);

    // Verify layout was created in DB
    const layout = await OfficeLayoutModel.findOne({ officeId: createdOfficeId });
    expect(layout).toBeDefined();
    expect(layout?.walls.length).toBeGreaterThan(0);
    expect(layout?.furniture.length).toBeGreaterThan(0);

    // Verify membership
    const membership = await RoomMembershipModel.findOne({
      roomId: createdOfficeId,
      userId,
    });
    expect(membership?.role).toBe("owner");
  });

  it("GET /api/offices lists created office", async () => {
    const res = await request(app)
      .get("/api/offices")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const office = res.body.data.find((o: any) => o.id === createdOfficeId);
    expect(office).toBeDefined();
  });

  it("GET /api/offices/:officeId/layout retrieves office geometry", async () => {
    const res = await request(app)
      .get(`/api/offices/${createdOfficeId}/layout`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.walls.length).toBeGreaterThan(0);
    expect(res.body.data.furniture.length).toBeGreaterThan(0);
  });

  it("POST /api/offices/:officeId/join and /leave updates membership", async () => {
    const joinRes = await request(app)
      .post(`/api/offices/${createdOfficeId}/join`)
      .set("Authorization", `Bearer ${token}`);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.ok).toBe(true);
    expect(joinRes.body.data.roomId).toBe(createdOfficeId);

    const leaveRes = await request(app)
      .post(`/api/offices/${createdOfficeId}/leave`)
      .set("Authorization", `Bearer ${token}`);

    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.ok).toBe(true);
  });
});
