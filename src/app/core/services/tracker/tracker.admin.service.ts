import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {Category} from '../../models/tracker/category.model';
import {CategoryRule} from '../../models/tracker/category.rule.model';


@Injectable({ providedIn: 'root' })
export class TrackerAdminService {
  private readonly baseUrl = '/admin/tracker';

  constructor(private readonly http: HttpClient) {}

  createCategory(newCategory: Category): Observable<any> { return this.http.post(`${this.baseUrl}/categories`, newCategory); }
  deleteCategory(id: string): Observable<any> { return this.http.delete(`${this.baseUrl}/categories/${id}`);  }
  getCategories(): Observable<Category[]> { return this.http.get<Category[]>(`${this.baseUrl}/categories`); }
  patchCategory(category: Category): Observable<any> { return this.http.patch(`${this.baseUrl}/categories/${category.id}`, category); }
  getRules(): Observable<CategoryRule[]> { return this.http.get<CategoryRule[]>(`${this.baseUrl}/rules`); }
  addRule(rule: CategoryRule): Observable<any> { return this.http.post(`${this.baseUrl}/rules`, rule); }
  deleteRule(id: string): Observable<any> { return this.http.delete(`${this.baseUrl}/rules/${id}`); }

  createRule(payload: { categoryId: string; pattern: string }): Observable<any> { return this.http.post(`${this.baseUrl}/rules`, payload); }
}
