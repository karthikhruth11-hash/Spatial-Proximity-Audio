import { describe, it, expect } from "vitest";
import {
  RegisterSchema,
  LoginSchema,
  CreateOfficeSchema,
  MovementInputSchema,
  SignalingEnvelopeSchema,
  ProximityTransitionSchema,
} from "../src/schemas/index.js";

describe("Zod runtime validation schemas", () => {
  it("validates valid registration payload", () => {
    const valid = {
      email: "alice@example.com",
      password: "securePassword123",
      displayName: "Alice",
    };
    const result = RegisterSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email or short password in registration", () => {
    expect(
      RegisterSchema.safeParse({
        email: "notanemail",
        password: "123",
        displayName: "A",
      }).success,
    ).toBe(false);
  });

  it("validates login payload", () => {
    expect(
      LoginSchema.safeParse({
        email: "bob@example.com",
        password: "anyPassword",
      }).success,
    ).toBe(true);
  });

  it("validates and defaults office creation", () => {
    const result = CreateOfficeSchema.safeParse({
      name: "Engineering HQ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accessPolicy).toBe("public");
      expect(result.data.dimensions.width).toBe(1600);
    }
  });

  it("validates movement input payload and rejects negative/infinite", () => {
    expect(
      MovementInputSchema.safeParse({
        sequence: 1,
        proposedPosition: { x: 100, y: 150 },
        dt: 0.05,
      }).success,
    ).toBe(true);

    expect(
      MovementInputSchema.safeParse({
        sequence: -1,
        proposedPosition: { x: Infinity, y: 150 },
        dt: -0.1,
      }).success,
    ).toBe(false);
  });

  it("validates signaling envelope payload", () => {
    const envelope = {
      type: "offer",
      roomId: "office-101",
      peerId: "user-2",
      connectionId: "conn-123",
      payload: { sdp: "v=0..." },
      timestamp: Date.now(),
    };
    expect(SignalingEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it("validates proximity transition payload", () => {
    const transition = {
      peerId: "user-2",
      distance: 65.5,
      state: "entered",
      since: Date.now(),
      occlusionFactor: 0.8,
    };
    expect(ProximityTransitionSchema.safeParse(transition).success).toBe(true);
  });
});
