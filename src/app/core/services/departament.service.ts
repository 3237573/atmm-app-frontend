import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {CreateDepartmentRequest, DepartmentRO, UpdateDepartmentRequest} from '../models/departament.model';
import {MemberRO} from '../models/member.model';
import {MemberService} from './member.service';


@Injectable({providedIn: 'root'})
export class DepartmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/v1/departments';

  getDepartments(): Observable<DepartmentRO[]> {
    return this.http.get<DepartmentRO[]>(this.baseUrl);
  }

  getDepartmentById(id: string): Observable<DepartmentRO> {
    return this.http.get<DepartmentRO>(`${this.baseUrl}/${id}`);
  }

  getDepartmentEmployees(id: string): Observable<MemberRO[]> {
    return this.http.get<MemberRO[]>(`${this.baseUrl}/${id}/employees`);
  }

  createDepartment(request: CreateDepartmentRequest): Observable<DepartmentRO> {
    return this.http.post<DepartmentRO>(this.baseUrl, request);
  }

  updateDepartment(id: string, request: UpdateDepartmentRequest): Observable<DepartmentRO> {
    return this.http.put<DepartmentRO>(`${this.baseUrl}/${id}`, request);
  }

  deleteDepartment(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/${id}`);
  }

  assignEmployee(departmentId: string, memberId: string, roleInDepartment: string): Observable<void> {
    // На бэкенде: POST /v1/departments/{id}/employees с телом { memberId }
    return this.http.post<void>(`${this.baseUrl}/${departmentId}/employees`, {memberId, roleInDepartment});
  }

  updateEmployeeRole(departmentId: string, memberId: string, role: string) {
    return this.http.patch(`/v1/departments/${departmentId}/employees/${memberId}`, { role });
  }


  removeEmployee(departmentId: string, memberId: string): Observable<void> {
    // На бэкенде: DELETE /v1/departments/employees/{memberId}
    return this.http.delete<void>(`${this.baseUrl}/${departmentId}/employees/${memberId}`);
  }

  setHead(departmentId: string, headMemberId: string): Observable<void> {
    // На бэкенде: PUT /v1/departments/{id}/head
    return this.http.patch<void>(`${this.baseUrl}/${departmentId}/head`, {headMemberId});
  }

}
