export interface Category {
  id?: string;
  companyId?: string | null;
  slug: string;
  nameRu: string;
  nameEn: string;
  color?: string;
  icon?: string;
  priority?: number;
}
