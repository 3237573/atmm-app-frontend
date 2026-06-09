export interface AppStatDTO {
  name: string;
  minutes: number;
  color: string;
  categorySlug: string;
}

export interface UserActivityReport {
  userId: string;
  date: string;
  totalActiveMinutes: number;
  intervals: any[];
  projectDistribution: { [key: string]: number };
  projectDistributionList: AppStatDTO[];

  categoryDistribution: any[];
}
