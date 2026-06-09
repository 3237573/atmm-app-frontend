import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthMeResponse, WorkspaceInfo, IMember, UserWorkspacesResponse } from '../models/auth.model';
import { NavigationService } from './navigation.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly navigationService = inject(NavigationService);

  // Состояние
  readonly currentMember = signal<IMember | null>(null);
  readonly currentWorkspace = signal<WorkspaceInfo | null>(null);
  readonly currentUser = computed(() => this.currentMember());
  readonly permissions = signal<string[]>([]);
  readonly isAuthenticated = signal<boolean>(false);
  readonly availableWorkspaces = signal<WorkspaceInfo[]>([]);
  readonly authStep = signal<'login' | 'select-workspace'>('login');

  readonly hasMultipleWorkspaces = computed(() => this.availableWorkspaces().length > 1);
  readonly displayName = computed(() => {
    const workspace = this.currentWorkspace();
    const member = this.currentMember();
    return workspace?.displayName || member?.displayName || member?.fullName || member?.email?.split('@')[0] || 'User';
  });

  hasPermission(permission: string): boolean {
    return this.permissions()?.includes(permission) ?? false;
  }

  hasPermission$(permission: string) {
    return computed(() => this.permissions().includes(permission));
  }

  private handleAuthResponse(res: AuthMeResponse | null): void {
    if (res) {
      this.currentMember.set(res.member);
      this.currentWorkspace.set(res.workspace);
      this.permissions.set(res.permissions);
      this.isAuthenticated.set(true);
      this.authStep.set('login');
    } else {
      this.clearAuth();
    }
  }

  clearAuth(): void {
    this.currentMember.set(null);
    this.currentWorkspace.set(null);
    this.permissions.set([]);
    this.isAuthenticated.set(false);
    this.availableWorkspaces.set([]);
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

  /** Шаг 1: Проверка пароля и получение списка пространств */
  authenticate(credentials: { email: string; password: string }): Observable<UserWorkspacesResponse> {
    this.clearAuth();

    return this.http.post<UserWorkspacesResponse>('/auth/authenticate', credentials).pipe(
      tap((res) => {
        // Сохраняем email для отображения (но не userId)
        this.availableWorkspaces.set(res.workspaces);
        this.authStep.set('select-workspace');
      })
    );
  }

  /** Шаг 2: Выбор пространства и получение токена */
  selectWorkspace(workspaceId: string, memberId: string): Observable<AuthMeResponse> {
    return this.http.post<AuthMeResponse>('/auth/select-workspace', {
      workspaceId: workspaceId,
      memberId: memberId
    }, { withCredentials: true }).pipe(
      tap((res) => {
        this.handleAuthResponse(res);
        const lastRoute = this.navigationService.getLastRoute();
        void this.router.navigate([lastRoute || '/tasks']);
      })
    );
  }

  login(credentials: { email: string; password: string }): Observable<UserWorkspacesResponse> {
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
    this.availableWorkspaces.set([]);
  }
}
