import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, retry, shareReplay, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ActivityInterval {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  projectName: string;
  entityName?: string;
}

export interface UserActivityReport {
  totalActiveMinutes: number;
  intervals: ActivityInterval[];
  projectDistribution: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/tracker'; // Настрой под свой прокси или environment

  getReport(date: string, userId?: string): Observable<UserActivityReport> {
    let params = new HttpParams().set('date', date);
    if (userId) {
      params = params.set('userId', userId);
    }

    return this.http.get<UserActivityReport>(`${this.baseUrl}/report`, { params }).pipe(
      retry(1),
      shareReplay(1)
    );
  }
}
