import { io, Socket } from "socket.io-client";
import {
  SOCKET_EVENTS,
  MovementInput,
  MovementAccepted,
  MovementUpdated,
  AvatarState,
  OfficeLayout,
  OfficeDimensions,
} from "@proxispeak/shared";

export interface OfficeStatePayload {
  officeId: string;
  dimensions: OfficeDimensions;
  layout: OfficeLayout;
  avatars: AvatarState[];
  self: AvatarState;
}

export interface RealtimeClientCallbacks {
  onOfficeState: (state: OfficeStatePayload) => void;
  onUserJoined: (avatar: AvatarState) => void;
  onUserLeft: (userId: string) => void;
  onMovementAccepted: (ack: MovementAccepted & { valid?: boolean; error?: string }) => void;
  onMovementUpdated: (update: MovementUpdated) => void;
  onMuteUpdated: (userId: string, isMuted: boolean) => void;
  onConnectionChange: (connected: boolean) => void;
}

export class RealtimeClient {
  private socket: Socket | null = null;
  private callbacks: RealtimeClientCallbacks;
  private currentRoomId: string | null = null;

  constructor(callbacks: RealtimeClientCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(token?: string): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io({
      auth: token ? { token } : undefined,
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      this.callbacks.onConnectionChange(true);
      if (this.currentRoomId) {
        this.emitJoin(this.currentRoomId);
      }
    });

    this.socket.on("disconnect", () => {
      this.callbacks.onConnectionChange(false);
    });

    this.socket.on(SOCKET_EVENTS.SERVER_OFFICE_STATE, (data: OfficeStatePayload) => {
      this.callbacks.onOfficeState(data);
    });

    this.socket.on(SOCKET_EVENTS.SERVER_OFFICE_USER_JOINED, (data: { user: AvatarState }) => {
      this.callbacks.onUserJoined(data.user);
    });

    this.socket.on(SOCKET_EVENTS.SERVER_OFFICE_USER_LEFT, (data: { userId: string }) => {
      this.callbacks.onUserLeft(data.userId);
    });

    this.socket.on(
      SOCKET_EVENTS.SERVER_MOVEMENT_ACCEPTED,
      (data: MovementAccepted & { valid?: boolean; error?: string }) => {
        this.callbacks.onMovementAccepted(data);
      },
    );

    this.socket.on(SOCKET_EVENTS.SERVER_MOVEMENT_UPDATED, (data: MovementUpdated) => {
      this.callbacks.onMovementUpdated(data);
    });

    this.socket.on(
      SOCKET_EVENTS.SERVER_PRESENCE_UPDATED,
      (data: { userId: string; isMuted: boolean }) => {
        this.callbacks.onMuteUpdated(data.userId, data.isMuted);
      },
    );
  }

  public joinOffice(roomId: string): Promise<boolean> {
    this.currentRoomId = roomId;
    return this.emitJoin(roomId);
  }

  private emitJoin(roomId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve(false);
      this.socket.emit(
        SOCKET_EVENTS.CLIENT_OFFICE_JOIN,
        { roomId },
        (response: { ok: boolean }) => {
          resolve(response?.ok ?? false);
        },
      );
    });
  }

  public sendMovement(input: MovementInput): void {
    if (!this.socket) return;
    this.socket.emit(SOCKET_EVENTS.CLIENT_MOVEMENT_INPUT, input);
  }

  public setMuteState(isMuted: boolean): void {
    if (!this.socket) return;
    this.socket.emit(SOCKET_EVENTS.CLIENT_USER_MUTE_STATE, { isMuted });
  }

  public leaveOffice(): void {
    if (!this.socket) return;
    this.socket.emit(SOCKET_EVENTS.CLIENT_OFFICE_LEAVE);
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }
}
