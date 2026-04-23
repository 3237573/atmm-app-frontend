import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IUser, AuthMeResponse } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // --- 1. Состояние (Signals) ---
  readonly currentUser = signal<IUser | null>(null);
  readonly companyId = signal<string | null>(null);
  readonly permissions = signal<string[]>([]);
  readonly isAuthenticated = signal<boolean>(false);

  // --- 2. Проверка прав ---

  /** Синхронная проверка (для логики в методах) */
  hasPermission(permission: string): boolean {
    console.log("permission:", permission);
    console.log("this.permissions:", this.permissions);
    return this.permissions()?.includes(permission) ?? false;
  }

  /** Реактивная проверка (для computed-свойств в компонентах) */
  hasPermission$(permission: string) {
    return computed(() => this.permissions().includes(permission));
  }

  // --- 3. Внутренняя логика ---

  /** * Центральный узел обновления данных.
   * Обрабатывает твой UserMeResponse (user, companyId, permissions)
   */
  private handleAuthResponse(res: AuthMeResponse | null): void {
    if (res) {
      this.currentUser.set(res.user);
      this.companyId.set(res.companyId);
      this.permissions.set(res.permissions);
      this.isAuthenticated.set(true);
    } else {
      this.currentUser.set(null);
      this.companyId.set(null);
      this.permissions.set([]);
      this.isAuthenticated.set(false);
    }
  }

  // --- 4. API Методы ---

  /** Вызывается при старте приложения (AppInitializer) */
  checkAuth(): Observable<AuthMeResponse | null> {
    return this.http.get<AuthMeResponse>('/auth/me', { withCredentials: true }).pipe(
      tap((res) => this.handleAuthResponse(res)),
      catchError(() => {
        this.handleAuthResponse(null);
        return of(null);
      })
    );
  }

  /** Авторизация */
  login(credentials: any): Observable<AuthMeResponse> {
    return this.http.post<AuthMeResponse>('auth/login', credentials, { withCredentials: true })
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  /** Регистрация (Теперь точно на месте!) */
  register(data: any): Observable<AuthMeResponse> {
    return this.http.post<AuthMeResponse>('auth/register', data, { withCredentials: true })
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  /** Выход из системы */
  logout(): Observable<any> {
    return this.http.post('auth/logout', {}, { withCredentials: true }).pipe(
      tap(() => {
        this.handleAuthResponse(null);
        this.router.navigate(['/login']);
      }),
      catchError(() => {
        this.handleAuthResponse(null);
        this.router.navigate(['/login']);
        return of(null);
      })
    );
  }
}
