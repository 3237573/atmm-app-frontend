import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MemberResponse } from '../models/member.model';

@Injectable({
  providedIn: 'root'
})
export class MemberService {
  private readonly apiUrl = 'http://localhost:9083/api/members'; // Твой URL бэкенда

  constructor(private readonly http: HttpClient) {}

  getMembers(): Observable<MemberResponse[]> {
    return this.http.get<MemberResponse[]>(this.apiUrl);
  }
}
