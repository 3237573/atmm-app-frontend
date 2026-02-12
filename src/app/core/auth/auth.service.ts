// auth.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuthResponse, RegisterRequest } from '../models/auth.model';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly API_URL = '/api/auth';

  // Authorization state
  currentUser = signal<AuthResponse | null>(null);
  isAuthenticated = signal<boolean>(false);

  checkAuth() {
    return this.http.get<any>(`${this.API_URL}/me`, { withCredentials: true }).pipe(
      tap((res) => {
        this.currentUser.set(res.user);
        this.isAuthenticated.set(true);
      }),
      catchError(() => {
        this.isAuthenticated.set(false);
        this.currentUser.set(null);
        return of(null); // Возвращаем пустой поток, чтобы приложение загрузилось дальше
      }),
    );
  }

  login(credentials: any) {
    return this.http
      .post<any>(`${this.API_URL}/login`, credentials, {
        withCredentials: true, // Allows the browser to save a cookie from the response.
      })
      .pipe(
        tap((res) => {
          this.currentUser.set(res.user);
          this.isAuthenticated.set(true);
        }),
      );
  }

  register(data: any) {
    return this.http
      .post<any>(`${this.API_URL}/register`, data, {
        withCredentials: true,
      })
      .pipe(
        tap((res) => {
          this.currentUser.set(res.user);
          this.isAuthenticated.set(true);
        }),
      );
  }

  // auth.service.ts
  logout() {
    return this.http.post(`${this.API_URL}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        // Сначала очищаем состояние
        this.currentUser.set(null);
        this.isAuthenticated.set(false);

        // Затем переходим на логин
        this.router.navigate(['/login']).then(() => {
          console.log('Навигация завершена');
        });
      }),
      catchError((err) => {
        // Даже если сервер упал, мы должны "выбросить" пользователя из приложения
        this.currentUser.set(null);
        this.isAuthenticated.set(false);
        this.router.navigate(['/login']);
        return of(null);
      }),
    );
  }
}
