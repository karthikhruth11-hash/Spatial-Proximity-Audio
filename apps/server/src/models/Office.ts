import mongoose, { Schema, Document, Types } from "mongoose";

export interface IOffice extends Document {
  name: string;
  ownerId: Types.ObjectId;
  dimensions: {
    width: number;
    height: number;
  };
  layoutVersion: number;
  accessPolicy: "public" | "invite" | "password";
  passwordHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OfficeSchema = new Schema<IOffice>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 64 },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dimensions: {
      width: { type: Number, default: 1600 },
      height: { type: Number, default: 1200 },
    },
    layoutVersion: { type: Number, default: 1 },
    accessPolicy: {
      type: String,
      enum: ["public", "invite", "password"],
      default: "public",
    },
    passwordHash: { type: String },
  },
  { timestamps: true },
);

export const OfficeModel = mongoose.model<IOffice>("Office", OfficeSchema);
