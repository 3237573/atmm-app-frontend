import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {IMemberResponse} from '../../models/member.model';

@Injectable({providedIn: 'root'})
export class MemberService {
  private readonly baseUrl = '/v1/members';
  constructor(private readonly http: HttpClient) {}

  // getMembers(): Observable<MemberResponse[]> {
  //   return this.http.get<MemberResponse[]>('/members');
  // }

  getMembers(): Observable<IMemberResponse[]> {
    return this.http.get<IMemberResponse[]>(this.baseUrl);
  }

  inviteMember(email: string, roleName: string, password: string, displayName: string): Observable<IMemberResponse[]> {
    // Путь должен совпадать с тем, что мы прописали в Ktor
    return this.http.post<any>(`${this.baseUrl}/invite`, { email, roleName, password, displayName });
  }

  removeMember(userId: string) {
    return this.http.delete(`${this.baseUrl}/${userId}`);
  }

  updateMember(userId: string, roleName: string, displayName: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/${userId}`, { roleName, displayName });
  }

  resetPassword(userId: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${userId}/reset-password`, { password: newPassword });
  }

  getMemberActivity(userId: string, from?: Date, to?: Date): Observable<any> {
    const params = new HttpParams()
      .set('from', from?.toISOString() || '')
      .set('to', to?.toISOString() || '');
    return this.http.get(`${this.baseUrl}/${userId}/activity`, { params });
  }

}
