import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {CreateDepartmentRequest, DepartmentRO, UpdateDepartmentRequest} from '../../models/departament.model';


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

  createDepartment(request: CreateDepartmentRequest): Observable<DepartmentRO> {
    return this.http.post<DepartmentRO>(this.baseUrl, request);
  }

  updateDepartment(id: string, request: UpdateDepartmentRequest): Observable<DepartmentRO> {
    return this.http.put<DepartmentRO>(`${this.baseUrl}/${id}`, request);
  }

  deleteDepartment(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/${id}`);
  }

  // department.service.ts
  assignEmployee(departmentId: string, membershipId: string, roleInDepartment: string): Observable<void> {
    // На бэкенде: POST /v1/departments/{id}/employees с телом { membershipId }
    return this.http.post<void>(`${this.baseUrl}/${departmentId}/employees`, {membershipId, roleInDepartment});
  }

  removeEmployee(departmentId: string, membershipId: string): Observable<void> {
    // На бэкенде: DELETE /v1/departments/employees/{membershipId}
    return this.http.delete<void>(`${this.baseUrl}/${departmentId}/employees/${membershipId}`);
  }

  setHead(departmentId: string, headMembershipId: string): Observable<void> {
    // На бэкенде: PUT /v1/departments/{id}/head
    return this.http.put<void>(`${this.baseUrl}/${departmentId}/head`, {headMembershipId});
  }

}
