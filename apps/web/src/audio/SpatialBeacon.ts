import { Point, segmentsIntersect, Wall } from "@proxispeak/shared";

export class SpatialBeacon {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private oscillators: OscillatorNode[] = [];
  private gainNode: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;

  public position: Point = { x: 1250, y: 280 }; // Lounge Radio Beacon
  public label = "Lounge Lo-Fi Beacon";

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public start(): void {
    if (this.isPlaying) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

      this.pannerNode = this.ctx.createStereoPanner();
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = "lowpass";
      this.filterNode.frequency.setValueAtTime(8000, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(1.5, this.ctx.currentTime);

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.01, this.ctx.currentTime);

      // Create warm ambient multi-voice drone (D-minor chord: D3, F3, A3, C4)
      const freqs = [146.83, 174.61, 220.0, 261.63];
      this.oscillators = freqs.map((freq) => {
        const osc = this.ctx!.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
        osc.connect(this.gainNode!);
        osc.start();
        return osc;
      });

      this.gainNode.connect(this.filterNode);
      this.filterNode.connect(this.pannerNode);
      this.pannerNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.isPlaying = true;
    } catch (e) {
      console.warn("Failed to start spatial audio beacon:", e);
    }
  }

  public stop(): void {
    if (!this.isPlaying) return;
    this.oscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore already stopped
      }
    });
    this.oscillators = [];
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // Ignore
      }
      this.ctx = null;
    }
    this.isPlaying = false;
  }

  /**
   * Updates audio graph parameters based on local avatar position and room walls.
   */
  public update(avatarPos: Point, walls: Wall[] = []): {
    distance: number;
    volume: number;
    pan: number;
    isOccluded: boolean;
  } {
    const dx = this.position.x - avatarPos.x;
    const dy = this.position.y - avatarPos.y;
    const distance = Math.hypot(dx, dy);

    // Max hearing radius for beacon: 350px
    const maxRadius = 350;
    const minRadius = 60;

    let volume = 0;
    if (distance <= minRadius) {
      volume = 1;
    } else if (distance < maxRadius) {
      volume = minRadius / (minRadius + (distance - minRadius));
    } else {
      volume = 0;
    }

    // Check if line of sight is blocked by sound-blocking walls
    let isOccluded = false;
    for (const wall of walls) {
      if (wall.blocksSound && segmentsIntersect(avatarPos, this.position, wall.p1, wall.p2)) {
        isOccluded = true;
        volume *= wall.soundAttenuation ?? 0.3; // Muffle by attenuation factor
        break;
      }
    }

    // Calculate stereo pan: -1 (full left) to +1 (full right)
    // Normalized by 150px offset
    const pan = Math.max(-1, Math.min(1, (this.position.x - avatarPos.x) / 150));

    if (this.isPlaying && this.ctx && this.gainNode && this.pannerNode && this.filterNode) {
      const now = this.ctx.currentTime;
      // Smooth parameter ramps
      this.gainNode.gain.setTargetAtTime(Math.max(0.0001, volume * 0.4), now, 0.05);
      this.pannerNode.pan.setTargetAtTime(pan, now, 0.05);

      const targetFreq = isOccluded ? 800 : 8000;
      this.filterNode.frequency.setTargetAtTime(targetFreq, now, 0.08);
    }

    return { distance, volume, pan, isOccluded };
  }
}

export const spatialBeacon = new SpatialBeacon();
