import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  displayName: string;
  email: string;
  passwordHash: string;
  avatarColor: string;
  preferences: {
    micDefaultMuted: boolean;
    outputVolume: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 32 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatarColor: { type: String, default: "#06b6d4" },
    preferences: {
      micDefaultMuted: { type: Boolean, default: true },
      outputVolume: { type: Number, default: 80, min: 0, max: 100 },
    },
  },
  { timestamps: true },
);

export const UserModel = mongoose.model<IUser>("User", UserSchema);
