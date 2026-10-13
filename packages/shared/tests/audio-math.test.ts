import { describe, it, expect } from "vitest";
import {
  distanceToGain,
  calculateStereoPan,
  applyOcclusion,
  clamp,
} from "../src/audio-math/index.js";

describe("Audio math pure functions", () => {
  const radius = 100;
  const margin = 10;

  describe("distanceToGain", () => {
    it("returns 1.0 when at distance 0", () => {
      expect(distanceToGain(0, radius, margin)).toBe(1.0);
    });

    it("gain is monotonic with distance for linear curve", () => {
      const g0 = distanceToGain(0, radius, margin, "linear");
      const g25 = distanceToGain(25, radius, margin, "linear");
      const g50 = distanceToGain(50, radius, margin, "linear");
      const g75 = distanceToGain(75, radius, margin, "linear");
      const g100 = distanceToGain(100, radius, margin, "linear");

      expect(g0).toBe(1.0);
      expect(g25).toBeCloseTo(0.75, 4);
      expect(g50).toBeCloseTo(0.5, 4);
      expect(g75).toBeCloseTo(0.25, 4);
      expect(g100).toBe(0.0);

      expect(g0).toBeGreaterThan(g25);
      expect(g25).toBeGreaterThan(g50);
      expect(g50).toBeGreaterThan(g75);
      expect(g75).toBeGreaterThan(g100);
    });

    it("verifies the worked example from section C1", () => {
      // Employee A at (100, 100), B at (160, 120). d = sqrt(4000) = 63.24555 px.
      // Linear gain = 1 - 0.6324555 = 0.367544
      const d = Math.sqrt(4000);
      const gain = distanceToGain(d, 100, 10, "linear");
      expect(gain).toBeCloseTo(0.3675, 3);

      // With wall (factor 0.2): 0.3675 * 0.2 = 0.0735
      const occluded = applyOcclusion(gain, 0.2);
      expect(occluded).toBeCloseTo(0.0735, 3);
    });

    it("forces gain to 0.0 beyond radius + margin", () => {
      expect(distanceToGain(110.1, radius, margin)).toBe(0.0);
      expect(distanceToGain(200, radius, margin)).toBe(0.0);
    });

    it("smooth curve yields valid 0..1 values", () => {
      const g0 = distanceToGain(0, radius, margin, "smooth");
      const g50 = distanceToGain(50, radius, margin, "smooth");
      const g100 = distanceToGain(100, radius, margin, "smooth");

      expect(g0).toBe(1.0);
      expect(g50).toBeCloseTo(0.5, 4);
      expect(g100).toBe(0.0);
    });
  });

  describe("calculateStereoPan", () => {
    it("returns 0 when speaker and listener are at identical x", () => {
      expect(calculateStereoPan(100, 100, radius)).toBe(0);
    });

    it("returns positive value when speaker is to the right of listener", () => {
      const pan = calculateStereoPan(150, 100, radius);
      expect(pan).toBe(0.5);
    });

    it("returns negative value when speaker is to the left of listener", () => {
      const pan = calculateStereoPan(50, 100, radius);
      expect(pan).toBe(-0.5);
    });

    it("clamps pan to -1.0 and 1.0 when exceeding radius", () => {
      expect(calculateStereoPan(300, 100, radius)).toBe(1.0);
      expect(calculateStereoPan(-100, 100, radius)).toBe(-1.0);
    });
  });

  describe("applyOcclusion", () => {
    it("attenuates audio according to obstacle factor", () => {
      expect(applyOcclusion(0.8, 0.5)).toBeCloseTo(0.4, 4);
      expect(applyOcclusion(0.8, 0.2)).toBeCloseTo(0.16, 4);
    });

    it("soundproof wall factor 0 completely eliminates audio", () => {
      expect(applyOcclusion(1.0, 0)).toBe(0);
      expect(applyOcclusion(0.5, 0)).toBe(0);
    });

    it("factor 1.0 does not attenuate audio", () => {
      expect(applyOcclusion(0.75, 1.0)).toBeCloseTo(0.75, 4);
    });
  });

  describe("clamp", () => {
    it("clamps numbers correctly", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });
});
