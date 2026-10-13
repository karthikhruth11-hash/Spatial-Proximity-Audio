export type AttenuationCurve = "linear" | "inverse" | "smooth";

/**
 * Clamps a number between a minimum and maximum boundary.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Calculates raw distance gain based on distance, hearing radius, hysteresis margin, and attenuation curve.
 * Rules:
 * - If d <= 0, gain = 1.0
 * - If d > radius + margin, gain is forced to 0.0
 * - Linear curve: g = 1 - (d / radius)
 * - Inverse curve: g = 1 / (1 + (d / (radius * 0.5)))
 * - Smooth (cosine) curve: g = 0.5 * (1 + cos(pi * d / radius))
 */
export function distanceToGain(
  distance: number,
  radius: number,
  margin: number = 0,
  curve: AttenuationCurve = "linear",
  minGain: number = 0.0,
): number {
  if (distance <= 0) return 1.0;
  if (radius <= 0) return 0.0;

  // Beyond boundary + margin: sound drops completely to 0
  if (distance > radius + margin) {
    return 0.0;
  }

  // If between radius and radius + margin, smooth fade down to 0
  if (distance > radius) {
    const fadeRatio = 1 - (distance - radius) / (margin > 0 ? margin : 1);
    const clampedFade = clamp(fadeRatio, 0, 1);
    // Base gain at edge of radius (or minGain) scaled by fade down
    return minGain * clampedFade;
  }

  const normalized = distance / radius; // 0..1

  let rawGain = 0;
  switch (curve) {
    case "linear":
      rawGain = 1 - normalized;
      break;
    case "inverse":
      // Smooth falloff where near is high and gently flattens
      rawGain = 1 / (1 + normalized * 2);
      break;
    case "smooth":
      // Half cosine curve from 1 down to 0
      rawGain = 0.5 * (1 + Math.cos(Math.PI * normalized));
      break;
  }

  const scaled = rawGain * (1 - minGain) + minGain;
  return clamp(scaled, 0.0, 1.0);
}

/**
 * Calculates stereo pan (-1 to 1) based on horizontal offset between speaker and listener.
 * Pan: clamp((speaker.x - listener.x) / radius, -1, 1)
 * Positive value = speaker is to the right of listener.
 * Negative value = speaker is to the left of listener.
 */
export function calculateStereoPan(
  speakerX: number,
  listenerX: number,
  radius: number,
): number {
  if (radius <= 0) return 0;
  const offset = speakerX - listenerX;
  return clamp(offset / radius, -1.0, 1.0);
}

/**
 * Computes final gain by applying sound obstacle/occlusion attenuation factor.
 * g_final = g_distance * g_obstacle (default wall factor 0.2; soundproof walls factor 0).
 */
export function applyOcclusion(
  distanceGain: number,
  occlusionFactor: number = 1.0,
): number {
  const factor = clamp(occlusionFactor, 0.0, 1.0);
  return clamp(distanceGain * factor, 0.0, 1.0);
}
