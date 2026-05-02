import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthMeResponse, CompanyInfo, IMembership, UserCompaniesResponse } from '../../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // Состояние
  readonly currentMembership = signal<IMembership | null>(null);
  readonly currentCompany = signal<CompanyInfo | null>(null);
  readonly permissions = signal<string[]>([]);
  readonly isAuthenticated = signal<boolean>(false);
  readonly availableCompanies = signal<CompanyInfo[]>([]);
  readonly authStep = signal<'login' | 'select-company'>('login');

  // Computed для обратной совместимости
  readonly currentUser = computed(() => this.currentMembership());

  readonly hasMultipleCompanies = computed(() => this.availableCompanies().length > 1);
  readonly displayName = computed(() => {
    const company = this.currentCompany();
    const membership = this.currentMembership();
    return company?.displayName || membership?.displayName || membership?.fullName || membership?.email?.split('@')[0] || 'User';
  });

  hasPermission(permission: string): boolean {
    return this.permissions()?.includes(permission) ?? false;
  }

  hasPermission$(permission: string) {
    return computed(() => this.permissions().includes(permission));
  }

  private handleAuthResponse(res: AuthMeResponse | null): void {
    if (res) {
      this.currentMembership.set(res.membership);
      this.currentCompany.set(res.company);
      this.permissions.set(res.permissions);
      this.isAuthenticated.set(true);
      this.authStep.set('login');
    } else {
      this.clearAuth();
    }
  }

  clearAuth(): void {
    this.currentMembership.set(null);
    this.currentCompany.set(null);
    this.permissions.set([]);
    this.isAuthenticated.set(false);
    this.availableCompanies.set([]);
    this.authStep.set('login');
  }

  checkAuth(): Observable<AuthMeResponse | null> {
    return this.http.get<AuthMeResponse>('/auth/me', { withCredentials: true }).pipe(
      tap((res) => this.handleAuthResponse(res)),
      catchError(() => {
        this.clearAuth();
        return of(null);
      })
    );
  }

  /** Шаг 1: Проверка пароля и получение списка компаний */
  authenticate(credentials: { email: string; password: string }): Observable<UserCompaniesResponse> {
    this.clearAuth();

    return this.http.post<UserCompaniesResponse>('/auth/authenticate', credentials).pipe(
      tap((res) => {
        this.availableCompanies.set(res.companies);
        this.authStep.set('select-company');
      })
    );
  }

  /** Шаг 2: Выбор компании и получение токена */
  selectCompany(companyId: string, membershipId: string): Observable<AuthMeResponse> {
    return this.http.post<AuthMeResponse>('/auth/select-company', {
      companyId: companyId,
      membershipId: membershipId
    }, { withCredentials: true }).pipe(
      tap((res) => this.handleAuthResponse(res))
    );
  }

  login(credentials: { email: string; password: string }): Observable<UserCompaniesResponse> {
    return this.authenticate(credentials);
  }

  register(data: any): Observable<AuthMeResponse> {
    return this.http.post<AuthMeResponse>('/auth/register', data, { withCredentials: true })
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  logout(): Observable<any> {
    return this.http.post('/auth/logout', {}, { withCredentials: true }).pipe(
      tap(() => {
        this.clearAuth();
        this.router.navigate(['/login']);
      }),
      catchError(() => {
        this.clearAuth();
        this.router.navigate(['/login']);
        return of(null);
      })
    );
  }

  resetToLogin(): void {
    this.authStep.set('login');
    this.availableCompanies.set([]);
  }
}
