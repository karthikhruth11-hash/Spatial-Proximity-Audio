import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Mic,
  MicOff,
  LogOut,
  Users,
  Radio,
  Sliders,
  Shield,
  Music,
  Compass,
  ZoomIn,
  ZoomOut,
  MapPin,
  Eye,
  EyeOff,
  Navigation,
  Sparkles,
} from "lucide-react";
import { CanvasEngine } from "../canvas/CanvasEngine.js";
import { MovementController } from "../movement/MovementController.js";
import { RealtimeClient } from "../realtime/RealtimeClient.js";
import { useOfficeStore } from "../stores/useOfficeStore.js";
import { spatialBeacon } from "../audio/SpatialBeacon.js";
import {
  DEFAULT_OFFICE_DIMENSIONS,
  DEFAULT_WALLS,
  DEFAULT_FURNITURE,
} from "../stores/defaultLayout.js";

export function OfficePage() {
  const { officeId = "default-office" } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isMuted, setIsMuted] = useState(true);
  const [activeTab, setActiveTab] = useState<"peers" | "diagnostics" | "spatial">("peers");

  // Advanced feature toggles
  const [isBeaconPlaying, setIsBeaconPlaying] = useState(false);
  const [showRays, setShowRays] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(100);

  const officeStore = useOfficeStore();
  const {
    dimensions,
    layout,
    localAvatar,
    remoteAvatars,
    isConnected,
    setOfficeState,
    updateLocalPosition,
    upsertRemoteAvatar,
    removeRemoteAvatar,
    updateRemotePosition,
    setAvatarMute,
    setConnected,
  } = officeStore;

  if (typeof window !== "undefined") {
    (window as any).__OFFICE_STORE__ = useOfficeStore;
  }

  const engineRef = useRef<CanvasEngine | null>(null);
  const movementRef = useRef<MovementController | null>(null);
  const realtimeRef = useRef<RealtimeClient | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Initialize CanvasEngine
    const engine = new CanvasEngine(canvas);
    engine.showSoundRays = showRays;
    engine.showMiniMap = showMiniMap;
    engineRef.current = engine;

    // 2. Initialize RealtimeClient
    const realtime = new RealtimeClient({
      onConnectionChange: (connected) => {
        setConnected(connected);
      },
      onOfficeState: (state) => {
        setOfficeState(
          state.officeId,
          state.dimensions,
          state.layout,
          state.self,
          state.avatars,
        );

        engine.updateLayout(state.dimensions, state.layout.walls, state.layout.furniture);
        engine.updateLocalAvatar(state.self);

        // Initialize MovementController with server-authoritative self position
        const controller = new MovementController(
          realtime,
          state.self.position,
          (pos, seq) => {
            updateLocalPosition(pos, seq);
            engine.updateLocalAvatar({
              ...state.self,
              position: pos,
              lastSequence: seq,
            });
          },
        );
        movementRef.current = controller;
        engine.setMovementController(controller);
      },
      onUserJoined: (avatar) => {
        upsertRemoteAvatar(avatar);
      },
      onUserLeft: (userId) => {
        removeRemoteAvatar(userId);
      },
      onMovementAccepted: (ack) => {
        if (movementRef.current && layout) {
          movementRef.current.reconcile(
            ack.sequence,
            ack.position,
            dimensions,
            layout.walls,
            layout.furniture,
          );
        }
      },
      onMovementUpdated: (update) => {
        updateRemotePosition(update.userId, update.position, update.sequence);
        engine.onRemotePositionUpdate(update.userId, update.position);
      },
      onMuteUpdated: (userId, muted) => {
        setAvatarMute(userId, muted);
      },
    });

    realtimeRef.current = realtime;
    const token = localStorage.getItem("proxispeak_token") || undefined;
    realtime.connect(token);
    realtime.joinOffice(officeId);

    // 3. Fallback for Static / GitHub Pages Demo Mode (if no backend running)
    const demoFallbackTimer = setTimeout(() => {
      const state = useOfficeStore.getState();
      if (!state.localAvatar) {
        let storedUser = null;
        try {
          const raw = localStorage.getItem("proxispeak_user");
          if (raw) storedUser = JSON.parse(raw);
        } catch {
          // ignore
        }

        const selfAvatar = {
          userId: storedUser?.id || "local-user",
          displayName: storedUser?.displayName || "Guest Explorer",
          avatarColor: storedUser?.avatarColor || "#06b6d4",
          position: { x: 700, y: 300 },
          lastSequence: 0,
          isMuted: true,
        };

        const demoPeers = [
          {
            userId: "peer-sarah",
            displayName: "Sarah (Design)",
            avatarColor: "#ec4899",
            position: { x: 760, y: 310 },
            lastSequence: 0,
            isMuted: false,
          },
          {
            userId: "peer-alex",
            displayName: "Alex (Tech)",
            avatarColor: "#8b5cf6",
            position: { x: 1210, y: 320 },
            lastSequence: 0,
            isMuted: true,
          },
        ];

        setOfficeState(
          officeId,
          DEFAULT_OFFICE_DIMENSIONS,
          {
            officeId,
            layoutVersion: 1,
            walls: DEFAULT_WALLS,
            furniture: DEFAULT_FURNITURE,
          },
          selfAvatar,
          demoPeers,
        );

        engine.updateLayout(DEFAULT_OFFICE_DIMENSIONS, DEFAULT_WALLS, DEFAULT_FURNITURE);
        engine.updateLocalAvatar(selfAvatar);
        const peersMap: Record<string, typeof selfAvatar> = {};
        demoPeers.forEach((p) => {
          peersMap[p.userId] = p;
        });
        engine.updateRemoteAvatars(peersMap);

        const controller = new MovementController(
          realtime,
          selfAvatar.position,
          (pos, seq) => {
            updateLocalPosition(pos, seq);
            engine.updateLocalAvatar({
              ...selfAvatar,
              position: pos,
              lastSequence: seq,
            });
          },
        );
        movementRef.current = controller;
        engine.setMovementController(controller);
      }
    }, 1200);

    // 4. Setup Keyboard Controls
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      movementRef.current?.handleKeyDown(e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      movementRef.current?.handleKeyUp(e.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      clearTimeout(demoFallbackTimer);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      spatialBeacon.stop();
      realtime.leaveOffice();
      realtime.disconnect();
      engine.destroy();
    };
  }, [officeId]);

  // Sync remote avatars with canvas engine whenever store updates
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateRemoteAvatars(remoteAvatars);
    }
  }, [remoteAvatars]);

  const handleMuteToggle = () => {
    const next = !isMuted;
    setIsMuted(next);
    realtimeRef.current?.setMuteState(next);
  };

  const handleBeaconToggle = () => {
    const active = spatialBeacon.toggle();
    setIsBeaconPlaying(active);
  };

  const handleToggleRays = () => {
    const next = !showRays;
    setShowRays(next);
    if (engineRef.current) {
      engineRef.current.showSoundRays = next;
    }
  };

  const handleToggleMiniMap = () => {
    const next = !showMiniMap;
    setShowMiniMap(next);
    if (engineRef.current) {
      engineRef.current.showMiniMap = next;
    }
  };

  const handleZoomIn = () => {
    engineRef.current?.zoomIn();
    if (engineRef.current) {
      setCurrentZoom(Math.round(engineRef.current.getZoom() * 100));
    }
  };

  const handleZoomOut = () => {
    engineRef.current?.zoomOut();
    if (engineRef.current) {
      setCurrentZoom(Math.round(engineRef.current.getZoom() * 100));
    }
  };

  const handleZoomReset = () => {
    engineRef.current?.resetZoom();
    setCurrentZoom(100);
  };

  const handleEmote = (emoji: string) => {
    engineRef.current?.triggerEmote(emoji);
  };

  const handleTeleportTo = (x: number, y: number) => {
    movementRef.current?.handleClickToMove({ x, y });
  };

  const handleLeave = () => {
    spatialBeacon.stop();
    realtimeRef.current?.leaveOffice();
    navigate("/");
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !localAvatar) return;
    const rect = canvas.getBoundingClientRect();
    const clickScreenX = e.clientX - rect.left;
    const clickScreenY = e.clientY - rect.top;

    const zoom = engineRef.current ? engineRef.current.getZoom() : 1.0;
    const worldX = (clickScreenX - rect.width / 2) / zoom + localAvatar.position.x;
    const worldY = (clickScreenY - rect.height / 2) / zoom + localAvatar.position.y;
    movementRef.current?.handleClickToMove({ x: worldX, y: worldY });
  };

  const peersCount = Object.keys(remoteAvatars).length + (localAvatar ? 1 : 0);

  // Calculate distance & spatial attenuation for a given point
  const getSpatialStats = (target: { x: number; y: number }) => {
    if (!localAvatar) return { dist: 0, meters: "0.0", pct: 0, inRange: false };
    const dx = target.x - localAvatar.position.x;
    const dy = target.y - localAvatar.position.y;
    const dist = Math.hypot(dx, dy);
    const meters = (dist / 40).toFixed(1);
    const inRange = dist <= 100;
    const pct = inRange ? Math.round(((100 - dist) / 100) * 100) : 0;
    return { dist: Math.round(dist), meters, pct, inRange };
  };

  const beaconStats = getSpatialStats(spatialBeacon.position);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#060912] text-slate-100 overflow-hidden select-none font-sans">
      {/* Top Header */}
      <header className="h-14 px-5 glass-panel border-b border-slate-800/80 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-white">
              Proxi<span className="text-cyan-400">Speak</span>
            </span>
          </Link>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Office:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-mono font-medium">
              {officeId}
            </span>
          </div>
        </div>

        {/* Center Live Proximity Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" : "bg-rose-500"
              }`}
            />
            <span data-testid="connection-status" className="text-slate-300 font-mono text-[11px]">
              {isConnected ? "Realtime Synced (20 Hz)" : "Connecting..."}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs text-slate-400 font-mono text-[11px]">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Hearing Radius: 100px (2.5m)</span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-medium transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas Center Area */}
        <div className="flex-1 relative bg-[#04060c] overflow-hidden">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-full block cursor-crosshair"
          />

          {/* Floating Reaction Bar (Center Top) */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full glass-panel-glow border border-slate-700/80 flex items-center gap-2 shadow-2xl z-10">
            <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" /> React:
            </span>
            {["👋", "💬", "☕", "🔥", "🚀", "❤️"].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmote(emoji)}
                className="w-7 h-7 rounded-full hover:bg-slate-800/80 hover:scale-125 active:scale-95 flex items-center justify-center text-sm transition cursor-pointer"
                title={`Send ${emoji} reaction`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Floating Bottom Action Dock */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl glass-panel-glow border border-slate-700/90 flex items-center gap-4 shadow-2xl z-10 backdrop-blur-xl">
            {/* Mic Toggle Button */}
            <button
              onClick={handleMuteToggle}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isMuted
                  ? "bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25"
                  : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 shadow-lg shadow-emerald-500/20"
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
              <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
              {!isMuted && (
                <div className="flex items-center gap-0.5 ml-1">
                  <span className="w-1 h-3 bg-emerald-400 animate-pulse rounded-full" />
                  <span className="w-1 h-2 bg-emerald-400 animate-pulse delay-75 rounded-full" />
                  <span className="w-1 h-3.5 bg-emerald-400 animate-pulse delay-150 rounded-full" />
                </div>
              )}
            </button>

            <div className="h-6 w-px bg-slate-700/80" />

            {/* Spatial Audio Jukebox (Beacon) */}
            <button
              onClick={handleBeaconToggle}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isBeaconPlaying
                  ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-lg shadow-amber-500/20"
                  : "bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
              title="Toggle ambient spatial audio beacon in the lounge"
            >
              <Music className={`w-4 h-4 ${isBeaconPlaying ? "text-amber-400 animate-spin" : "text-slate-400"}`} />
              <span>{isBeaconPlaying ? "Lounge Beacon: Playing" : "Lounge Beacon: Off"}</span>
            </button>

            <div className="h-6 w-px bg-slate-700/80" />

            {/* Visual Options Toggles */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleToggleRays}
                className={`p-2 rounded-xl border text-xs transition cursor-pointer ${
                  showRays
                    ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                    : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white"
                }`}
                title="Toggle visual acoustic raycasts"
              >
                {showRays ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>

              <button
                onClick={handleToggleMiniMap}
                className={`p-2 rounded-xl border text-xs transition cursor-pointer ${
                  showMiniMap
                    ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                    : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white"
                }`}
                title="Toggle Radar Minimap"
              >
                <Compass className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-700/80" />

            {/* Camera Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 text-xs">
              <button
                onClick={handleZoomOut}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleZoomReset}
                className="px-2 text-[11px] font-mono font-medium text-slate-400 hover:text-cyan-400 transition"
                title="Reset Zoom"
              >
                {currentZoom}%
              </button>
              <button
                onClick={handleZoomIn}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Active Peers, Spatial Audio & Diagnostics */}
        <aside className="w-84 glass-panel border-l border-slate-800/80 flex flex-col shrink-0 z-10 bg-[#090e1a]/95">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-slate-800 p-2 gap-1 bg-slate-950/40">
            <button
              onClick={() => setActiveTab("peers")}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                activeTab === "peers"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Colleagues ({peersCount})</span>
            </button>

            <button
              onClick={() => setActiveTab("spatial")}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                activeTab === "spatial"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Spatial Radar</span>
            </button>

            <button
              onClick={() => setActiveTab("diagnostics")}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                activeTab === "diagnostics"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Telemetry</span>
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {activeTab === "peers" && (
              <div className="space-y-4">
                {/* Local Avatar Card */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    You (Authoritative Local)
                  </div>
                  {localAvatar && (
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/40 flex items-center justify-between shadow-md">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-black shadow-md border-2 border-white/80"
                          style={{ backgroundColor: localAvatar.avatarColor }}
                        >
                          YOU
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            {localAvatar.displayName}
                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                          </div>
                          <div
                            data-testid="local-avatar-pos"
                            className="text-[10px] text-slate-400 font-mono"
                          >
                            Pos: ({Math.round(localAvatar.position.x)}, {Math.round(localAvatar.position.y)})
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        Authoritative
                      </span>
                    </div>
                  )}
                </div>

                {/* Remote Colleagues List */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Office Colleagues ({Object.keys(remoteAvatars).length})
                  </div>
                  {Object.keys(remoteAvatars).length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                      <p className="text-xs text-slate-400">No other colleagues in this office room.</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Open an incognito tab to join as a colleague!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {Object.values(remoteAvatars).map((peer) => {
                        const stats = getSpatialStats(peer.position);
                        return (
                          <div
                            key={peer.userId}
                            data-testid={`peer-card-${peer.userId}`}
                            className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 hover:border-slate-700 transition"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md border border-white/60"
                                  style={{ backgroundColor: peer.avatarColor }}
                                >
                                  {peer.displayName.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-white">
                                    {peer.displayName}
                                  </div>
                                  <div
                                    data-testid={`peer-pos-${peer.userId}`}
                                    className="text-[10px] text-slate-400 font-mono"
                                  >
                                    Pos: ({Math.round(peer.position.x)}, {Math.round(peer.position.y)})
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleTeleportTo(peer.position.x, peer.position.y)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer"
                                title="Walk to colleague"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>Walk To</span>
                              </button>
                            </div>

                            {/* Proximity Distance & Audio Meter */}
                            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                              <span className="text-slate-400">
                                Dist: <strong className="text-white">{stats.meters}m</strong> ({stats.dist}px)
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  stats.inRange
                                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                    : "bg-slate-800 text-slate-500"
                                }`}
                              >
                                {stats.inRange ? `Hearing (${stats.pct}%)` : "Too Far (>100px)"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quick Navigation / Room Shortcuts */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Floorplan Waypoints
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { name: "Central Lobby", x: 700, y: 300 },
                      { name: "Boardroom A", x: 260, y: 240 },
                      { name: "Lounge & Bar", x: 1250, y: 280 },
                      { name: "Focus Pods", x: 1100, y: 800 },
                    ].map((room) => (
                      <button
                        key={room.name}
                        onClick={() => handleTeleportTo(room.x, room.y)}
                        className="p-2 rounded-xl bg-slate-900/60 hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan-500/30 text-left transition cursor-pointer group"
                      >
                        <div className="font-semibold text-slate-300 group-hover:text-cyan-300 text-[11px]">
                          {room.name}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          ({room.x}, {room.y})
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "spatial" && (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Spatial Audio Beacon Monitor
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">Lounge Jukebox</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                          isBeaconPlaying
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {isBeaconPlaying ? "ACTIVE (PLAYING)" : "OFF"}
                      </span>
                    </div>

                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Position:</span>
                        <span className="text-white">(1250, 280)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Distance:</span>
                        <span className="text-cyan-400">{beaconStats.meters}m ({beaconStats.dist}px)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Attenuation Model:</span>
                        <span className="text-slate-300">Inverse 1/d</span>
                      </div>
                    </div>

                    <button
                      onClick={handleBeaconToggle}
                      className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 text-amber-300 font-semibold text-xs transition cursor-pointer"
                    >
                      {isBeaconPlaying ? "Stop Spatial Beacon" : "Start Spatial Beacon Drone"}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Geospatial Formulas
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-[11px] font-mono text-slate-400">
                    <div>
                      <span className="text-cyan-400">Attenuation:</span>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        A(d) = r_min / (r_min + max(0, d - r_min))
                      </p>
                    </div>
                    <div>
                      <span className="text-cyan-400">Stereo Panning:</span>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        pan = clamp(dx / 150, -1.0, 1.0)
                      </p>
                    </div>
                    <div>
                      <span className="text-cyan-400">Occlusion Filter:</span>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        Lowpass 800 Hz when ray blocked by wall
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "diagnostics" && (
              <div className="space-y-4 text-xs font-mono">
                <div className="text-[11px] font-sans font-semibold text-slate-500 uppercase tracking-wider">
                  Network & Engine Telemetry
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Socket Protocol:</span>
                    <span className={isConnected ? "text-emerald-400 font-bold" : "text-rose-400"}>
                      {isConnected ? "WEBSOCKET CONNECTED" : "DISCONNECTED"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tick Rate:</span>
                    <span className="text-cyan-400">20 Hz Coalesced Broadcast</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Client Prediction:</span>
                    <span className="text-emerald-400">Active (Delta-T Queue)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Server Reconciliation:</span>
                    <span className="text-emerald-400">Authoritative Ack</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Interpolation Buffer:</span>
                    <span className="text-slate-300">~100 ms smoothing</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Legal Speed:</span>
                    <span className="text-slate-300">220 px/s (+25px buffer)</span>
                  </div>
                </div>

                <div className="text-[11px] font-sans font-semibold text-slate-500 uppercase tracking-wider pt-2">
                  Controls Guide
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">W, A, S, D / Arrows:</span>
                    <span className="text-cyan-300 font-bold">Walk Avatar</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Left Click on Floor:</span>
                    <span className="text-cyan-300 font-bold">Click-to-Move</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mouse Wheel:</span>
                    <span className="text-cyan-300 font-bold">Zoom In / Out</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Solid Walls:</span>
                    <span className="text-rose-400">Blocks Motion & Audio</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
