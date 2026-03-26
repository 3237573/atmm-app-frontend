import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';

class UserActivityReport {}

@Injectable({ providedIn: 'root' })
export class TrackerService {

  constructor(private readonly http: HttpClient) {}

  getUserReport(userId: string, date?: string) {
    let params = new HttpParams();
    if (date) params = params.set('date', date);

    // Вызываем наш универсальный эндпоинт /report/{userId}
    return this.http.get<UserActivityReport>(`/report/${userId}`, { params });
  }
}
