import {computed, inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {Observable, of} from 'rxjs';
import {catchError, tap} from 'rxjs/operators';
import {AuthMeResponse, CompanyInfo, IUser, UserCompaniesResponse} from '../../models/auth.model';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // Состояние
  readonly currentUser = signal<IUser | null>(null);
  readonly currentCompany = signal<CompanyInfo | null>(null);
  readonly permissions = signal<string[]>([]);
  readonly isAuthenticated = signal<boolean>(false);
  readonly availableCompanies = signal<CompanyInfo[]>([]);
  readonly authStep = signal<'login' | 'select-company'>('login');

  // Computed
  readonly hasMultipleCompanies = computed(() => this.availableCompanies().length > 1);
  readonly displayName = computed(() => {
    const company = this.currentCompany();
    const user = this.currentUser();
    return company?.displayName || user?.fullName || user?.email?.split('@')[0] || 'User';
  });

  hasPermission(permission: string): boolean {
    return this.permissions()?.includes(permission) ?? false;
  }

  hasPermission$(permission: string) {
    return computed(() => this.permissions().includes(permission));
  }

  private handleAuthResponse(res: AuthMeResponse | null): void {
    if (res) {
      this.currentUser.set(res.user);
      this.currentCompany.set(res.company);
      this.permissions.set(res.permissions);
      this.isAuthenticated.set(true);
      this.authStep.set('login');
    } else {
      this.clearAuth();
    }
  }

  private clearAuth(): void {
    this.currentUser.set(null);
    this.currentCompany.set(null);
    this.permissions.set([]);
    this.isAuthenticated.set(false);
    this.availableCompanies.set([]);
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
    return this.http.post<UserCompaniesResponse>('/auth/authenticate', credentials).pipe(
      tap((res) => {
        this.currentUser.set({ id: res.userId, email: res.email, fullName: res.fullName });
        this.availableCompanies.set(res.companies);
        this.authStep.set('select-company');
      })
    );
  }

  /** Шаг 2: Выбор компании и получение токена */
  selectCompany(companyId: string): Observable<AuthMeResponse> {
    return this.http.post<AuthMeResponse>('/auth/select-company', {
      userId: this.currentUser()?.id,
      companyId
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
        this.authStep.set('login');
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
