import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Radio, ShieldCheck, Activity, Users, ArrowRight, Layers, Volume2 } from "lucide-react";

export function LandingPage() {
  const [healthStatus, setHealthStatus] = useState<{ live: boolean; ready: boolean } | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const [healthRes, readyRes] = await Promise.allSettled([
          fetch("/api/health").then((r) => r.json()),
          fetch("/api/ready").then((r) => r.json()),
        ]);
        const live = healthRes.status === "fulfilled" && healthRes.value?.ok === true;
        const ready = readyRes.status === "fulfilled" && readyRes.value?.ok === true;
        setHealthStatus({ live, ready });
      } catch {
        setHealthStatus({ live: false, ready: false });
      }
    }
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 glass-panel sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-white">Proxi<span className="text-cyan-400">Speak</span></span>
              <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">v2.0</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Core Status:</span>
              {healthStatus === null ? (
                <span className="text-slate-500">Connecting...</span>
              ) : healthStatus.ready ? (
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Online & Ready
                </span>
              ) : healthStatus.live ? (
                <span className="text-amber-400 font-semibold">Live (Storage syncing)</span>
              ) : (
                <span className="text-rose-400 font-semibold">Offline</span>
              )}
            </div>

            <Link
              to="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-4 py-2 rounded-lg shadow-md shadow-cyan-500/20 transition duration-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-20 flex-1 flex flex-col items-center text-center justify-center relative">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-cyan-500/10 via-indigo-500/10 to-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/80 text-xs font-medium text-cyan-300 mb-8 shadow-inner">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Server-Authoritative Proximity &bull; Dynamic Obstacle Occlusion</span>
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight max-w-4xl leading-[1.1] mb-6">
          Spatial Proximity Audio for <span className="gradient-text">Virtual Workspaces</span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Move your 2D avatar across an interactive office. Talk naturally with colleagues within hearing range with realistic volume dropoff, stereo panning, and physical wall sound dampening.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link
            to="/register"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold shadow-xl shadow-cyan-500/25 transition duration-200 text-base"
          >
            <span>Enter Virtual Office</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            to="/office/demo-room"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/70 font-semibold transition duration-200 text-base"
          >
            <span>Explore Demo Map</span>
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full text-left">
          <div className="glass-panel p-6 rounded-2xl hover:border-cyan-500/40 transition duration-300">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400">
              <Volume2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Spatial Acoustics</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              3D-calibrated stereo panning and inverse/smooth distance gain attenuation calculated in real-time on Web Audio graphs.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl hover:border-indigo-500/40 transition duration-300">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Wall Occlusion</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Server-authoritative segment raycasts compute sound barrier attenuation, dampening or blocking audio between rooms.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl hover:border-purple-500/40 transition duration-300">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">High-Density Mesh</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Optimized spatial grid neighborhoods and hysteresis margins support up to 50 concurrent office workers seamlessly.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>ProxiSpeak &copy; 2026. Built with WebRTC, Web Audio API, Express, MongoDB, and Redis.</p>
      </footer>
    </div>
  );
}
