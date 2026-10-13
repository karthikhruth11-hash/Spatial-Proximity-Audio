import { describe, it, expect, beforeEach } from "vitest";
import { MovementEngine } from "../src/movement/engine.js";
import { Wall, Furniture, OfficeDimensions } from "@proxispeak/shared";

describe("Server Authoritative MovementEngine", () => {
  let engine: MovementEngine;
  const dimensions: OfficeDimensions = { width: 1600, height: 1200 };

  const testWalls: Wall[] = [
    // Wall dividing x=400, y=100..500
    {
      id: "wall-1",
      p1: { x: 400, y: 100 },
      p2: { x: 400, y: 500 },
      blocksMovement: true,
      blocksSound: true,
      soundAttenuation: 0.2,
    },
  ];

  const testFurniture: Furniture[] = [
    // Desk at x=600, y=600, width=100, height=80
    {
      id: "desk-1",
      x: 600,
      y: 600,
      width: 100,
      height: 80,
      blocksMovement: true,
      blocksSound: false,
      soundAttenuation: 1.0,
    },
  ];

  beforeEach(() => {
    engine = new MovementEngine(220); // 220 px/sec
  });

  it("registers initial position and allows legal step", () => {
    const userId = "user-1";
    engine.registerUser(userId, { x: 200, y: 200 });

    const result = engine.validateAndApply(
      userId,
      { x: 210, y: 205 },
      1,
      0.05,
      dimensions,
      testWalls,
      testFurniture,
      1000,
    );

    expect(result.valid).toBe(true);
    expect(result.position).toEqual({ x: 210, y: 205 });
    expect(result.sequence).toBe(1);
  });

  it("rejects out-of-order or stale sequence numbers", () => {
    const userId = "user-2";
    engine.registerUser(userId, { x: 200, y: 200 });

    // Step 1: seq 10 accepted
    engine.validateAndApply(
      userId,
      { x: 205, y: 200 },
      10,
      0.05,
      dimensions,
      testWalls,
      testFurniture,
      1000,
    );

    // Step 2: seq 9 (stale) rejected
    const staleResult = engine.validateAndApply(
      userId,
      { x: 210, y: 200 },
      9,
      0.05,
      dimensions,
      testWalls,
      testFurniture,
      1050,
    );

    expect(staleResult.valid).toBe(false);
    expect(staleResult.error).toBe("STALE_SEQUENCE");
    expect(staleResult.position).toEqual({ x: 205, y: 200 }); // Retains last valid
  });

  it("rejects speed-hack movement exceeding maxSpeed + tolerance", () => {
    const userId = "speedy";
    engine.registerUser(userId, { x: 200, y: 200 });

    // At 220 px/s with dt = 0.05s, max allowed delta is 220 * 0.05 + 25 = 36 px
    // Trying to teleport 300 px
    const result = engine.validateAndApply(
      userId,
      { x: 500, y: 200 },
      1,
      0.05,
      dimensions,
      testWalls,
      testFurniture,
      1050,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe("SPEED_EXCEEDED");
    expect(result.position).toEqual({ x: 200, y: 200 });
  });

  it("rejects movement outside office boundaries", () => {
    const userId = "explorer";
    engine.registerUser(userId, { x: 50, y: 50 });

    // Trying to move beyond top-left boundary (min 16 for avatar radius)
    const result = engine.validateAndApply(
      userId,
      { x: -10, y: 50 },
      1,
      0.05,
      dimensions,
      testWalls,
      testFurniture,
      1050,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe("OUT_OF_BOUNDS");
  });

  it("blocks movement colliding directly with wall", () => {
    const userId = "wall-toucher";
    // Place user right in front of wall at x=375, y=300
    engine.registerUser(userId, { x: 375, y: 300 });

    // Wall is at x=400, y=100..500. Avatar radius is 16.
    // Moving to x=395 would cause avatar circle (radius 16) to overlap x=400
    const result = engine.validateAndApply(
      userId,
      { x: 395, y: 300 },
      1,
      0.05,
      dimensions,
      testWalls,
      testFurniture,
      1050,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe("COLLISION");
  });

  it("blocks wall tunneling/hopping across walls", () => {
    const userId = "quantum-tunneler";
    // User starts at x=380, tries to step to x=420 across the wall at x=400
    engine.registerUser(userId, { x: 380, y: 300 });

    const result = engine.validateAndApply(
      userId,
      { x: 420, y: 300 },
      1,
      0.2, // large enough dt so speed test passes
      dimensions,
      testWalls,
      testFurniture,
      1200,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe("COLLISION");
  });

  it("blocks movement inside furniture bounding box", () => {
    const userId = "desk-crasher";
    // Desk at x=600..700, y=600..680
    engine.registerUser(userId, { x: 580, y: 640 });

    // Moving into desk at x=610
    const result = engine.validateAndApply(
      userId,
      { x: 610, y: 640 },
      1,
      0.05,
      dimensions,
      testWalls,
      testFurniture,
      1050,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe("COLLISION");
  });

  it("rate limits rapid inputs exceeding 30 packets per second", () => {
    const userId = "flooder";
    engine.registerUser(userId, { x: 200, y: 200 });

    let lastResult;
    const now = 1000;
    for (let i = 1; i <= 35; i++) {
      lastResult = engine.validateAndApply(
        userId,
        { x: 200 + i * 0.5, y: 200 },
        i,
        0.01,
        dimensions,
        testWalls,
        testFurniture,
        now,
      );
    }

    expect(lastResult?.valid).toBe(false);
    expect(lastResult?.error).toBe("RATE_LIMITED");
  });
});
