import { z } from "zod";

// --- Auth Schemas ---
export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  displayName: z.string().trim().min(2).max(32),
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required"),
});

// --- Office Schemas ---
export const DimensionsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

export const AccessPolicyEnum = z.enum(["public", "invite", "password"]);

export const CreateOfficeSchema = z.object({
  name: z.string().trim().min(2).max(64),
  accessPolicy: AccessPolicyEnum.default("public"),
  dimensions: DimensionsSchema.default({ width: 1600, height: 1200 }),
});

export const UpdateOfficeSchema = z.object({
  name: z.string().trim().min(2).max(64).optional(),
  accessPolicy: AccessPolicyEnum.optional(),
});

// --- Geometry & Layout Schemas ---
export const PointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const WallSchema = z.object({
  id: z.string(),
  p1: PointSchema,
  p2: PointSchema,
  blocksMovement: z.boolean().default(true),
  blocksSound: z.boolean().default(true),
  soundAttenuation: z.number().min(0).max(1).default(0.2), // 0 = soundproof, 1 = transparent
});

export const FurnitureSchema = z.object({
  id: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
  label: z.string().optional(),
  blocksMovement: z.boolean().default(true),
  blocksSound: z.boolean().default(false),
  soundAttenuation: z.number().min(0).max(1).default(1.0),
});

export const OfficeLayoutSchema = z.object({
  officeId: z.string(),
  layoutVersion: z.number().int().positive().default(1),
  walls: z.array(WallSchema).default([]),
  furniture: z.array(FurnitureSchema).default([]),
});

// --- Movement Schemas ---
export const MovementInputSchema = z.object({
  sequence: z.number().int().nonnegative(),
  proposedPosition: PointSchema,
  dt: z.number().positive().max(1.0),
});

export const MovementAcceptedSchema = z.object({
  sequence: z.number().int().nonnegative(),
  position: PointSchema,
  serverTimestamp: z.number(),
});

export const MovementUpdatedSchema = z.object({
  userId: z.string(),
  position: PointSchema,
  sequence: z.number().int().nonnegative(),
  serverTimestamp: z.number(),
});

// --- Proximity Schemas ---
export const ProximityTransitionSchema = z.object({
  peerId: z.string(),
  distance: z.number().nonnegative(),
  state: z.enum(["entered", "exited"]),
  since: z.number(),
  occlusionFactor: z.number().min(0).max(1),
});

// --- WebRTC Signaling Envelope Schema ---
export const SignalingEnvelopeSchema = z.object({
  type: z.enum(["offer", "answer", "ice-candidate"]),
  roomId: z.string().min(1),
  peerId: z.string().min(1),
  connectionId: z.string().min(1),
  payload: z.unknown(),
  timestamp: z.number(),
});

export const IceServerConfigSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});

export const AudioAuthorizedSchema = z.object({
  peerId: z.string(),
  connectionId: z.string(),
  isPolite: z.boolean(),
  iceServers: z.array(IceServerConfigSchema),
});

export const AudioRevokedSchema = z.object({
  peerId: z.string(),
  connectionId: z.string(),
  reason: z.string().optional(),
});

// --- Diagnostics Schema ---
export const DiagnosticsReportSchema = z.object({
  peerId: z.string(),
  iceConnectionState: z.string(),
  selectedCandidateType: z.string().optional(),
  roundTripTimeMs: z.number().optional(),
  packetLossPercent: z.number().optional(),
  jitterMs: z.number().optional(),
  bitrateKbps: z.number().optional(),
  audioLevel: z.number().optional(),
});
