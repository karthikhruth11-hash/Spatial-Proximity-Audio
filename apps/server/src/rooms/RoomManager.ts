import {
  AvatarState,
  OfficeDimensions,
  OfficeLayout,
  Point,
} from "@proxispeak/shared";
import mongoose from "mongoose";
import { MovementEngine, MovementValidationResult } from "../movement/engine.js";
import { OfficeModel } from "../models/Office.js";
import { OfficeLayoutModel, getDefaultLayout } from "../models/OfficeLayout.js";
import { PositionSnapshotModel } from "../models/PositionSnapshot.js";
import { logger } from "../observability/logger.js";
import { usersPerOfficeGauge } from "../observability/metrics.js";

export interface RoomState {
  roomId: string;
  dimensions: OfficeDimensions;
  layoutVersion: number;
  layout: OfficeLayout;
  avatars: Map<string, AvatarState>;
  userSockets: Map<string, string>; // userId -> socketId
  socketUsers: Map<string, string>; // socketId -> userId
  movementEngine: MovementEngine;
  dirtyUserIds: Set<string>;
}

export class RoomManager {
  private rooms = new Map<string, RoomState>();

  /**
   * Retrieves or initializes authoritative room state in memory.
   */
  public async getOrInitRoom(roomId: string): Promise<RoomState> {
    let room = this.rooms.get(roomId);
    if (room) return room;

    let office = null;
    if (mongoose.Types.ObjectId.isValid(roomId)) {
      office = await OfficeModel.findById(roomId);
    } else {
      office = await OfficeModel.findOne({ name: roomId });
    }
    const dimensions: OfficeDimensions = office
      ? { width: office.dimensions.width, height: office.dimensions.height }
      : { width: 1600, height: 1200 };

    let layoutDoc = await OfficeLayoutModel.findOne({ officeId: roomId });
    if (!layoutDoc) {
      layoutDoc = await OfficeLayoutModel.create(getDefaultLayout(roomId));
    }

    const layout: OfficeLayout = {
      officeId: roomId,
      layoutVersion: layoutDoc.layoutVersion,
      walls: layoutDoc.walls,
      furniture: layoutDoc.furniture,
    };

    room = {
      roomId,
      dimensions,
      layoutVersion: layout.layoutVersion,
      layout,
      avatars: new Map(),
      userSockets: new Map(),
      socketUsers: new Map(),
      movementEngine: new MovementEngine(),
      dirtyUserIds: new Set(),
    };

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Adds an authenticated user to the room state.
   */
  public async joinUser(
    roomId: string,
    userId: string,
    displayName: string,
    avatarColor: string,
    socketId: string,
  ): Promise<{ room: RoomState; avatar: AvatarState }> {
    const room = await this.getOrInitRoom(roomId);

    // Pick a jittered starting position in the central open lobby (free of obstacles)
    let initialPos: Point = { x: 700, y: 250 };
    const snapshot = await PositionSnapshotModel.findOne({ roomId, userId });
    if (snapshot) {
      initialPos = { x: snapshot.x, y: snapshot.y };
    } else {
      initialPos = {
        x: 650 + Math.floor(Math.random() * 60),
        y: 250 + Math.floor(Math.random() * 60),
      };
    }

    const avatar: AvatarState = {
      userId,
      displayName,
      avatarColor,
      position: initialPos,
      lastSequence: 0,
      isMuted: true,
    };

    room.avatars.set(userId, avatar);
    room.userSockets.set(userId, socketId);
    room.socketUsers.set(socketId, userId);
    room.movementEngine.registerUser(userId, initialPos);
    room.dirtyUserIds.add(userId);

    usersPerOfficeGauge.set({ roomId }, room.avatars.size);
    logger.info({ roomId, userId, socketId }, "User joined authoritative room");

    return { room, avatar };
  }

  /**
   * Removes user from room and persists final position snapshot.
   */
  public async leaveUser(
    roomId: string,
    userId: string,
  ): Promise<{ avatar?: AvatarState; remainingCount: number }> {
    const room = this.rooms.get(roomId);
    if (!room) return { remainingCount: 0 };

    const avatar = room.avatars.get(userId);
    const socketId = room.userSockets.get(userId);

    if (avatar) {
      // Persist snapshot to MongoDB on leave
      await PositionSnapshotModel.findOneAndUpdate(
        { roomId, userId },
        { x: avatar.position.x, y: avatar.position.y, updatedAt: new Date() },
        { upsert: true },
      ).catch((err) => logger.error({ err }, "Failed to persist position snapshot"));
    }

    room.avatars.delete(userId);
    if (socketId) room.socketUsers.delete(socketId);
    room.userSockets.delete(userId);
    room.movementEngine.unregisterUser(userId);
    room.dirtyUserIds.delete(userId);

    const remainingCount = room.avatars.size;
    usersPerOfficeGauge.set({ roomId }, remainingCount);
    logger.info({ roomId, userId }, "User left authoritative room");

    return { avatar, remainingCount };
  }

  /**
   * Handles and validates user movement packet.
   */
  public handleMovement(
    roomId: string,
    userId: string,
    proposed: Point,
    sequence: number,
    dt: number,
  ): MovementValidationResult {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { valid: false, position: proposed, sequence, error: "OUT_OF_BOUNDS" };
    }

    const result = room.movementEngine.validateAndApply(
      userId,
      proposed,
      sequence,
      dt,
      room.dimensions,
      room.layout.walls,
      room.layout.furniture,
    );

    if (result.valid) {
      const avatar = room.avatars.get(userId);
      if (avatar) {
        avatar.position = result.position;
        avatar.lastSequence = result.sequence;
      }
      room.dirtyUserIds.add(userId);
    }

    return result;
  }

  /**
   * Retrieves and clears dirty avatar updates for coalesced broadcast.
   */
  public flushDirtyAvatars(roomId: string): AvatarState[] {
    const room = this.rooms.get(roomId);
    if (!room || room.dirtyUserIds.size === 0) return [];

    const updates: AvatarState[] = [];
    for (const userId of room.dirtyUserIds) {
      const avatar = room.avatars.get(userId);
      if (avatar) {
        updates.push({ ...avatar });
      }
    }

    room.dirtyUserIds.clear();
    return updates;
  }

  public getRoomBySocket(socketId: string): { room: RoomState; userId: string } | null {
    for (const room of this.rooms.values()) {
      const userId = room.socketUsers.get(socketId);
      if (userId) {
        return { room, userId };
      }
    }
    return null;
  }
}

export const roomManager = new RoomManager();
