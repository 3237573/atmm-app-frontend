export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'ARCHIVED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ITaskRO {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeName: string;
  assigneeIds?: string[];
  departmentName: string;
  departmentId?: string;
  projectName?: string;
  projectId?: string;
  dueDate?: string;
  parentTaskId?: string;
  parentTaskTitle?: string;
  createdAt: string;
  updatedAt?: string;
  timeSpent?: number; // в часах
  estimatedHours?: number;
}

export interface ITaskCreateRO {
  title: string;
  description?: string;
  priority: TaskPriority;
  departmentId?: string;
  projectId?: string;
  assigneeMembershipIds: string[];
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

export interface ITaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}
