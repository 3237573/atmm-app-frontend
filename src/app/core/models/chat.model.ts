// core/models/chat.model.ts
export interface ChatRoom {
  id: string;
  name: string | null;
  type: 'DIRECT' | 'GROUP' | 'PROJECT';
  projectId: string | null;
  departmentId: string | null;
  memberCount: number;
  lastMessage?: ChatMessage;
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
  senderMembershipId: string;
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
  memberIds: string[];   // membership IDs
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
  | { type: 'send_message'; message: SendMessageRequest }
  | { type: 'typing'; roomId: string; isTyping: boolean }
  | { type: 'mark_seen'; messageId: string }
  | { type: 'call_offer'; roomId: string; sdp: string; callType: string }
  | { type: 'call_answer'; roomId: string; sdp: string }
  | { type: 'call_ice'; roomId: string; candidate: string }
  | { type: 'call_end'; roomId: string }
  | { type: 'ping' };

export type WebSocketResponse =
  | { type: 'new_message'; message: ChatMessage }
  | { type: 'message_seen'; messageId: string; membershipId: string }
  | { type: 'typing_indicator'; roomId: string; membershipId: string; isTyping: boolean }
  | { type: 'call_offer'; fromId: string; sdp: string; callType: string }
  | { type: 'call_answer'; fromId: string; sdp: string }
  | { type: 'call_ice'; fromId: string; candidate: string }
  | { type: 'call_ended'; roomId: string };
