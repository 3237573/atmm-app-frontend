import { computed, inject, Injectable, Injector, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {AuthMeResponse, AuthRequestRO, IMember, SelectWorkspaceRO, UserWorkspacesResponse} from '../models/auth.model';
import { NavigationService } from './navigation.service';
import { ChatService } from './chat/chat.service';
import { EncryptionService } from '@core/services/chat/encryption.service';
import { WorkspaceInfoRO } from '@core/models/workspace.model';

const SESSION_WORKSPACES_KEY = 'session_available_workspaces';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly encryptionService = inject(EncryptionService);
  private readonly navigationService = inject(NavigationService);
  private readonly injector = inject(Injector);

  // Состояние (Signals)
  readonly availableWorkspaces = signal<WorkspaceInfoRO[]>([]);
  readonly currentMember = signal<IMember | null>(null);
  readonly currentWorkspace = signal<WorkspaceInfoRO | null>(null);
  readonly currentUser = computed(() => this.currentMember());
  readonly permissions = signal<string[]>([]);
  readonly isAuthenticated = signal<boolean>(false);
  readonly authStep = signal<'login' | 'select-workspace'>('login');

  readonly displayName = computed(() => {
    const workspace = this.currentWorkspace();
    const member = this.currentMember();
    return workspace?.displayName || member?.displayName || member?.fullName || member?.email?.split('@')[0] || 'User';
  });

  constructor() {
    // Восстанавливаем сохраненные воркспейсы текущей вкладки при старте сервиса
    this.loadWorkspacesFromStorage();
  }

  hasPermission(permission: string): boolean {
    return this.permissions()?.includes(permission) ?? false;
  }

  private handleAuthResponse(res: AuthMeResponse | null): void {
    if (res) {
      this.currentMember.set(res.member);
      this.currentWorkspace.set(res.workspace);
      this.permissions.set(res.permissions);
      this.isAuthenticated.set(true);
      this.authStep.set('login');

      if (res.member?.id) {
        this.encryptionService.initDevice()
          .then((deviceId) => {
            console.log(`[Olm E2EE] Устройство ${deviceId} полностью готово к защищенному обмену.`);
          })
          .catch(err => console.error('❌ Ошибка инициализации Olm E2EE:', err));
      }
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

    // Очищаем временное хранилище вкладки
    this.clearWorkspacesStorage();

    try {
      const chatService = this.injector.get(ChatService);
      chatService.disconnect();
    } catch (e) {
      console.warn('[AuthService] Не удалось отключить ChatService, возможно он еще не создан.', e);
    }
  }

  checkAuth(): Observable<AuthMeResponse | null> {
    return this.http.get<AuthMeResponse>('/auth/me', { withCredentials: true }).pipe(
      tap((res) => {
        this.handleAuthResponse(res);
        // Если пользователь уже авторизован, проверяем наличие доступных воркспейсов в памяти вкладки
        this.loadWorkspacesFromStorage();
      }),
      catchError(() => {
        this.clearAuth();
        return of(null);
      })
    );
  }

  /** Шаг 1: Проверка пароля и получение списка подходящих пространств */
  authenticate(credentials: AuthRequestRO): Observable<UserWorkspacesResponse> {
    this.clearAuth();

    return this.http.post<UserWorkspacesResponse>('/auth/authenticate', credentials).pipe(
      tap((res) => {
        this.availableWorkspaces.set(res.workspaces);
        this.saveWorkspacesToStorage(res.workspaces);
        this.authStep.set('select-workspace');
      })
    );
  }

  /** Алиас для входа */
  login(credentials: AuthRequestRO): Observable<UserWorkspacesResponse> {
    return this.authenticate(credentials);
  }

  /** Шаг 2: Выбор пространства и установка JWT куки */
  selectWorkspace(request: SelectWorkspaceRO): Observable<AuthMeResponse> {
    return this.http.post<AuthMeResponse>('/auth/select-workspace', request, { withCredentials: true }).pipe(
      tap((res) => {
        this.handleAuthResponse(res);
        const lastRoute = this.navigationService.getLastRoute();
        void this.router.navigate([lastRoute || '/tasks']);
      })
    );
  }

  register(data: any): Observable<AuthMeResponse> {
    return this.http.post<AuthMeResponse>('/auth/register', data, { withCredentials: true })
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  logout(): Observable<any> {
    return this.http.post('/auth/logout', {}, { withCredentials: true }).pipe(
      tap(() => {
        this.clearAuth();
        void this.router.navigate(['/login']);
      }),
      catchError(() => {
        this.clearAuth();
        void this.router.navigate(['/login']);
        return of(null);
      })
    );
  }

  resetToLogin(): void {
    this.clearAuth();
  }

  // --- Безопасная работа с sessionStorage (Изоляция вкладки) ---

  private saveWorkspacesToStorage(workspaces: WorkspaceInfoRO[]): void {
    try {
      sessionStorage.setItem(SESSION_WORKSPACES_KEY, JSON.stringify(workspaces));
    } catch (e) {
      console.error('[AuthService] Ошибка записи воркспейсов в sessionStorage:', e);
    }
  }

  private loadWorkspacesFromStorage(): void {
    try {
      const stored = sessionStorage.getItem(SESSION_WORKSPACES_KEY);
      if (stored) {
        this.availableWorkspaces.set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('[AuthService] Ошибка чтения воркспейсов из sessionStorage:', e);
    }
  }

  private clearWorkspacesStorage(): void {
    try {
      sessionStorage.removeItem(SESSION_WORKSPACES_KEY);
    } catch (e) {
      console.error('[AuthService] Ошибка очистки sessionStorage:', e);
    }
  }
}
