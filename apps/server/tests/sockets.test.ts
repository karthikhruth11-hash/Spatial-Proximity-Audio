import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ClientSocket, Socket as ClientSocketType } from "socket.io-client";
import { createApp } from "../src/app.js";
import { setupSocketServer } from "../src/sockets/gateway.js";
import { connectDatabase, disconnectDatabase } from "../src/database/mongoose.js";
import { UserModel } from "../src/models/User.js";
import { OfficeModel } from "../src/models/Office.js";
import { generateAuthToken } from "../src/auth/service.js";
import { SOCKET_EVENTS } from "@proxispeak/shared";

describe("Socket.IO Realtime Gateway Integration", () => {
  let server: http.Server;
  let ioServer: SocketIOServer;
  let serverPort: number;
  let testOfficeId: string;
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    await connectDatabase();

    // Create 2 test users
    const u1 = await UserModel.create({
      displayName: "Alice Realtime",
      email: `alice-${Date.now()}@example.com`,
      passwordHash: "hash123",
      avatarColor: "#06b6d4",
    });
    user1Id = u1._id.toString();
    user1Token = generateAuthToken({ userId: user1Id, email: u1.email });

    const u2 = await UserModel.create({
      displayName: "Bob Realtime",
      email: `bob-${Date.now()}@example.com`,
      passwordHash: "hash123",
      avatarColor: "#8b5cf6",
    });
    user2Id = u2._id.toString();
    user2Token = generateAuthToken({ userId: user2Id, email: u2.email });

    // Create test office
    const office = await OfficeModel.create({
      name: "Socket Testing Room",
      ownerId: user1Id,
      dimensions: { width: 1600, height: 1200 },
      accessPolicy: "public",
    });
    testOfficeId = office._id.toString();

    // Start HTTP & Socket server on dynamic port
    const app = createApp();
    server = http.createServer(app);
    ioServer = setupSocketServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if ((ioServer as any)?.cleanup) {
      (ioServer as any).cleanup();
    }
    if (ioServer) {
      await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (user1Id) await UserModel.findByIdAndDelete(user1Id);
    if (user2Id) await UserModel.findByIdAndDelete(user2Id);
    if (testOfficeId) await OfficeModel.findByIdAndDelete(testOfficeId);
    await disconnectDatabase();
  });

  it("rejects unauthenticated socket connection", async () => {
    const socket = ClientSocket(`http://127.0.0.1:${serverPort}`, {
      autoConnect: true,
      transports: ["websocket"],
      forceNew: true,
    });

    const error = await new Promise<string>((resolve) => {
      socket.on("connect_error", (err) => resolve(err.message));
    });

    expect(error).toContain("Authentication required");
    socket.disconnect();
  });

  it("authenticates and joins office receiving office:state", async () => {
    const socket = ClientSocket(`http://127.0.0.1:${serverPort}`, {
      auth: { token: user1Token },
      transports: ["websocket"],
      forceNew: true,
    });

    await new Promise<void>((resolve) => socket.on("connect", () => resolve()));

    const statePromise = new Promise<any>((resolve) => {
      socket.on(SOCKET_EVENTS.SERVER_OFFICE_STATE, (state) => resolve(state));
    });

    socket.emit(SOCKET_EVENTS.CLIENT_OFFICE_JOIN, { roomId: testOfficeId });

    const state = await statePromise;
    expect(state).toBeDefined();
    expect(state.officeId).toBe(testOfficeId);
    expect(state.self.userId).toBe(user1Id);
    expect(state.layout.walls.length).toBeGreaterThan(0);

    socket.disconnect();
  });

  it("two clients join and sync movement updates", async () => {
    const socket1: ClientSocketType = ClientSocket(`http://127.0.0.1:${serverPort}`, {
      auth: { token: user1Token },
      transports: ["websocket"],
      forceNew: true,
    });
    const socket2: ClientSocketType = ClientSocket(`http://127.0.0.1:${serverPort}`, {
      auth: { token: user2Token },
      transports: ["websocket"],
      forceNew: true,
    });

    await Promise.all([
      new Promise<void>((res) => socket1.on("connect", () => res())),
      new Promise<void>((res) => socket2.on("connect", () => res())),
    ]);

    // Client 1 joins office and waits for confirmation
    await new Promise<void>((resolve) => {
      socket1.emit(SOCKET_EVENTS.CLIENT_OFFICE_JOIN, { roomId: testOfficeId }, () => resolve());
    });

    // Client 1 waits for Client 2 to join
    const userJoinedPromise = new Promise<any>((resolve) => {
      socket1.on(SOCKET_EVENTS.SERVER_OFFICE_USER_JOINED, (data) => resolve(data));
    });

    // Client 2 joins and gets its initial state
    const client2StatePromise = new Promise<any>((resolve) => {
      socket2.on(SOCKET_EVENTS.SERVER_OFFICE_STATE, (data) => resolve(data));
    });

    socket2.emit(SOCKET_EVENTS.CLIENT_OFFICE_JOIN, { roomId: testOfficeId });

    const [joinedData, client2State] = await Promise.all([
      userJoinedPromise,
      client2StatePromise,
    ]);

    expect(joinedData.user.userId).toBe(user2Id);
    const startPos = client2State.self.position;
    const targetPos = { x: startPos.x + 5, y: startPos.y + 5 };

    // Client 2 moves legally (small step of 5px each axis)
    const ackPromise = new Promise<any>((resolve) => {
      socket2.on(SOCKET_EVENTS.SERVER_MOVEMENT_ACCEPTED, (data) => resolve(data));
    });

    const updateReceivedByClient1 = new Promise<any>((resolve) => {
      socket1.on(SOCKET_EVENTS.SERVER_MOVEMENT_UPDATED, (data) => {
        if (data.userId === user2Id) resolve(data);
      });
    });

    socket2.emit(SOCKET_EVENTS.CLIENT_MOVEMENT_INPUT, {
      sequence: 1,
      proposedPosition: targetPos,
      dt: 0.05,
    });

    const ack = await ackPromise;
    expect(ack.valid).toBe(true);
    expect(ack.position).toEqual(targetPos);

    const movementUpdate = await updateReceivedByClient1;
    expect(movementUpdate.userId).toBe(user2Id);
    expect(movementUpdate.position).toEqual(targetPos);

    // Client 2 tries impossible speed movement
    const illegalAckPromise = new Promise<any>((resolve) => {
      socket2.on(SOCKET_EVENTS.SERVER_MOVEMENT_ACCEPTED, (data) => {
        if (data.sequence === 2) resolve(data);
      });
    });

    socket2.emit(SOCKET_EVENTS.CLIENT_MOVEMENT_INPUT, {
      sequence: 2,
      proposedPosition: { x: targetPos.x + 800, y: targetPos.y + 800 }, // Teleportation
      dt: 0.05,
    });

    const illegalAck = await illegalAckPromise;
    expect(illegalAck.valid).toBe(false);
    expect(illegalAck.error).toBe("SPEED_EXCEEDED");
    // Authoritative position stayed at previous valid pos
    expect(illegalAck.position).toEqual(targetPos);

    socket1.disconnect();
    socket2.disconnect();
  });
});
