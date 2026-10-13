import mongoose, { Schema, Document } from "mongoose";
import type { Wall, Furniture } from "@proxispeak/shared";

export interface IOfficeLayout extends Document {
  officeId: string;
  layoutVersion: number;
  walls: Wall[];
  furniture: Furniture[];
  createdAt: Date;
  updatedAt: Date;
}

const PointSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false },
);

const WallSchema = new Schema(
  {
    id: { type: String, required: true },
    p1: { type: PointSchema, required: true },
    p2: { type: PointSchema, required: true },
    blocksMovement: { type: Boolean, default: true },
    blocksSound: { type: Boolean, default: true },
    soundAttenuation: { type: Number, default: 0.2, min: 0, max: 1 },
  },
  { _id: false },
);

const FurnitureSchema = new Schema(
  {
    id: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    label: { type: String },
    blocksMovement: { type: Boolean, default: true },
    blocksSound: { type: Boolean, default: false },
    soundAttenuation: { type: Number, default: 1.0, min: 0, max: 1 },
  },
  { _id: false },
);

const OfficeLayoutSchema = new Schema<IOfficeLayout>(
  {
    officeId: { type: String, required: true, unique: true, index: true },
    layoutVersion: { type: Number, default: 1 },
    walls: [WallSchema],
    furniture: [FurnitureSchema],
  },
  { timestamps: true },
);

export const OfficeLayoutModel = mongoose.model<IOfficeLayout>(
  "OfficeLayout",
  OfficeLayoutSchema,
);

/**
 * Creates default physical and acoustic floorplan geometry for an office.
 */
export function getDefaultLayout(officeId: string): {
  officeId: string;
  layoutVersion: number;
  walls: Wall[];
  furniture: Furniture[];
} {
  return {
    officeId,
    layoutVersion: 1,
    walls: [
      // Outer Perimeter Walls (1600x1200)
      { id: "wall-top", p1: { x: 50, y: 50 }, p2: { x: 1550, y: 50 }, blocksMovement: true, blocksSound: true, soundAttenuation: 0.0 },
      { id: "wall-bottom", p1: { x: 50, y: 1150 }, p2: { x: 1550, y: 1150 }, blocksMovement: true, blocksSound: true, soundAttenuation: 0.0 },
      { id: "wall-left", p1: { x: 50, y: 50 }, p2: { x: 50, y: 1150 }, blocksMovement: true, blocksSound: true, soundAttenuation: 0.0 },
      { id: "wall-right", p1: { x: 1550, y: 50 }, p2: { x: 1550, y: 1150 }, blocksMovement: true, blocksSound: true, soundAttenuation: 0.0 },

      // Meeting Room A (Top-Left 50..500, 50..450) with Doorway opening
      { id: "roomA-bottom-1", p1: { x: 50, y: 450 }, p2: { x: 300, y: 450 }, blocksMovement: true, blocksSound: true, soundAttenuation: 0.15 },
      { id: "roomA-bottom-2", p1: { x: 380, y: 450 }, p2: { x: 500, y: 450 }, blocksMovement: true, blocksSound: true, soundAttenuation: 0.15 }, // 300..380 is doorway
      { id: "roomA-right", p1: { x: 500, y: 50 }, p2: { x: 500, y: 450 }, blocksMovement: true, blocksSound: true, soundAttenuation: 0.15 },

      // Soundproof Executive Suite (Top-Right 1100..1550, 50..450)
      { id: "suite-left", p1: { x: 1100, y: 50 }, p2: { x: 1100, y: 450 }, blocksMovement: true, blocksSound: true, soundAttenuation: 0.0 },
      { id: "suite-bottom-1", p1: { x: 1100, y: 450 }, p2: { x: 1250, y: 450 }, blocksMovement: true, blocksSound: true, soundAttenuation: 0.0 },
      { id: "suite-bottom-2", p1: { x: 1330, y: 450 }, p2: { x: 1550, y: 450 }, blocksMovement: true, blocksSound: true, soundAttenuation: 0.0 }, // doorway 1250..1330

      // Acoustic Divider in Central Open Office (x: 800, y: 550..950)
      { id: "divider-central", p1: { x: 800, y: 550 }, p2: { x: 800, y: 950 }, blocksMovement: true, blocksSound: true, soundAttenuation: 0.3 },
    ],
    furniture: [
      // Conference Table in Room A
      { id: "table-conf", x: 180, y: 180, width: 180, height: 100, label: "Conference Table", blocksMovement: true, blocksSound: false, soundAttenuation: 0.9 },
      
      // Open Office Desks (Left Cluster)
      { id: "desk-1", x: 200, y: 650, width: 120, height: 70, label: "Eng Desk 1", blocksMovement: true, blocksSound: false, soundAttenuation: 1.0 },
      { id: "desk-2", x: 200, y: 780, width: 120, height: 70, label: "Eng Desk 2", blocksMovement: true, blocksSound: false, soundAttenuation: 1.0 },
      { id: "desk-3", x: 400, y: 650, width: 120, height: 70, label: "Eng Desk 3", blocksMovement: true, blocksSound: false, soundAttenuation: 1.0 },
      { id: "desk-4", x: 400, y: 780, width: 120, height: 70, label: "Eng Desk 4", blocksMovement: true, blocksSound: false, soundAttenuation: 1.0 },

      // Open Office Desks (Right Cluster)
      { id: "desk-5", x: 950, y: 650, width: 120, height: 70, label: "Design Desk 1", blocksMovement: true, blocksSound: false, soundAttenuation: 1.0 },
      { id: "desk-6", x: 950, y: 780, width: 120, height: 70, label: "Design Desk 2", blocksMovement: true, blocksSound: false, soundAttenuation: 1.0 },
      { id: "desk-7", x: 1150, y: 650, width: 120, height: 70, label: "Design Desk 3", blocksMovement: true, blocksSound: false, soundAttenuation: 1.0 },
      { id: "desk-8", x: 1150, y: 780, width: 120, height: 70, label: "Design Desk 4", blocksMovement: true, blocksSound: false, soundAttenuation: 1.0 },

      // Lounge Sofas in Bottom Area
      { id: "lounge-sofa-1", x: 650, y: 1020, width: 140, height: 60, label: "Lounge Sofa", blocksMovement: true, blocksSound: false, soundAttenuation: 0.95 },
      { id: "lounge-sofa-2", x: 830, y: 1020, width: 140, height: 60, label: "Coffee Table", blocksMovement: true, blocksSound: false, soundAttenuation: 1.0 },
    ],
  };
}
