import {
  Point,
  Wall,
  Furniture,
  OfficeDimensions,
  AvatarState,
  DEFAULT_HEARING_RADIUS,
  DEFAULT_AVATAR_RADIUS,
  segmentsIntersect,
} from "@proxispeak/shared";
import { MovementController } from "../movement/MovementController.js";
import { spatialBeacon } from "../audio/SpatialBeacon.js";

export interface RemoteAvatarInterpolation {
  userId: string;
  current: Point;
  target: Point;
  lastTimestamp: number;
  facingAngle: number;
}

export interface FloatingEmote {
  id: string;
  emoji: string;
  x: number;
  y: number;
  progress: number; // 0 to 1
}

export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private lastTime: number = performance.now();
  private resizeObserver: ResizeObserver | null = null;

  private movementController: MovementController | null = null;
  private remotePositions = new Map<string, RemoteAvatarInterpolation>();
  private floatingEmotes: FloatingEmote[] = [];

  // State references (mutable, avoids React overhead)
  private dimensions: OfficeDimensions = { width: 1600, height: 1200 };
  private walls: Wall[] = [];
  private furniture: Furniture[] = [];
  private localAvatar: AvatarState | null = null;
  private remoteAvatars: Map<string, AvatarState> = new Map();

  // Camera & Visual Options
  private zoom: number = 1.0;
  private targetZoom: number = 1.0;
  public showSoundRays: boolean = true;
  public showMiniMap: boolean = true;

  // Performance tracking
  private fps: number = 60;
  private frameCount: number = 0;
  private fpsTimer: number = performance.now();
  private animTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not acquire 2D canvas context");
    this.ctx = ctx;

    this.setupResizeHandling();
    this.setupZoomHandling();
    this.startLoop();
  }

  public setMovementController(controller: MovementController): void {
    this.movementController = controller;
  }

  public updateLayout(dimensions: OfficeDimensions, walls: Wall[], furniture: Furniture[]): void {
    this.dimensions = dimensions;
    this.walls = walls;
    this.furniture = furniture;
  }

  public updateLocalAvatar(avatar: AvatarState): void {
    this.localAvatar = avatar;
  }

  public updateRemoteAvatars(avatars: Record<string, AvatarState>): void {
    this.remoteAvatars.clear();
    for (const [id, avatar] of Object.entries(avatars)) {
      this.remoteAvatars.set(id, avatar);

      let interp = this.remotePositions.get(id);
      if (!interp) {
        interp = {
          userId: id,
          current: { ...avatar.position },
          target: { ...avatar.position },
          lastTimestamp: performance.now(),
          facingAngle: 0,
        };
        this.remotePositions.set(id, interp);
      } else {
        const dx = avatar.position.x - interp.current.x;
        const dy = avatar.position.y - interp.current.y;
        if (Math.hypot(dx, dy) > 1) {
          interp.facingAngle = Math.atan2(dy, dx);
        }
        interp.target = { ...avatar.position };
        interp.lastTimestamp = performance.now();
      }
    }
  }

  public onRemotePositionUpdate(userId: string, targetPos: Point): void {
    let interp = this.remotePositions.get(userId);
    if (!interp) {
      interp = {
        userId,
        current: { ...targetPos },
        target: { ...targetPos },
        lastTimestamp: performance.now(),
        facingAngle: 0,
      };
      this.remotePositions.set(userId, interp);
    } else {
      const dx = targetPos.x - interp.current.x;
      const dy = targetPos.y - interp.current.y;
      if (Math.hypot(dx, dy) > 1) {
        interp.facingAngle = Math.atan2(dy, dx);
      }
      interp.target = { ...targetPos };
      interp.lastTimestamp = performance.now();
    }
  }

  public triggerEmote(emoji: string, pos?: Point): void {
    const p = pos || (this.localAvatar ? this.localAvatar.position : { x: 800, y: 600 });
    this.floatingEmotes.push({
      id: Math.random().toString(),
      emoji,
      x: p.x + (Math.random() * 20 - 10),
      y: p.y - 20,
      progress: 0,
    });
  }

  public setZoom(z: number): void {
    this.targetZoom = Math.max(0.6, Math.min(1.8, z));
  }

  public zoomIn(): void {
    this.setZoom(this.targetZoom + 0.15);
  }

  public zoomOut(): void {
    this.setZoom(this.targetZoom - 0.15);
  }

  public resetZoom(): void {
    this.setZoom(1.0);
  }

  public getZoom(): number {
    return this.targetZoom;
  }

  private setupZoomHandling(): void {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      this.setZoom(this.targetZoom + delta);
    };
    this.canvas.addEventListener("wheel", handleWheel, { passive: false });
  }

  private setupResizeHandling(): void {
    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    };

    this.resizeObserver = new ResizeObserver(() => handleResize());
    this.resizeObserver.observe(this.canvas);
    handleResize();
  }

  private startLoop(): void {
    const loop = (time: number) => {
      const dt = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;
      this.animTime += dt;

      // Smooth zoom interpolation
      this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 10);

      // Update movement controller
      if (this.movementController) {
        this.movementController.update(dt, this.dimensions, this.walls, this.furniture);
        const pos = this.movementController.getPosition();
        if (this.localAvatar) {
          this.localAvatar.position = pos;
        }
      }

      // Smoothly interpolate remote avatars
      for (const interp of this.remotePositions.values()) {
        const lerpFactor = Math.min(1.0, dt * 14);
        interp.current.x += (interp.target.x - interp.current.x) * lerpFactor;
        interp.current.y += (interp.target.y - interp.current.y) * lerpFactor;
      }

      // Update spatial beacon audio graph if playing
      if (this.localAvatar) {
        spatialBeacon.update(this.localAvatar.position, this.walls);
      }

      // Update floating emotes
      for (let i = this.floatingEmotes.length - 1; i >= 0; i--) {
        const emote = this.floatingEmotes[i]!;
        emote.progress += dt * 0.7; // ~1.4s duration
        emote.y -= dt * 35; // float upward
        if (emote.progress >= 1) {
          this.floatingEmotes.splice(i, 1);
        }
      }

      // Render frame
      this.render();

      // FPS tracking
      this.frameCount++;
      if (time - this.fpsTimer >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.fpsTimer = time;
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private render(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const ctx = this.ctx;

    const camX = this.localAvatar ? this.localAvatar.position.x : width / 2;
    const camY = this.localAvatar ? this.localAvatar.position.y : height / 2;

    ctx.save();
    // 1. Dark space backdrop
    ctx.fillStyle = "#05070e";
    ctx.fillRect(0, 0, width, height);

    // Apply Camera Transform (Centered + Zoom)
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-camX, -camY);

    // 2. Draw Office Floor
    this.renderFloor(ctx);

    // 3. Draw Room Zones & Signs
    this.renderRoomZones(ctx);

    // 4. Draw Furniture Objects
    this.renderFurniture(ctx);

    // 5. Draw Walls (Glass vs Acoustic Drywall)
    this.renderWalls(ctx);

    // 6. Draw Spatial Audio Beacon (Lounge Radio)
    this.renderSpatialBeacon(ctx);

    // 7. Draw Occlusion Sound Rays (if enabled)
    if (this.showSoundRays && this.localAvatar) {
      this.renderSoundRays(ctx);
    }

    // 8. Draw Target Click-to-Move Waypoint
    if (this.movementController) {
      const target = this.movementController.getTargetPoint();
      if (target) {
        this.renderWaypoint(ctx, target);
      }
    }

    // 9. Draw Remote Avatars
    for (const [id, avatar] of this.remoteAvatars.entries()) {
      const interp = this.remotePositions.get(id);
      const pos = interp ? interp.current : avatar.position;
      const angle = interp ? interp.facingAngle : 0;
      this.drawAvatar(pos, avatar.displayName, avatar.avatarColor, false, avatar.isMuted, angle);
    }

    // 10. Draw Local Avatar with Hearing Radar
    if (this.localAvatar) {
      const angle = this.movementController ? this.movementController.getFacingAngle() : 0;
      this.drawLocalHearingRadar(ctx, this.localAvatar.position);
      this.drawAvatar(
        this.localAvatar.position,
        `${this.localAvatar.displayName} (You)`,
        this.localAvatar.avatarColor,
        true,
        this.localAvatar.isMuted,
        angle,
      );
    }

    // 11. Draw Floating Emote Reactions
    this.renderEmotes(ctx);

    ctx.restore();

    // 12. Screen Overlays (Heads-Up Display)
    this.renderHUD(ctx, width, height);

    // 13. Corner Mini-Map Radar (bottom-left)
    if (this.showMiniMap) {
      this.renderMiniMap(ctx, width, height, camX, camY);
    }
  }

  private renderFloor(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.dimensions;

    // Architectural floor base
    ctx.fillStyle = "#0a0f1d";
    ctx.fillRect(0, 0, width, height);

    // Floor grid tiles (64px modern architectural grid)
    const tileSize = 64;
    ctx.strokeStyle = "rgba(30, 41, 59, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x += tileSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += tileSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Grid dot accents at intersections
    ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
    for (let x = 0; x <= width; x += tileSize * 2) {
      for (let y = 0; y <= height; y += tileSize * 2) {
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }

    // Outer office border glow
    ctx.strokeStyle = "rgba(6, 182, 212, 0.3)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, width, height);
  }

  private renderRoomZones(ctx: CanvasRenderingContext2D): void {
    const zones = [
      { name: "EXECUTIVE BOARDROOM", x: 60, y: 60, w: 480, h: 480, color: "rgba(59, 130, 246, 0.04)" },
      { name: "CENTRAL LOBBY & RECEPTION", x: 600, y: 150, w: 400, h: 350, color: "rgba(16, 185, 129, 0.03)" },
      { name: "LOUNGE & COFFEE BAR", x: 1050, y: 60, w: 490, h: 480, color: "rgba(245, 158, 11, 0.04)" },
      { name: "OPEN COLLABORATION HUB", x: 60, y: 600, w: 700, h: 540, color: "rgba(168, 85, 247, 0.03)" },
      { name: "FOCUS PODS & SILENT LAB", x: 860, y: 600, w: 680, h: 540, color: "rgba(6, 182, 212, 0.03)" },
    ];

    for (const z of zones) {
      // Subtle zone tint
      ctx.fillStyle = z.color;
      ctx.fillRect(z.x, z.y, z.w, z.h);

      // Chic architectural room header tag
      ctx.save();
      ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
      ctx.font = "bold 10px Outfit, sans-serif";
      ctx.letterSpacing = "1.5px";
      ctx.fillText(z.name, z.x + 16, z.y + 24);
      ctx.restore();
    }
  }

  private renderFurniture(ctx: CanvasRenderingContext2D): void {
    for (const item of this.furniture) {
      ctx.save();

      // Deep ambient occlusion shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.beginPath();
      ctx.roundRect(item.x + 4, item.y + 4, item.width, item.height, 8);
      ctx.fill();

      const isConf = item.label?.toLowerCase().includes("conference") || item.label?.toLowerCase().includes("table");
      const isLounge = item.label?.toLowerCase().includes("sofa") || item.label?.toLowerCase().includes("coffee");
      const isDesk = item.label?.toLowerCase().includes("desk");

      if (isConf) {
        // Polished mahogany / walnut conference table
        const grad = ctx.createLinearGradient(item.x, item.y, item.x, item.y + item.height);
        grad.addColorStop(0, "#292524");
        grad.addColorStop(1, "#1c1917");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.width, item.height, 12);
        ctx.fill();

        ctx.strokeStyle = "rgba(214, 211, 209, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Little conference chairs around table
        ctx.fillStyle = "#3b4252";
        const chairRadius = 6;
        for (let cx = item.x + 25; cx < item.x + item.width; cx += 35) {
          ctx.beginPath();
          ctx.arc(cx, item.y - 4, chairRadius, 0, Math.PI * 2);
          ctx.arc(cx, item.y + item.height + 4, chairRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (isLounge) {
        // Modern rounded sofa / lounge bench
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.width, item.height, 10);
        ctx.fill();
        ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (isDesk) {
        // Tech workstations
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.width, item.height, 6);
        ctx.fill();
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Glowing workstation dual-monitor setup
        ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
        ctx.fillRect(item.x + item.width / 2 - 16, item.y + item.height / 2 - 2, 14, 4);
        ctx.fillRect(item.x + item.width / 2 + 2, item.y + item.height / 2 - 2, 14, 4);
      } else {
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.width, item.height, 6);
        ctx.fill();
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Elegant furniture label
      if (item.label) {
        ctx.fillStyle = "rgba(203, 213, 225, 0.8)";
        ctx.font = "bold 9px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(item.label, item.x + item.width / 2, item.y + item.height / 2 + 3);
      }

      ctx.restore();
    }
  }

  private renderWalls(ctx: CanvasRenderingContext2D): void {
    for (const wall of this.walls) {
      ctx.save();
      const isSoundproof = wall.blocksSound;

      // 1. Shadow beneath wall
      ctx.beginPath();
      ctx.moveTo(wall.p1.x + 3, wall.p1.y + 3);
      ctx.lineTo(wall.p2.x + 3, wall.p2.y + 3);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.stroke();

      // 2. Main Wall Body
      ctx.beginPath();
      ctx.moveTo(wall.p1.x, wall.p1.y);
      ctx.lineTo(wall.p2.x, wall.p2.y);
      ctx.lineWidth = 8;
      ctx.strokeStyle = isSoundproof ? "#1e293b" : "rgba(14, 116, 144, 0.7)"; // Heavy acoustic vs Glass
      ctx.lineCap = "round";
      ctx.stroke();

      // 3. Highlight Core / Glass Sheen
      ctx.beginPath();
      ctx.moveTo(wall.p1.x, wall.p1.y);
      ctx.lineTo(wall.p2.x, wall.p2.y);
      ctx.lineWidth = 3;
      ctx.strokeStyle = isSoundproof ? "#38bdf8" : "rgba(165, 243, 252, 0.9)";
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderSpatialBeacon(ctx: CanvasRenderingContext2D): void {
    const b = spatialBeacon.position;
    const isPlaying = spatialBeacon.getIsPlaying();

    ctx.save();
    // Pulse animation
    const pulse = (Math.sin(this.animTime * 3) + 1) / 2;

    if (isPlaying) {
      // Radiating audio rings
      for (let r = 25; r <= 80; r += 20) {
        const ringRad = r + pulse * 10;
        ctx.beginPath();
        ctx.arc(b.x, b.y, ringRad, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 158, 11, ${(1 - r / 100) * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Outer glow
    ctx.beginPath();
    ctx.arc(b.x, b.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = isPlaying ? "rgba(245, 158, 11, 0.25)" : "rgba(100, 116, 139, 0.2)";
    ctx.fill();

    // Beacon Core Body
    ctx.beginPath();
    ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = isPlaying ? "#f59e0b" : "#64748b";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Speaker / Music Note icon text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🎵", b.x, b.y + 4);

    // Label tag
    ctx.font = "bold 9px Outfit, sans-serif";
    ctx.fillStyle = isPlaying ? "#fcd34d" : "#94a3b8";
    ctx.fillText("Spatial Lounge Jukebox", b.x, b.y - 18);

    ctx.restore();
  }

  private renderSoundRays(ctx: CanvasRenderingContext2D): void {
    if (!this.localAvatar) return;
    const selfPos = this.localAvatar.position;

    const targets: { name: string; pos: Point }[] = [];
    for (const remote of this.remoteAvatars.values()) {
      const interp = this.remotePositions.get(remote.userId);
      targets.push({ name: remote.displayName, pos: interp ? interp.current : remote.position });
    }
    targets.push({ name: "Jukebox", pos: spatialBeacon.position });

    for (const t of targets) {
      const dist = Math.hypot(t.pos.x - selfPos.x, t.pos.y - selfPos.y);
      if (dist > 350) continue; // Only show rays within relevant zone

      let isBlocked = false;
      for (const wall of this.walls) {
        if (wall.blocksSound && segmentsIntersect(selfPos, t.pos, wall.p1, wall.p2)) {
          isBlocked = true;
          break;
        }
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(selfPos.x, selfPos.y);
      ctx.lineTo(t.pos.x, t.pos.y);
      ctx.lineWidth = 1.5;
      if (isBlocked) {
        ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = "rgba(16, 185, 129, 0.45)";
        ctx.setLineDash([2, 2]);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderWaypoint(ctx: CanvasRenderingContext2D, target: Point): void {
    ctx.save();
    const pulse = (Math.sin(this.animTime * 6) + 1) / 2;

    // Expanding concentric beacon rings
    ctx.beginPath();
    ctx.arc(target.x, target.y, 8 + pulse * 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(6, 182, 212, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Central target dot
    ctx.beginPath();
    ctx.arc(target.x, target.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#06b6d4";
    ctx.fill();

    // Connecting dashed navigation beam from avatar to target
    if (this.localAvatar) {
      ctx.beginPath();
      ctx.moveTo(this.localAvatar.position.x, this.localAvatar.position.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = "rgba(6, 182, 212, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawLocalHearingRadar(ctx: CanvasRenderingContext2D, pos: Point): void {
    ctx.save();

    // 1. Ambient Illumination Field (Radial gradient)
    const glow = ctx.createRadialGradient(pos.x, pos.y, 10, pos.x, pos.y, DEFAULT_HEARING_RADIUS * 1.4);
    glow.addColorStop(0, "rgba(6, 182, 212, 0.12)");
    glow.addColorStop(0.6, "rgba(6, 182, 212, 0.04)");
    glow.addColorStop(1, "rgba(6, 182, 212, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, DEFAULT_HEARING_RADIUS * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // 2. 100px Hearing Perimeter Ring
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, DEFAULT_HEARING_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(6, 182, 212, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    // 3. Subtle animated radar sweep line
    const sweepAngle = (this.animTime * 1.5) % (Math.PI * 2);
    const sweepX = pos.x + Math.cos(sweepAngle) * DEFAULT_HEARING_RADIUS;
    const sweepY = pos.y + Math.sin(sweepAngle) * DEFAULT_HEARING_RADIUS;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(sweepX, sweepY);
    ctx.strokeStyle = "rgba(6, 182, 212, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  private drawAvatar(
    pos: Point,
    name: string,
    color: string,
    isLocal: boolean,
    isMuted: boolean,
    facingAngle: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();

    // Shadow
    ctx.beginPath();
    ctx.arc(pos.x + 2, pos.y + 3, DEFAULT_AVATAR_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fill();

    // Outer Halo Pulse Ring (Local avatar)
    if (isLocal) {
      const pulse = (Math.sin(this.animTime * 4) + 1) / 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, DEFAULT_AVATAR_RADIUS + 4 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(6, 182, 212, 0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Directional Facing Cone / Vision Flashlight
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(facingAngle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, DEFAULT_AVATAR_RADIUS + 10, -0.4, 0.4);
    ctx.closePath();
    ctx.fillStyle = isLocal ? "rgba(6, 182, 212, 0.18)" : "rgba(255, 255, 255, 0.1)";
    ctx.fill();

    // Directional Eye / Visor Marker
    ctx.beginPath();
    ctx.arc(DEFAULT_AVATAR_RADIUS - 3, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    // Avatar Core Body
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, DEFAULT_AVATAR_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Initials in center
    ctx.fillStyle = "#000000";
    ctx.font = "bold 10px Outfit, sans-serif";
    ctx.textAlign = "center";
    const initial = (name.replace("(You)", "").trim().charAt(0) || "U").toUpperCase();
    ctx.fillText(initial, pos.x, pos.y + 3.5);

    // Floating Name Tag Pill
    const tagY = pos.y - DEFAULT_AVATAR_RADIUS - 10;
    ctx.font = "bold 10px Outfit, sans-serif";
    const tagWidth = ctx.measureText(name).width + 16;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(pos.x - tagWidth / 2, tagY - 10, tagWidth, 16, 8);
    ctx.fill();
    ctx.strokeStyle = isLocal ? "rgba(6, 182, 212, 0.5)" : "rgba(71, 85, 105, 0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(name, pos.x, tagY + 2);

    // Muted Status Badge
    if (isMuted) {
      ctx.beginPath();
      ctx.arc(pos.x + 12, pos.y - 12, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#f43f5e";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "8px sans-serif";
      ctx.fillText("✕", pos.x + 12, pos.y - 9.5);
    }

    ctx.restore();
  }

  private renderEmotes(ctx: CanvasRenderingContext2D): void {
    for (const emote of this.floatingEmotes) {
      ctx.save();
      const alpha = 1 - emote.progress;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = "24px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(emote.emoji, emote.x, emote.y);
      ctx.restore();
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D, _width: number, _height: number): void {
    ctx.save();
    // Top-left Performance & Telemetry Pill
    const hudW = 180;
    const hudH = 50;
    ctx.fillStyle = "rgba(10, 15, 29, 0.85)";
    ctx.beginPath();
    ctx.roundRect(14, 14, hudW, hudH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(51, 65, 85, 0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "bold 11px Outfit, monospace";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`⚡ 60 FPS (${this.fps} FPS) | Zoom: ${Math.round(this.zoom * 100)}%`, 24, 33);

    if (this.localAvatar) {
      ctx.font = "10px Outfit, monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(
        `📍 Pos: (${Math.round(this.localAvatar.position.x)}, ${Math.round(this.localAvatar.position.y)})`,
        24,
        50,
      );
    }
    ctx.restore();
  }

  private renderMiniMap(
    ctx: CanvasRenderingContext2D,
    screenWidth: number,
    screenHeight: number,
    camX: number,
    camY: number,
  ): void {
    const mapW = 180;
    const mapH = 135;
    const mapX = 16;
    const mapY = screenHeight - mapH - 70; // Position above bottom dock

    const scaleX = mapW / this.dimensions.width;
    const scaleY = mapH / this.dimensions.height;

    ctx.save();
    // Mini-map Background Glass
    ctx.fillStyle = "rgba(10, 15, 29, 0.88)";
    ctx.beginPath();
    ctx.roundRect(mapX, mapY, mapW, mapH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mini-map Title
    ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
    ctx.font = "bold 9px Outfit, sans-serif";
    ctx.letterSpacing = "1px";
    ctx.fillText("RADAR MINIMAP", mapX + 8, mapY + 12);

    // Mini-map Walls
    ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
    ctx.lineWidth = 1.5;
    for (const wall of this.walls) {
      ctx.beginPath();
      ctx.moveTo(mapX + wall.p1.x * scaleX, mapY + wall.p1.y * scaleY);
      ctx.lineTo(mapX + wall.p2.x * scaleX, mapY + wall.p2.y * scaleY);
      ctx.stroke();
    }

    // Mini-map Furniture
    ctx.fillStyle = "rgba(71, 85, 105, 0.4)";
    for (const f of this.furniture) {
      ctx.fillRect(mapX + f.x * scaleX, mapY + f.y * scaleY, f.width * scaleX, f.height * scaleY);
    }

    // Mini-map Spatial Beacon
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(
      mapX + spatialBeacon.position.x * scaleX,
      mapY + spatialBeacon.position.y * scaleY,
      3,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Mini-map Remote Avatars
    for (const remote of this.remoteAvatars.values()) {
      const interp = this.remotePositions.get(remote.userId);
      const pos = interp ? interp.current : remote.position;
      ctx.fillStyle = remote.avatarColor;
      ctx.beginPath();
      ctx.arc(mapX + pos.x * scaleX, mapY + pos.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mini-map Local Avatar Dot + Hearing Circle
    if (this.localAvatar) {
      const lx = mapX + this.localAvatar.position.x * scaleX;
      const ly = mapY + this.localAvatar.position.y * scaleY;

      ctx.beginPath();
      ctx.arc(lx, ly, DEFAULT_HEARING_RADIUS * scaleX, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#06b6d4";
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Viewport Frustum Box
    const viewW = (screenWidth / this.zoom) * scaleX;
    const viewH = (screenHeight / this.zoom) * scaleY;
    const viewX = mapX + camX * scaleX - viewW / 2;
    const viewY = mapY + camY * scaleY - viewH / 2;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(viewX, viewY, viewW, viewH);

    ctx.restore();
  }

  public destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}
