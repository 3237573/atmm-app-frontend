import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {MemberResponse} from '../../models/member.model';

@Injectable({providedIn: 'root'})
export class MemberService {
  private readonly baseUrl = '/v1/members';
  constructor(private readonly http: HttpClient) {}

  // getMembers(): Observable<MemberResponse[]> {
  //   return this.http.get<MemberResponse[]>('/members');
  // }

  getMembers(): Observable<MemberResponse[]> {
    return this.http.get<MemberResponse[]>(this.baseUrl);
  }

  inviteMember(email: string, roleName: string, password: string): Observable<MemberResponse[]> {
    // Путь должен совпадать с тем, что мы прописали в Ktor
    return this.http.post<any>(`${this.baseUrl}/invite`, { email, roleName, password });
  }

  removeMember(userId: string) {
    return this.http.delete(`${this.baseUrl}/${userId}`);
  }

}
