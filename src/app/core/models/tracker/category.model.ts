export interface Category {
  id?: string;
  workspaceId?: string | null;
  name: string;
  slug: string;
  color?: string;
  icon?: string;
  priority?: number;
}
