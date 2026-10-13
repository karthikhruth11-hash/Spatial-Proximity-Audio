export const DEFAULT_HEARING_RADIUS = 100;
export const DEFAULT_HYSTERESIS_MARGIN = 10;
export const DEFAULT_MAX_ACTIVE_PEERS = 8;
export const DEFAULT_EXIT_GRACE_MS = 1500;
export const DEFAULT_MOVEMENT_TICK_HZ = 20;
export const DEFAULT_MAX_SPEED_PX_PER_SEC = 220;
export const DEFAULT_AVATAR_RADIUS = 16;
export const TURN_CREDENTIAL_TTL_SECONDS = 600;

/**
 * Spatial grid cell size = hearingRadius + hysteresisMargin
 * Ensures a 3x3 cell neighborhood (the home cell + 8 surrounding cells)
 * is mathematically guaranteed to contain all peers within distance <= radius + margin.
 */
export const DEFAULT_GRID_CELL_SIZE = DEFAULT_HEARING_RADIUS + DEFAULT_HYSTERESIS_MARGIN; // 110 px
