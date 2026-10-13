import { z } from "zod";
import {
  RegisterSchema,
  LoginSchema,
  CreateOfficeSchema,
  UpdateOfficeSchema,
  DimensionsSchema,
  PointSchema,
  WallSchema,
  FurnitureSchema,
  OfficeLayoutSchema,
  MovementInputSchema,
  MovementAcceptedSchema,
  MovementUpdatedSchema,
  ProximityTransitionSchema,
  SignalingEnvelopeSchema,
  IceServerConfigSchema,
  AudioAuthorizedSchema,
  AudioRevokedSchema,
  DiagnosticsReportSchema,
} from "../schemas/index.js";

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateOfficeInput = z.infer<typeof CreateOfficeSchema>;
export type UpdateOfficeInput = z.infer<typeof UpdateOfficeSchema>;
export type OfficeDimensions = z.infer<typeof DimensionsSchema>;

export type Point = z.infer<typeof PointSchema>;
export type Wall = z.infer<typeof WallSchema>;
export type Furniture = z.infer<typeof FurnitureSchema>;
export type OfficeLayout = z.infer<typeof OfficeLayoutSchema>;

export type MovementInput = z.infer<typeof MovementInputSchema>;
export type MovementAccepted = z.infer<typeof MovementAcceptedSchema>;
export type MovementUpdated = z.infer<typeof MovementUpdatedSchema>;

export type ProximityTransition = z.infer<typeof ProximityTransitionSchema>;
export type SignalingEnvelope = z.infer<typeof SignalingEnvelopeSchema>;
export type IceServerConfig = z.infer<typeof IceServerConfigSchema>;
export type AudioAuthorized = z.infer<typeof AudioAuthorizedSchema>;
export type AudioRevoked = z.infer<typeof AudioRevokedSchema>;
export type DiagnosticsReport = z.infer<typeof DiagnosticsReportSchema>;

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarColor?: string;
}

export interface OfficeSummary {
  id: string;
  name: string;
  ownerId: string;
  accessPolicy: "public" | "invite" | "password";
  memberCount: number;
  dimensions: OfficeDimensions;
}

export interface AvatarState {
  userId: string;
  displayName: string;
  avatarColor: string;
  position: Point;
  lastSequence: number;
  isMuted: boolean;
}

export interface ProximityPeerState {
  peerId: string;
  distance: number;
  state: "entered" | "exited";
  since: number;
  occlusionFactor: number;
}
