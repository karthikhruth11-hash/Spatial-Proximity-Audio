# ProxiSpeak Architecture Specification

## Overview

ProxiSpeak is a Geospatial Proximity Audio Ecosystem. Users move 2D avatars in top-down virtual offices and talk to nearby colleagues over server-authorized WebRTC audio with distance gain attenuation, stereo panning, and physical wall sound occlusion.

## Monorepo Layout

```
proxispeak/
  apps/
    web/         Vite + React 19 + Tailwind CSS + HTML5 Canvas + WebRTC + Web Audio API
    server/      Express + Socket.IO + Mongoose/MongoDB + Redis (ioredis) + Pino + Prometheus
  packages/
    shared/      Shared geometry, audio math, events, constants, and Zod runtime schemas
  infrastructure/
    docker/      Dockerfiles for containerized deployment
    coturn/      TURN/STUN server configuration
    nginx/       Reverse proxy configuration
  docs/          Architectural, API, and protocol documentation
```

## Core Principles & Design Decisions

1. **Who Computes Audio Gain?**
   - The server is strictly authoritative for **eligibility** (who may hear whom based on proximity and access policy) and computes the sound occlusion factor across obstacles.
   - The client computes the smooth per-frame **gain and stereo pan** using the server-provided positions and occlusion factor. This eliminates network round-trips per animation frame while keeping connection authorization under absolute server control.

2. **Planar Geometry vs MongoDB 2dsphere**
   - Office maps use pixel planar coordinates (origin top-left, x right, y down).
   - In-memory spatial grid is used for live proximity tracking (cell size = hearingRadius + hysteresisMargin).
   - `2dsphere` indexes in MongoDB use spherical (lat/lon) math and are never used on pixel coordinates.

3. **Server-Authoritative Movement**
   - The client sends input intent with sequence numbers.
   - The server validates speed limits, bounds, and wall collisions.
   - Remote avatars are smoothly interpolated (~100ms buffer).

4. **Mesh Limits & Selective WebRTC**
   - Rather than connecting all users (which scales as N*(N-1)/2), connections are only authorized within the hearing radius, capped at `MAX_ACTIVE_PEERS` (default 8).
