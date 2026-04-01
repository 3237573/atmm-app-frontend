export interface Category {
  id?: string;
  companyId?: string | null;
  name: string;
  slug: string;
  color?: string;
  icon?: string;
  priority?: number;
}
