import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  MovementInputSchema,
  DEFAULT_MOVEMENT_TICK_HZ,
} from "@proxispeak/shared";

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const map: Record<string, string> = {};
  cookieHeader.split(";").forEach((c) => {
    const parts = c.split("=");
    const key = parts[0]?.trim();
    if (key) map[key] = decodeURIComponent(parts[1]?.trim() || "");
  });
  return map;
}
import { verifyAuthToken, TokenPayload } from "../auth/service.js";
import { roomManager } from "../rooms/RoomManager.js";
import { UserModel } from "../models/User.js";
import { logger } from "../observability/logger.js";
import {
  connectedSocketsGauge,
  movementLatencyHistogram,
} from "../observability/metrics.js";
import { env } from "../config/env.js";

export interface AuthenticatedSocket extends Socket {
  user?: TokenPayload & { displayName: string; avatarColor: string };
  currentRoomId?: string;
}

export function setupSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        env.CLIENT_ORIGIN,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ],
      credentials: true,
    },
    maxHttpBufferSize: 1e5, // 100 KB payload size limit
  });

  // Authentication Middleware for Socket.IO Handshake
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      let token: string | undefined = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers.cookie) {
        const parsed = parseCookies(socket.handshake.headers.cookie);
        token = parsed["proxispeak_token"];
      }

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const payload = verifyAuthToken(token);
      if (!payload) {
        return next(new Error("Invalid or expired session token"));
      }

      const user = await UserModel.findById(payload.userId);
      if (!user) {
        return next(new Error("User account not found"));
      }

      socket.user = {
        userId: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      };

      next();
    } catch (err) {
      logger.error({ err }, "Socket authentication error");
      next(new Error("Authentication internal error"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    connectedSocketsGauge.inc();
    const user = socket.user!;
    logger.info({ socketId: socket.id, userId: user.userId }, "Socket client connected");

    // --- office:join ---
    socket.on(SOCKET_EVENTS.CLIENT_OFFICE_JOIN, async (data: { roomId: string }, callback) => {
      try {
        const { roomId } = data;
        if (!roomId || typeof roomId !== "string") {
          if (callback) callback({ ok: false, error: "Invalid roomId" });
          return;
        }

        socket.currentRoomId = roomId;
        await socket.join(`room:${roomId}`);

        const { room, avatar } = await roomManager.joinUser(
          roomId,
          user.userId,
          user.displayName,
          user.avatarColor,
          socket.id,
        );

        // Send full initial state to joining user
        const avatarsList = Array.from(room.avatars.values());
        socket.emit(SOCKET_EVENTS.SERVER_OFFICE_STATE, {
          officeId: roomId,
          dimensions: room.dimensions,
          layout: room.layout,
          avatars: avatarsList,
          self: avatar,
        });

        // Notify other room occupants
        socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.SERVER_OFFICE_USER_JOINED, {
          user: avatar,
        });

        if (callback) callback({ ok: true, data: { roomId, self: avatar } });
      } catch (err) {
        logger.error({ err, socketId: socket.id }, "Error handling office:join");
        if (callback) callback({ ok: false, error: "Failed to join office" });
      }
    });

    // --- movement:input ---
    socket.on(SOCKET_EVENTS.CLIENT_MOVEMENT_INPUT, (data: unknown, callback) => {
      const timer = movementLatencyHistogram.startTimer();
      try {
        const parseResult = MovementInputSchema.safeParse(data);
        if (!parseResult.success || !socket.currentRoomId) {
          if (callback) callback({ ok: false, error: "Invalid movement payload" });
          timer();
          return;
        }

        const { sequence, proposedPosition, dt } = parseResult.data;
        const validation = roomManager.handleMovement(
          socket.currentRoomId,
          user.userId,
          proposedPosition,
          sequence,
          dt,
        );

        // Acknowledge accepted/reconciled position to sender
        socket.emit(SOCKET_EVENTS.SERVER_MOVEMENT_ACCEPTED, {
          sequence: validation.sequence,
          position: validation.position,
          serverTimestamp: Date.now(),
          valid: validation.valid,
          error: validation.error,
        });

        if (callback) {
          callback({
            ok: validation.valid,
            position: validation.position,
            sequence: validation.sequence,
          });
        }
      } catch (err) {
        logger.error({ err, socketId: socket.id }, "Error in movement:input");
      } finally {
        timer();
      }
    });

    // --- user:mute-state ---
    socket.on(SOCKET_EVENTS.CLIENT_USER_MUTE_STATE, (data: { isMuted: boolean }) => {
      if (!socket.currentRoomId) return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (room) {
        const avatar = room.room.avatars.get(user.userId);
        if (avatar) {
          avatar.isMuted = Boolean(data.isMuted);
          socket.to(`room:${socket.currentRoomId}`).emit(SOCKET_EVENTS.SERVER_PRESENCE_UPDATED, {
            userId: user.userId,
            isMuted: avatar.isMuted,
          });
        }
      }
    });

    // --- office:leave ---
    socket.on(SOCKET_EVENTS.CLIENT_OFFICE_LEAVE, async () => {
      if (socket.currentRoomId) {
        const roomId = socket.currentRoomId;
        socket.currentRoomId = undefined;
        socket.leave(`room:${roomId}`);
        await roomManager.leaveUser(roomId, user.userId);
        socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.SERVER_OFFICE_USER_LEFT, {
          userId: user.userId,
        });
      }
    });

    // --- disconnect ---
    socket.on("disconnect", async () => {
      connectedSocketsGauge.dec();
      logger.info({ socketId: socket.id, userId: user.userId }, "Socket disconnected");
      if (socket.currentRoomId) {
        const roomId = socket.currentRoomId;
        await roomManager.leaveUser(roomId, user.userId);
        socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.SERVER_OFFICE_USER_LEFT, {
          userId: user.userId,
        });
      }
    });
  });

  // 20Hz Coalesced Broadcast Loop
  const tickIntervalMs = Math.floor(1000 / (env.MOVEMENT_TICK_HZ || DEFAULT_MOVEMENT_TICK_HZ));
  const tickInterval = setInterval(() => {
    for (const roomId of (roomManager as any).rooms.keys()) {
      const dirtyAvatars = roomManager.flushDirtyAvatars(roomId);
      if (dirtyAvatars.length > 0) {
        for (const avatar of dirtyAvatars) {
          io.to(`room:${roomId}`).emit(SOCKET_EVENTS.SERVER_MOVEMENT_UPDATED, {
            userId: avatar.userId,
            position: avatar.position,
            sequence: avatar.lastSequence,
            serverTimestamp: Date.now(),
          });
        }
      }
    }
  }, tickIntervalMs);

  // Clean up interval when io or server closes
  io.engine.on("close", () => clearInterval(tickInterval));
  (io as any).cleanup = () => clearInterval(tickInterval);

  return io;
}
