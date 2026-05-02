export interface ITaskComment {
  id: string;
  taskId: string;
  membershipId: string;
  authorName: string;
  authorEmail: string;
  authorAvatar: string;
  content: string;
  parentCommentId?: string;
  replies?: ITaskComment[];
  status: 'ACTIVE' | 'EDITED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
}

export interface ITaskCommentCreateRequest {
  taskId: string;
  content: string;
  parentCommentId?: string;
}

export interface ITaskCommentUpdateRequest {
  content: string;
}
