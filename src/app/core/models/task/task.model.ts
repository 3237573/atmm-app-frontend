export type SysStatus = 'ACTIVE' | 'DRAFT' | 'PENDING' | 'ARCHIVED' | 'REJECTED' | 'DELETED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'ARCHIVED';

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; class: string }> = {
  PENDING: { label: 'Ожидает', class: 'status-pending' },
  IN_PROGRESS: { label: 'В работе', class: 'status-progress' },
  REVIEW: { label: 'Проверка', class: 'status-review' },
  COMPLETED: { label: 'Готово', class: 'status-completed' },
  ARCHIVED: { label: 'Архив', class: 'status-archived' }
};

export const TASK_STATUS_LIST = Object.keys(TASK_STATUS_CONFIG) as TaskStatus[];


export interface TaskRO {
  assigneeId?: string;
  assigneeIds?: string[];
  assigneeNames: string;
  attachments: TaskAttachmentRO[];
  commentsCount?: number;
  createdAt: string;
  creatorId?: string;
  creatorMemberId?: string;
  creatorName?: string;
  departmentId: string;
  departmentName: string;
  description: string;
  dueDate?: string;
  estimatedHours?: number;
  id: string;
  parentTaskId?: string;
  parentTaskTitle?: string;
  priority: TaskPriority;
  projectId?: string;
  projectName?: string;
  status: SysStatus;
  taskStatus: TaskStatus;
  subtasksCount?: number;
  timeSpent?: number; // в часах
  title: string;
  updatedAt?: string;
}

export interface TaskCreateRO {
  taskStatus: TaskStatus;
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
  assigneeMemberIds?: string[];
  dueDate?: string;
  parentTaskId?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  memberId: string;
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
