import mongoose, { Schema, Document } from "mongoose";

export interface IPositionSnapshot extends Document {
  roomId: string;
  userId: string;
  x: number;
  y: number;
  updatedAt: Date;
}

const PositionSnapshotSchema = new Schema<IPositionSnapshot>(
  {
    roomId: { type: String, required: true },
    userId: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Compound index on (roomId, userId)
PositionSnapshotSchema.index({ roomId: 1, userId: 1 }, { unique: true });

// TTL index: expire snapshots after 24 hours of inactivity
PositionSnapshotSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

export const PositionSnapshotModel = mongoose.model<IPositionSnapshot>(
  "PositionSnapshot",
  PositionSnapshotSchema,
);
