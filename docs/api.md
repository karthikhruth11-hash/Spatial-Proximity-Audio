# ProxiSpeak REST API Specification

All REST endpoints return a consistent JSON response envelope:

```typescript
// Success
{ "ok": true, "data": T }

// Error
{ "ok": false, "error": { "code": string, "message": string, "details"?: unknown } }
```

## Endpoints

### 1. Health & Readiness
- `GET /api/health`
  - Liveness probe. Returns 200 `{ ok: true, data: { status: "live", instanceId, uptime, timestamp } }`
- `GET /api/ready`
  - Readiness probe checking MongoDB and Redis status.
  - Returns 200 `{ ok: true, data: { status: "ready", mongo: "healthy", redis: "healthy" } }` if ready.
  - Returns 503 `{ ok: false, error: { code: "NOT_READY", ... } }` if either service is unreachable.

### 2. Metrics
- `GET /metrics`
  - Exposes Prometheus-formatted metrics including system metrics and custom ProxiSpeak gauges and histograms.

### 3. Authentication (Phase 2)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 4. Offices (Phase 2 & Phase 6)
- `GET /api/offices`
- `POST /api/offices`
- `GET /api/offices/:officeId`
- `PATCH /api/offices/:officeId`
- `DELETE /api/offices/:officeId`
- `POST /api/offices/:officeId/join`
- `POST /api/offices/:officeId/leave`
- `GET /api/offices/:officeId/members`
- `GET /api/offices/:officeId/layout`
- `PATCH /api/offices/:officeId/layout`

### 5. TURN Credentials (Phase 4)
- `GET /api/turn-credentials`
  - Returns short-lived HMAC credentials for coturn (TTL ~ 10 minutes).
