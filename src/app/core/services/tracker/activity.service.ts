import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

export interface CategoryStatDTO {
  slug: string;
  color: string;
  minutes: number;
}

export interface ActivityInterval {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  projectName: string;
  categorySlug: string;
  color: string; // Цвет из БД
  activityType: string;
}

export interface UserActivityReport {
  userId: string;
  date: string;
  totalActiveMinutes: number;
  intervals: ActivityInterval[];
  projectDistribution: { [key: string]: number };
  categoryDistribution: CategoryStatDTO[]; // Распределение по категориям
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);

  getReport(date: string, userId?: string): Observable<any> {
    const params: any = { date };
    if (userId) params.userId = userId;
    return this.http.get<UserActivityReport>(`/tracker/report`, { params });
  }

  // Тот самый метод для "серой" функции бэкенда
  createCustomCategory(category: { slug: string; nameRu: string; color: string }): Observable<any> {
    return this.http.post(`/settings/categories`, category);
  }
}
