import client from "prom-client";

// Collect default metrics (CPU, memory, event-loop lag, GC)
client.collectDefaultMetrics({ prefix: "proxispeak_" });

export const metricsRegistry = client.register;

// Custom Gauges
export const connectedSocketsGauge = new client.Gauge({
  name: "proxispeak_connected_sockets",
  help: "Current number of connected Socket.IO sockets",
});

export const usersPerOfficeGauge = new client.Gauge({
  name: "proxispeak_users_per_office",
  help: "Number of active users in each office room",
  labelNames: ["roomId"],
});

export const activeProximityPairsGauge = new client.Gauge({
  name: "proxispeak_active_proximity_pairs",
  help: "Number of active proximity authorized pairs",
});

export const activePeerConnectionsGauge = new client.Gauge({
  name: "proxispeak_active_peer_connections",
  help: "Active WebRTC peer connections reported by clients",
});

export const databaseUpGauge = new client.Gauge({
  name: "proxispeak_database_up",
  help: "1 if MongoDB connection is ready, 0 otherwise",
});

export const redisUpGauge = new client.Gauge({
  name: "proxispeak_redis_up",
  help: "1 if Redis connection is ready, 0 otherwise",
});

// Custom Histograms
export const movementLatencyHistogram = new client.Histogram({
  name: "proxispeak_movement_processing_duration_seconds",
  help: "Histogram of server movement processing duration",
  buckets: [0.0005, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05],
});

export const proximityLatencyHistogram = new client.Histogram({
  name: "proxispeak_proximity_processing_duration_seconds",
  help: "Histogram of spatial proximity update duration",
  buckets: [0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02],
});

export const signalingLatencyHistogram = new client.Histogram({
  name: "proxispeak_signaling_relay_duration_seconds",
  help: "Histogram of signaling relay processing time",
  buckets: [0.0005, 0.001, 0.002, 0.005, 0.01],
});
