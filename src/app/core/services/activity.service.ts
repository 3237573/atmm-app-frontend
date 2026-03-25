import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ActivityInterval {
  startTime: string; // ISO формат с бэкенда
  endTime: string;
  durationMinutes: number;
  projectName: string;
}

export interface UserActivityReport {
  totalActiveMinutes: number;
  intervals: ActivityInterval[];
  projectDistribution: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:9083/api/tracker';

  getDailyReport(date: string): Observable<UserActivityReport> {
    return this.http.get<UserActivityReport>(`${this.baseUrl}/report`, { params: { date } });
  }
}
