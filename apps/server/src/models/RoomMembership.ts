import mongoose, { Schema, Document } from "mongoose";

export interface IRoomMembership extends Document {
  roomId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  joinedAt: Date;
  lastSeenAt: Date;
}

const RoomMembershipSchema = new Schema<IRoomMembership>(
  {
    roomId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Compound unique index ensuring one membership record per (roomId, userId)
RoomMembershipSchema.index({ roomId: 1, userId: 1 }, { unique: true });

export const RoomMembershipModel = mongoose.model<IRoomMembership>(
  "RoomMembership",
  RoomMembershipSchema,
);
