export const SOCKET_EVENTS = {
  // Client to Server
  CLIENT_OFFICE_JOIN: "office:join",
  CLIENT_OFFICE_LEAVE: "office:leave",
  CLIENT_MOVEMENT_INPUT: "movement:input",
  CLIENT_AUDIO_REQUEST: "audio:request",
  CLIENT_WEBRTC_OFFER: "webrtc:offer",
  CLIENT_WEBRTC_ANSWER: "webrtc:answer",
  CLIENT_WEBRTC_ICE_CANDIDATE: "webrtc:ice-candidate",
  CLIENT_USER_MUTE_STATE: "user:mute-state",
  CLIENT_DIAGNOSTICS_REPORT: "diagnostics:report",

  // Server to Client
  SERVER_OFFICE_STATE: "office:state",
  SERVER_OFFICE_USER_JOINED: "office:user-joined",
  SERVER_OFFICE_USER_LEFT: "office:user-left",
  SERVER_MOVEMENT_ACCEPTED: "movement:accepted",
  SERVER_MOVEMENT_UPDATED: "movement:updated",
  SERVER_PROXIMITY_ENTERED: "proximity:entered",
  SERVER_PROXIMITY_EXITED: "proximity:exited",
  SERVER_AUDIO_AUTHORIZED: "audio:authorized",
  SERVER_AUDIO_REVOKED: "audio:revoked",
  SERVER_WEBRTC_OFFER: "webrtc:offer",
  SERVER_WEBRTC_ANSWER: "webrtc:answer",
  SERVER_WEBRTC_ICE_CANDIDATE: "webrtc:ice-candidate",
  SERVER_PRESENCE_UPDATED: "presence:updated",
  SERVER_ERROR: "server:error",
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
