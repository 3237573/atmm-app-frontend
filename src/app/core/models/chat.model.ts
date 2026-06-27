// core/models/chat.model.ts
export interface ChatRoomBaseRO {
  id: string;
  name: string | null;
  unreadCount: number;
}

export interface ChatRoomRO {
  id: string;
  name: string | null;
  type: 'DIRECT' | 'GROUP' | 'PROJECT';
  projectId: string | null;
  departmentId: string | null;
  memberIds: string[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  encrypted: boolean;
  timestamp: string;
  senderName: string;
  senderMemberId: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE' | 'VIDEO' | 'SYSTEM';
  roomId: string;
  replyToMessageId?: string;
  metadata?: Record<string, string>;
  mediaUrl?: string;
  thumbnailUrl?: string;
  mediaSize?: number;
  mediaDuration?: number;
}

export interface CreateChatRoomRequest {
  name?: string;
  type: string;
  projectId?: string;
  departmentId?: string;
  memberIds: string[];
}

export interface AddMembersRequest {
  memberIds: string[];
}

export interface SendMessageRequest {
  roomId: string;
  content: string;
  replyToMessageId?: string;
  encrypted?: boolean;
  nonce?: string;
  metadata?: Record<string, string>;
}

// WebSocket message types
export type WebSocketMessage =
  | { type: 'read_room'; roomId: string; untilTimestamp: string }
  | { type: 'send_message'; message: SendMessageRequest }
  | { type: 'typing'; roomId: string; isTyping: boolean }
  | { type: 'mark_seen'; messageId: string; roomId?: string }
  | { type: 'call_offer'; roomId: string; sdp: string; callType: string }
  | { type: 'call_answer'; roomId: string; sdp: string }
  | { type: 'call_ice'; roomId: string; candidate: IceCandidateModel }
  | { type: 'call_end'; roomId: string }
  | { type: 'ping' };

export type WebSocketResponse =
  | { type: 'room_read'; message: ChatMessage }
  | { type: 'new_message'; message: ChatMessage }
  | { type: 'message_seen'; messageId: string; memberId: string }
  | { type: 'typing_indicator'; roomId: string; memberId: string; isTyping: boolean }
  | { type: 'call_offer'; fromId: string; senderName: string; targetName: string; roomId: string; sdp: string; callType: string }
  | { type: 'call_answer'; fromId: string; sdp: string }
  | { type: 'call_ice'; fromId: string; candidate: IceCandidateModel }
  | { type: 'call_ended'; roomId: string }
  | { type: 'call_handled_elsewhere' };


export interface IceCandidateModel {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

// E2EE

export interface UploadKeysRequest {
  deviceId: string;
  identityKey: string;
  oneTimeKeys: Record<string, string>; // Пул ключей: { "key_1": "public_key_base64...", ... }
}

export interface ClaimKeysRequest {
  memberIds: string[];
}

export interface DeviceKeys {
  deviceId: string;
  identityKey: string;
  oneTimeKeyId?: string
  oneTimeKey?: string
}

export interface ClaimKeysResponse {
  // Карта сопоставления: memberId -> Ключи устройства
  keys: Record<string, DeviceKeys[]>;
}

