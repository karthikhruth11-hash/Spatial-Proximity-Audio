import {
  Point,
  Wall,
  Furniture,
  OfficeDimensions,
  circleIntersectsSegment,
  circleIntersectsBox,
  DEFAULT_AVATAR_RADIUS,
} from "@proxispeak/shared";
import { RealtimeClient } from "../realtime/RealtimeClient.js";

export interface PendingMovement {
  sequence: number;
  dx: number;
  dy: number;
  dt: number;
  predicted: Point;
}

export class MovementController {
  private activeKeys = new Set<string>();
  private currentSequence = 0;
  private pendingMovements: PendingMovement[] = [];
  private currentPosition: Point = { x: 300, y: 300 };
  private speedPxPerSec = 200; // Client nominal walking speed
  private realtimeClient: RealtimeClient;

  private targetPoint: Point | null = null; // Click-to-move support
  private facingAngle = 0; // Facing angle in radians
  private onPositionUpdate: (pos: Point, seq: number) => void;

  public getFacingAngle(): number {
    return this.facingAngle;
  }

  public getTargetPoint(): Point | null {
    return this.targetPoint;
  }

  public isMoving(): boolean {
    return this.activeKeys.size > 0 || this.targetPoint !== null;
  }

  constructor(
    realtimeClient: RealtimeClient,
    initialPos: Point,
    onPositionUpdate: (pos: Point, seq: number) => void,
  ) {
    this.realtimeClient = realtimeClient;
    this.currentPosition = { ...initialPos };
    this.onPositionUpdate = onPositionUpdate;
  }

  public setPosition(pos: Point): void {
    this.currentPosition = { ...pos };
    this.pendingMovements = [];
    this.targetPoint = null;
  }

  public getPosition(): Point {
    return { ...this.currentPosition };
  }

  public handleKeyDown(key: string): void {
    this.activeKeys.add(key.toLowerCase());
    this.targetPoint = null; // Cancel click-to-move on manual key press
  }

  public handleKeyUp(key: string): void {
    this.activeKeys.delete(key.toLowerCase());
  }

  public handleClickToMove(target: Point): void {
    this.targetPoint = { ...target };
  }

  /**
   * Called every animation frame by CanvasEngine rAF loop.
   */
  public update(
    dt: number,
    dimensions: OfficeDimensions,
    walls: Wall[],
    furniture: Furniture[],
  ): void {
    let moveX = 0;
    let moveY = 0;

    // 1. Keyboard movement
    if (this.activeKeys.has("w") || this.activeKeys.has("arrowup")) moveY -= 1;
    if (this.activeKeys.has("s") || this.activeKeys.has("arrowdown")) moveY += 1;
    if (this.activeKeys.has("a") || this.activeKeys.has("arrowleft")) moveX -= 1;
    if (this.activeKeys.has("d") || this.activeKeys.has("arrowright")) moveX += 1;

    // 2. Click-to-move interpolation
    if (this.targetPoint && moveX === 0 && moveY === 0) {
      const dx = this.targetPoint.x - this.currentPosition.x;
      const dy = this.targetPoint.y - this.currentPosition.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 4) {
        this.targetPoint = null;
      } else {
        moveX = dx / dist;
        moveY = dy / dist;
      }
    }

    if (moveX === 0 && moveY === 0) return;

    // Normalize diagonal velocity
    const len = Math.hypot(moveX, moveY);
    const normX = (moveX / len) * this.speedPxPerSec * dt;
    const normY = (moveY / len) * this.speedPxPerSec * dt;
    this.facingAngle = Math.atan2(normY, normX);

    // Proposed new position
    const proposed: Point = {
      x: this.currentPosition.x + normX,
      y: this.currentPosition.y + normY,
    };

    // Client-side collision check for instant local feedback
    if (this.checkCollision(proposed, dimensions, walls, furniture)) {
      // Try sliding along single axes if diagonal blocked
      const slideX = { x: proposed.x, y: this.currentPosition.y };
      const slideY = { x: this.currentPosition.x, y: proposed.y };

      if (!this.checkCollision(slideX, dimensions, walls, furniture)) {
        proposed.x = slideX.x;
        proposed.y = slideX.y;
      } else if (!this.checkCollision(slideY, dimensions, walls, furniture)) {
        proposed.x = slideY.x;
        proposed.y = slideY.y;
      } else {
        return; // Fully blocked
      }
    }

    this.currentPosition = proposed;
    this.currentSequence++;

    const pending: PendingMovement = {
      sequence: this.currentSequence,
      dx: normX,
      dy: normY,
      dt,
      predicted: { ...proposed },
    };
    this.pendingMovements.push(pending);

    // Notify local store and canvas
    this.onPositionUpdate(this.currentPosition, this.currentSequence);

    // Transmit to authoritative server
    this.realtimeClient.sendMovement({
      sequence: this.currentSequence,
      proposedPosition: proposed,
      dt,
    });
  }

  /**
   * Reconciles authoritative position received from server.
   */
  public reconcile(
    ackSequence: number,
    authoritativePos: Point,
    dimensions: OfficeDimensions,
    walls: Wall[],
    furniture: Furniture[],
  ): void {
    // Remove all acknowledged movements up to ackSequence
    this.pendingMovements = this.pendingMovements.filter((p) => p.sequence > ackSequence);

    // Check if prediction matched authoritative pos
    let current = { ...authoritativePos };

    // Replay remaining unacknowledged inputs from authoritative position
    for (const pending of this.pendingMovements) {
      const replayed: Point = {
        x: current.x + pending.dx,
        y: current.y + pending.dy,
      };

      if (!this.checkCollision(replayed, dimensions, walls, furniture)) {
        current = replayed;
        pending.predicted = { ...current };
      }
    }

    this.currentPosition = current;
    this.onPositionUpdate(this.currentPosition, this.currentSequence);
  }

  private checkCollision(
    p: Point,
    dimensions: OfficeDimensions,
    walls: Wall[],
    furniture: Furniture[],
  ): boolean {
    // Office boundary clamp
    if (
      p.x < DEFAULT_AVATAR_RADIUS ||
      p.x > dimensions.width - DEFAULT_AVATAR_RADIUS ||
      p.y < DEFAULT_AVATAR_RADIUS ||
      p.y > dimensions.height - DEFAULT_AVATAR_RADIUS
    ) {
      return true;
    }

    const circle = { center: p, radius: DEFAULT_AVATAR_RADIUS };

    // Wall collision
    for (const wall of walls) {
      if (wall.blocksMovement && circleIntersectsSegment(circle, wall)) {
        return true;
      }
    }

    // Furniture collision
    for (const item of furniture) {
      if (item.blocksMovement) {
        const box = { x: item.x, y: item.y, width: item.width, height: item.height };
        if (circleIntersectsBox(circle, box)) {
          return true;
        }
      }
    }

    return false;
  }
}
