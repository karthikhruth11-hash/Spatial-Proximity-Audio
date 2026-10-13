import { describe, it, expect } from "vitest";
import {
  euclideanDistance,
  distanceSquared,
  segmentsIntersect,
  circleIntersectsBox,
  pointInBox,
  clampPoint,
  getGridCellCoords,
  getGridCellKey,
} from "../src/geometry/index.js";

describe("Geometry calculations", () => {
  it("calculates exact Euclidean distance and squared distance", () => {
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 160, y: 120 };
    // dx = 60, dy = 20, d2 = 3600 + 400 = 4000, sqrt = 63.2455532...
    expect(distanceSquared(p1, p2)).toBe(4000);
    expect(euclideanDistance(p1, p2)).toBeCloseTo(Math.sqrt(4000), 5);
  });

  it("handles zero distance correctly", () => {
    const p = { x: 42, y: 99 };
    expect(euclideanDistance(p, p)).toBe(0);
    expect(distanceSquared(p, p)).toBe(0);
  });

  describe("Segment-segment intersection", () => {
    it("detects regular crossing segments", () => {
      const a1 = { x: 0, y: 0 };
      const a2 = { x: 10, y: 10 };
      const b1 = { x: 0, y: 10 };
      const b2 = { x: 10, y: 0 };
      expect(segmentsIntersect(a1, a2, b1, b2)).toBe(true);
    });

    it("detects non-intersecting parallel segments", () => {
      const a1 = { x: 0, y: 0 };
      const a2 = { x: 10, y: 0 };
      const b1 = { x: 0, y: 5 };
      const b2 = { x: 10, y: 5 };
      expect(segmentsIntersect(a1, a2, b1, b2)).toBe(false);
    });

    it("detects collinear overlapping segments", () => {
      const a1 = { x: 0, y: 0 };
      const a2 = { x: 10, y: 0 };
      const b1 = { x: 5, y: 0 };
      const b2 = { x: 15, y: 0 };
      expect(segmentsIntersect(a1, a2, b1, b2)).toBe(true);
    });

    it("detects segments touching at an endpoint", () => {
      const a1 = { x: 0, y: 0 };
      const a2 = { x: 10, y: 0 };
      const b1 = { x: 10, y: 0 };
      const b2 = { x: 10, y: 10 };
      expect(segmentsIntersect(a1, a2, b1, b2)).toBe(true);
    });

    it("detects non-intersecting segments in different quadrants", () => {
      const a1 = { x: 10, y: 10 };
      const a2 = { x: 20, y: 20 };
      const b1 = { x: 100, y: 100 };
      const b2 = { x: 120, y: 120 };
      expect(segmentsIntersect(a1, a2, b1, b2)).toBe(false);
    });
  });

  describe("Box and circle tests", () => {
    const box = { x: 50, y: 50, width: 100, height: 100 };

    it("checks point inside and outside box", () => {
      expect(pointInBox({ x: 75, y: 75 }, box)).toBe(true);
      expect(pointInBox({ x: 10, y: 10 }, box)).toBe(false);
      expect(pointInBox({ x: 50, y: 50 }, box)).toBe(true); // boundary
    });

    it("clamps point to box bounds", () => {
      expect(clampPoint({ x: 200, y: -20 }, box)).toEqual({ x: 150, y: 50 });
      expect(clampPoint({ x: 80, y: 80 }, box)).toEqual({ x: 80, y: 80 });
    });

    it("detects circle collision with box", () => {
      // Circle touching or penetrating
      expect(circleIntersectsBox({ center: { x: 45, y: 75 }, radius: 10 }, box)).toBe(true);
      // Circle far away
      expect(circleIntersectsBox({ center: { x: 10, y: 10 }, radius: 10 }, box)).toBe(false);
    });
  });

  describe("Spatial grid helper", () => {
    it("computes cell coordinates and key", () => {
      const cellSize = 110;
      const coords = getGridCellCoords({ x: 250, y: 150 }, cellSize);
      expect(coords).toEqual({ cellX: 2, cellY: 1 });
      expect(getGridCellKey(coords.cellX, coords.cellY)).toBe("2:1");
    });
  });
});
