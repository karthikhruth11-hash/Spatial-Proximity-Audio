import {
  Point,
  Wall,
  Furniture,
  OfficeDimensions,
  euclideanDistance,
  segmentsIntersect,
  circleIntersectsSegment,
  circleIntersectsBox,
  DEFAULT_AVATAR_RADIUS,
} from "@proxispeak/shared";
import { env } from "../config/env.js";

export interface UserMovementState {
  userId: string;
  position: Point;
  lastSequence: number;
  lastTimestamp: number; // ms
  eventsInWindow: number;
  windowStart: number;
}

export interface MovementValidationResult {
  valid: boolean;
  position: Point;
  sequence: number;
  error?: "RATE_LIMITED" | "STALE_SEQUENCE" | "SPEED_EXCEEDED" | "COLLISION" | "OUT_OF_BOUNDS";
  rejectedPosition?: Point;
}

export class MovementEngine {
  private userStates = new Map<string, UserMovementState>();
  private readonly maxSpeed: number; // px / sec
  private readonly tolerance: number = 25; // px allowance for latency/jitter
  private readonly maxRatePerSec: number = 30; // max packets / sec

  constructor(maxSpeed: number = env.MAX_SPEED_PX_PER_SEC) {
    this.maxSpeed = maxSpeed;
  }

  public registerUser(userId: string, initialPosition: Point): void {
    this.userStates.set(userId, {
      userId,
      position: { ...initialPosition },
      lastSequence: 0,
      lastTimestamp: Date.now(),
      eventsInWindow: 0,
      windowStart: Date.now(),
    });
  }

  public unregisterUser(userId: string): void {
    this.userStates.delete(userId);
  }

  public getUserPosition(userId: string): Point | null {
    const state = this.userStates.get(userId);
    return state ? { ...state.position } : null;
  }

  public getUserState(userId: string): UserMovementState | null {
    const state = this.userStates.get(userId);
    return state ? { ...state } : null;
  }

  public validateAndApply(
    userId: string,
    proposed: Point,
    sequence: number,
    clientDt: number,
    dimensions: OfficeDimensions,
    walls: Wall[],
    furniture: Furniture[],
    now: number = Date.now(),
  ): MovementValidationResult {
    const state = this.userStates.get(userId);
    if (!state) {
      // Auto-register if not yet in memory
      this.registerUser(userId, proposed);
      return { valid: true, position: { ...proposed }, sequence };
    }

    // 1. Rate Limiting Check
    if (now - state.windowStart >= 1000) {
      state.windowStart = now;
      state.eventsInWindow = 1;
    } else {
      state.eventsInWindow++;
      if (state.eventsInWindow > this.maxRatePerSec) {
        return {
          valid: false,
          position: { ...state.position },
          sequence,
          error: "RATE_LIMITED",
          rejectedPosition: proposed,
        };
      }
    }

    // 2. Monotonic Sequence Number Check
    if (sequence <= state.lastSequence) {
      return {
        valid: false,
        position: { ...state.position },
        sequence,
        error: "STALE_SEQUENCE",
        rejectedPosition: proposed,
      };
    }

    // 3. Finite Numbers and Bounds Check
    if (!Number.isFinite(proposed.x) || !Number.isFinite(proposed.y)) {
      return {
        valid: false,
        position: { ...state.position },
        sequence,
        error: "OUT_OF_BOUNDS",
        rejectedPosition: proposed,
      };
    }

    const minX = DEFAULT_AVATAR_RADIUS;
    const maxX = dimensions.width - DEFAULT_AVATAR_RADIUS;
    const minY = DEFAULT_AVATAR_RADIUS;
    const maxY = dimensions.height - DEFAULT_AVATAR_RADIUS;

    if (proposed.x < minX || proposed.x > maxX || proposed.y < minY || proposed.y > maxY) {
      return {
        valid: false,
        position: { ...state.position },
        sequence,
        error: "OUT_OF_BOUNDS",
        rejectedPosition: proposed,
      };
    }

    // 4. Speed Limit Validation
    const elapsedSec = Math.max(0.01, (now - state.lastTimestamp) / 1000);
    const dt = Math.min(Math.max(clientDt, 0.01), 1.0);
    const effectiveDt = Math.max(dt, elapsedSec);
    const maxAllowedDistance = this.maxSpeed * effectiveDt + this.tolerance;

    const moveDistance = euclideanDistance(state.position, proposed);
    if (moveDistance > maxAllowedDistance) {
      return {
        valid: false,
        position: { ...state.position },
        sequence,
        error: "SPEED_EXCEEDED",
        rejectedPosition: proposed,
      };
    }

    // 5. Collision Checks
    const avatarCircle = {
      center: proposed,
      radius: DEFAULT_AVATAR_RADIUS,
    };

    // A. Wall collisions and tunneling check
    for (const wall of walls) {
      if (!wall.blocksMovement) continue;

      if (circleIntersectsSegment(avatarCircle, wall)) {
        return {
          valid: false,
          position: { ...state.position },
          sequence,
          error: "COLLISION",
          rejectedPosition: proposed,
        };
      }

      if (segmentsIntersect(state.position, proposed, wall.p1, wall.p2)) {
        return {
          valid: false,
          position: { ...state.position },
          sequence,
          error: "COLLISION",
          rejectedPosition: proposed,
        };
      }
    }

    // B. Furniture collisions
    for (const item of furniture) {
      if (!item.blocksMovement) continue;

      const box = {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      };

      if (circleIntersectsBox(avatarCircle, box)) {
        return {
          valid: false,
          position: { ...state.position },
          sequence,
          error: "COLLISION",
          rejectedPosition: proposed,
        };
      }
    }

    // 6. Valid Movement: Update authoritative state
    state.position = { ...proposed };
    state.lastSequence = sequence;
    state.lastTimestamp = now;

    return {
      valid: true,
      position: { ...state.position },
      sequence,
    };
  }
}
