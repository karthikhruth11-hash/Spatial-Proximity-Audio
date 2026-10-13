# ProxiSpeak Socket.IO Event Specification

This document defines the formal Socket.IO communication contract for ProxiSpeak. All events follow the `domain:action` naming standard and are validated via Zod schemas in `@proxispeak/shared`.

## Client-to-Server Events

| Event Name | Scope | Payload Schema | Description |
|---|---|---|---|
| `office:join` | to-server | `{ roomId: string }` | Request to join authoritative office room |
| `office:leave` | to-server | `{ roomId: string }` | Clean exit from office room |
| `movement:input` | to-server | `MovementInputSchema` | Client movement intent with sequence number and dt |
| `audio:request` | to-server | `{ peerId: string }` | Request authorization for WebRTC peer connection |
| `webrtc:offer` | to-peer (relayed) | `SignalingEnvelopeSchema` | WebRTC SDP offer |
| `webrtc:answer` | to-peer (relayed) | `SignalingEnvelopeSchema` | WebRTC SDP answer |
| `webrtc:ice-candidate`| to-peer (relayed) | `SignalingEnvelopeSchema` | WebRTC trickle ICE candidate |
| `user:mute-state` | to-room | `{ isMuted: boolean }` | Broadcast microphone mute state |
| `diagnostics:report` | to-server | `DiagnosticsReportSchema` | Periodic client telemetry for Prometheus |

## Server-to-Client Events

| Event Name | Scope | Payload Schema | Description |
|---|---|---|---|
| `office:state` | to-sender | `{ office, avatars[], layout }` | Initial authoritative room state on join |
| `office:user-joined` | to-room | `{ user: AvatarState }` | Broadcast new avatar arrival in room |
| `office:user-left` | to-room | `{ userId: string }` | Broadcast avatar departure |
| `movement:accepted` | to-sender | `MovementAcceptedSchema` | Ack with authoritative position & seq reconciliation |
| `movement:updated` | to-room | `MovementUpdatedSchema` | Coalesced tick movement update for interpolation |
| `proximity:entered` | to-sender | `ProximityTransitionSchema` | Emitted when peer is within hearing radius (<= 100px) |
| `proximity:exited` | to-sender | `ProximityTransitionSchema` | Emitted when peer exceeds radius + margin (> 110px) |
| `audio:authorized` | to-both-peers | `AudioAuthorizedSchema` | Grants WebRTC negotiation rights with polite flag |
| `audio:revoked` | to-both-peers | `AudioRevokedSchema` | Revokes audio connection when out of range |
| `webrtc:offer` | to-peer | `SignalingEnvelopeSchema` | Authorized relay of SDP offer |
| `webrtc:answer` | to-peer | `SignalingEnvelopeSchema` | Authorized relay of SDP answer |
| `webrtc:ice-candidate`| to-peer | `SignalingEnvelopeSchema` | Authorized relay of ICE candidate |
| `presence:updated` | to-room | `{ userIds: string[] }` | Heartbeat presence refresh |
| `server:error` | to-sender | `{ code: string, message: string }` | Structured error notification |
