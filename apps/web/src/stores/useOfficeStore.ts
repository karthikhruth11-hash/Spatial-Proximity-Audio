import { create } from "zustand";
import {
  AvatarState,
  OfficeLayout,
  OfficeDimensions,
  Point,
  UserProfile,
} from "@proxispeak/shared";

interface OfficeState {
  currentUser: UserProfile | null;
  officeId: string | null;
  dimensions: OfficeDimensions;
  layout: OfficeLayout | null;
  localAvatar: AvatarState | null;
  remoteAvatars: Record<string, AvatarState>;
  isConnected: boolean;

  setCurrentUser: (user: UserProfile | null) => void;
  setOfficeState: (
    officeId: string,
    dimensions: OfficeDimensions,
    layout: OfficeLayout,
    localAvatar: AvatarState,
    remoteAvatars: AvatarState[],
  ) => void;
  updateLocalPosition: (pos: Point, seq: number) => void;
  upsertRemoteAvatar: (avatar: AvatarState) => void;
  removeRemoteAvatar: (userId: string) => void;
  updateRemotePosition: (userId: string, pos: Point, seq: number) => void;
  setAvatarMute: (userId: string, isMuted: boolean) => void;
  setConnected: (connected: boolean) => void;
  resetOffice: () => void;
}

export const useOfficeStore = create<OfficeState>((set) => ({
  currentUser: null,
  officeId: null,
  dimensions: { width: 1600, height: 1200 },
  layout: null,
  localAvatar: null,
  remoteAvatars: {},
  isConnected: false,

  setCurrentUser: (user) => set({ currentUser: user }),

  setOfficeState: (officeId, dimensions, layout, localAvatar, remoteAvatarsList) => {
    const remoteMap: Record<string, AvatarState> = {};
    for (const a of remoteAvatarsList) {
      if (a.userId !== localAvatar.userId) {
        remoteMap[a.userId] = a;
      }
    }
    set({
      officeId,
      dimensions,
      layout,
      localAvatar,
      remoteAvatars: remoteMap,
      isConnected: true,
    });
  },

  updateLocalPosition: (position, seq) =>
    set((state) => {
      if (!state.localAvatar) return state;
      return {
        localAvatar: {
          ...state.localAvatar,
          position,
          lastSequence: seq,
        },
      };
    }),

  upsertRemoteAvatar: (avatar) =>
    set((state) => {
      if (state.localAvatar?.userId === avatar.userId) return state;
      return {
        remoteAvatars: {
          ...state.remoteAvatars,
          [avatar.userId]: avatar,
        },
      };
    }),

  removeRemoteAvatar: (userId) =>
    set((state) => {
      const next = { ...state.remoteAvatars };
      delete next[userId];
      return { remoteAvatars: next };
    }),

  updateRemotePosition: (userId, position, sequence) =>
    set((state) => {
      const existing = state.remoteAvatars[userId];
      if (!existing) return state;
      return {
        remoteAvatars: {
          ...state.remoteAvatars,
          [userId]: {
            ...existing,
            position,
            lastSequence: sequence,
          },
        },
      };
    }),

  setAvatarMute: (userId, isMuted) =>
    set((state) => {
      if (state.localAvatar?.userId === userId) {
        return {
          localAvatar: { ...state.localAvatar, isMuted },
        };
      }
      const existing = state.remoteAvatars[userId];
      if (!existing) return state;
      return {
        remoteAvatars: {
          ...state.remoteAvatars,
          [userId]: { ...existing, isMuted },
        },
      };
    }),

  setConnected: (connected) => set({ isConnected: connected }),

  resetOffice: () =>
    set({
      officeId: null,
      layout: null,
      localAvatar: null,
      remoteAvatars: {},
      isConnected: false,
    }),
}));
