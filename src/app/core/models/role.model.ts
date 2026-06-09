export interface RoleResponse {
  id: string;
  name: string;
  workspaceId: string;
  permissions: string[];   // Имена: ['user:read', 'user:create']
  permissionIds: string[]; // UUID: ['...', '...']
}

// Для группировки в UI
export interface PermissionGroup {
  name: string;
  items: SystemPermission[];
}

export interface SystemPermission {
  id: string;
  name: string;
  description?: string; // Полезно для тултипов
}
