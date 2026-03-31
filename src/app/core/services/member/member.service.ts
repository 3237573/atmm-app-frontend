import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {MemberResponse} from '../../models/member.model';

@Injectable({providedIn: 'root'})
export class MemberService {
  constructor(private readonly http: HttpClient) {
  }

  getMembers(): Observable<MemberResponse[]> {
    return this.http.get<MemberResponse[]>('/members');
  }
}
