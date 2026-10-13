# ProxiSpeak

> **Geospatial Proximity Audio Ecosystem**
> 
> 🌐 **Live GitHub Pages Demo:** [https://karthikhruth11-hash.github.io/Spatial-Proximity-Audio/](https://karthikhruth11-hash.github.io/Spatial-Proximity-Audio/)

A high-performance virtual office platform where authenticated users move 2D avatars and converse with nearby colleagues over server-authorized WebRTC peer-to-peer audio, featuring distance-based attenuation, stereo panning, dynamic lighting, and physical wall sound occlusion.

## Technology Stack

- **Monorepo:** pnpm workspaces (`apps/web`, `apps/server`, `packages/shared`)
- **Web App:** React 19, TypeScript (strict), Vite, Tailwind CSS, Zustand, Socket.IO client, HTML5 Canvas (rAF loop), WebRTC `RTCPeerConnection`, Web Audio API
- **Server:** Node.js LTS, Express, Socket.IO, Mongoose/MongoDB, Redis (ioredis), Pino structured logging, Prometheus metrics (`prom-client`), Zod validation
- **Realtime Media:** WebRTC P2P audio, STUN/TURN (coturn), Socket.IO signaling relay
- **Infrastructure:** Docker, Docker Compose

## Quick Start

### Prerequisites
- Node.js (v20+ or v22+)
- pnpm (v9+ or v12+)
- MongoDB (port 27017)
- Redis (port 6379)
- Docker & Docker Compose (optional for containerized deployment)

### 1. Installation
```bash
# Clone the repository
git clone <repo-url>
cd SOUND

# Install dependencies across all workspaces
pnpm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Build & Test
```bash
# Build all workspaces
pnpm build

# Run unit and integration tests
pnpm test
```

### 4. Running Locally
```bash
# Start server in dev mode
pnpm dev:server

# In another terminal, start web client in dev mode
pnpm dev:web
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Service Health
- Liveness Probe: `GET http://localhost:4000/api/health`
- Readiness Probe: `GET http://localhost:4000/api/ready`
- Prometheus Metrics: `GET http://localhost:4000/metrics`
