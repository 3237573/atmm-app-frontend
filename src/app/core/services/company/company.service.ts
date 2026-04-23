import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ICompany} from '../../models/company.model';

@Injectable({providedIn: 'root'})
export class CompanyService {
  private readonly baseUrl = '/v1/company';
  constructor(private readonly http: HttpClient) {}

  getCompany(): Observable<ICompany> {
    return this.http.get<ICompany>(this.baseUrl);
  }

  updateCompany(payload: { name: string; code: string }): Observable<ICompany> {
    return this.http.patch<ICompany>(this.baseUrl, payload);
  }
}
