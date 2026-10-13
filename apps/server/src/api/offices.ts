import { Router, Response } from "express";
import { CreateOfficeSchema, UpdateOfficeSchema } from "@proxispeak/shared";
import { OfficeModel } from "../models/Office.js";
import { OfficeLayoutModel, getDefaultLayout } from "../models/OfficeLayout.js";
import { RoomMembershipModel } from "../models/RoomMembership.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";

export const officeRouter: Router = Router();

// List offices
officeRouter.get("/offices", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const offices = await OfficeModel.find({
    $or: [{ accessPolicy: "public" }, { ownerId: req.user?.userId }],
  }).sort({ updatedAt: -1 });

  res.status(200).json({
    ok: true,
    data: offices.map((o) => ({
      id: o._id.toString(),
      name: o.name,
      ownerId: o.ownerId.toString(),
      accessPolicy: o.accessPolicy,
      dimensions: o.dimensions,
      layoutVersion: o.layoutVersion,
      createdAt: o.createdAt,
    })),
  });
});

// Create new office
officeRouter.post("/offices", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = CreateOfficeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid office configuration",
        details: parseResult.error.flatten(),
      },
    });
    return;
  }

  const { name, accessPolicy, dimensions } = parseResult.data;
  const userId = req.user!.userId;

  const office = await OfficeModel.create({
    name,
    ownerId: userId,
    dimensions,
    accessPolicy,
    layoutVersion: 1,
  });

  const officeId = office._id.toString();

  // Create default layout
  const defaultLayout = getDefaultLayout(officeId);
  await OfficeLayoutModel.create(defaultLayout);

  // Add creator as owner in RoomMembership
  await RoomMembershipModel.create({
    roomId: officeId,
    userId,
    role: "owner",
  });

  res.status(201).json({
    ok: true,
    data: {
      id: officeId,
      name: office.name,
      ownerId: office.ownerId.toString(),
      accessPolicy: office.accessPolicy,
      dimensions: office.dimensions,
      layoutVersion: office.layoutVersion,
    },
  });
});

// Get office details
officeRouter.get("/offices/:officeId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { officeId } = req.params;
  const office = await OfficeModel.findById(officeId);
  if (!office) {
    res.status(404).json({
      ok: false,
      error: { code: "NOT_FOUND", message: "Office not found" },
    });
    return;
  }

  res.status(200).json({
    ok: true,
    data: {
      id: office._id.toString(),
      name: office.name,
      ownerId: office.ownerId.toString(),
      accessPolicy: office.accessPolicy,
      dimensions: office.dimensions,
      layoutVersion: office.layoutVersion,
    },
  });
});

// Update office
officeRouter.patch("/offices/:officeId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { officeId } = req.params;
  const parseResult = UpdateOfficeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid update payload" },
    });
    return;
  }

  const office = await OfficeModel.findById(officeId);
  if (!office) {
    res.status(404).json({
      ok: false,
      error: { code: "NOT_FOUND", message: "Office not found" },
    });
    return;
  }

  if (office.ownerId.toString() !== req.user?.userId) {
    res.status(403).json({
      ok: false,
      error: { code: "FORBIDDEN", message: "Only the office owner can update settings" },
    });
    return;
  }

  if (parseResult.data.name) office.name = parseResult.data.name;
  if (parseResult.data.accessPolicy) office.accessPolicy = parseResult.data.accessPolicy;
  await office.save();

  res.status(200).json({
    ok: true,
    data: {
      id: office._id.toString(),
      name: office.name,
      accessPolicy: office.accessPolicy,
    },
  });
});

// Delete office
officeRouter.delete("/offices/:officeId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { officeId } = req.params;
  const office = await OfficeModel.findById(officeId);
  if (!office) {
    res.status(404).json({
      ok: false,
      error: { code: "NOT_FOUND", message: "Office not found" },
    });
    return;
  }

  if (office.ownerId.toString() !== req.user?.userId) {
    res.status(403).json({
      ok: false,
      error: { code: "FORBIDDEN", message: "Only the office owner can delete this office" },
    });
    return;
  }

  await OfficeModel.findByIdAndDelete(officeId);
  await OfficeLayoutModel.deleteOne({ officeId });
  await RoomMembershipModel.deleteMany({ roomId: officeId });

  res.status(200).json({
    ok: true,
    data: { message: "Office deleted successfully" },
  });
});

// Join office
officeRouter.post("/offices/:officeId/join", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { officeId } = req.params;
  const userId = req.user!.userId;

  const office = await OfficeModel.findById(officeId);
  if (!office) {
    res.status(404).json({
      ok: false,
      error: { code: "NOT_FOUND", message: "Office not found" },
    });
    return;
  }

  const membership = await RoomMembershipModel.findOneAndUpdate(
    { roomId: officeId, userId },
    { lastSeenAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.status(200).json({
    ok: true,
    data: {
      roomId: officeId,
      userId,
      role: membership.role,
    },
  });
});

// Leave office
officeRouter.post("/offices/:officeId/leave", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { officeId } = req.params;
  const userId = req.user!.userId;

  await RoomMembershipModel.deleteOne({ roomId: officeId, userId });

  res.status(200).json({
    ok: true,
    data: { message: "Left office successfully" },
  });
});

// Get members
officeRouter.get("/offices/:officeId/members", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { officeId } = req.params;
  const memberships = await RoomMembershipModel.find({ roomId: officeId });

  res.status(200).json({
    ok: true,
    data: memberships.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      lastSeenAt: m.lastSeenAt,
    })),
  });
});

// Get office layout
officeRouter.get("/offices/:officeId/layout", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const officeId = req.params.officeId;
  if (!officeId) {
    res.status(400).json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing officeId" } });
    return;
  }

  let layout = await OfficeLayoutModel.findOne({ officeId });
  if (!layout) {
    // Generate default layout if not present
    layout = await OfficeLayoutModel.create(getDefaultLayout(officeId));
  }

  res.status(200).json({
    ok: true,
    data: {
      officeId: layout.officeId,
      layoutVersion: layout.layoutVersion,
      walls: layout.walls,
      furniture: layout.furniture,
    },
  });
});
