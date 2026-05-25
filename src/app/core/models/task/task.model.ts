export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'ARCHIVED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TaskRO {
  id: string;
  title: string;
  commentsCount?: number;
  subtasksCount?: number;
  creatorId?: string;
  creatorName?: string
  creatorMembershipId?: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeIds?: string[];
  assigneeNames: string;
  departmentName: string;
  departmentId: string;
  projectName?: string;
  projectId?: string;
  dueDate?: string;
  parentTaskId?: string;
  parentTaskTitle?: string;
  createdAt: string;
  updatedAt?: string;
  timeSpent?: number; // в часах
  estimatedHours?: number;
  attachments: TaskAttachmentRO[]
}

export interface TaskCreateRO {
  title: string;
  description?: string;
  priority: TaskPriority;
  departmentId: string;
  projectId?: string;
  assigneeIds: string[];
  dueDate?: string;
  parentTaskId?: string;
}

export interface ITaskUpdateRO {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  departmentId?: string;
  projectId?: string;
  assigneeMembershipIds?: string[];
  dueDate?: string;
  parentTaskId?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  membershipId: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorAvatar: string;
  content: string;
  parentCommentId?: string;
  status: 'ACTIVE' | 'EDITED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
  replies?: TaskComment[];
}

export interface TaskTreeRO {
  task: TaskRO;
  subtasks: TaskTreeRO[];
}

export interface TaskAttachmentRO {
  id: string;
  filename: string;
  fileSize: number;
  fileType: string;
  filePath: string;
  createdAt: string;
}
