// auth.service.ts
import {inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {of} from 'rxjs';
import {catchError, tap} from 'rxjs/operators';
import {AuthResponse} from '../models/auth.model';
import {Router} from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // Authorization state
  currentUser = signal<AuthResponse | null>(null);
  isAuthenticated = signal<boolean>(false);

  checkAuth() {
    return this.http.get<any>('/auth/me', { withCredentials: true }).pipe(
      tap((res) => {
        this.currentUser.set(res.user);
        this.isAuthenticated.set(true);
      }),
      catchError(() => {
        this.isAuthenticated.set(false);
        this.currentUser.set(null);
        return of(null); // Return an empty thread so that the app loads further
      }),
    );
  }

  login(credentials: any) {
    return this.http
      .post<any>('auth/login', credentials, {
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
      .post<any>('auth/register', data, {
        withCredentials: true,
      })
      .pipe(
        tap((res) => {
          this.currentUser.set(res.user);
          this.isAuthenticated.set(true);
        }),
      );
  }

  logout() {
    return this.http.post('auth/logout', {}, { withCredentials: true }).pipe(
      tap(() => {
        // First, clear the state
        this.currentUser.set(null);
        this.isAuthenticated.set(false);

        // Then go to the login
        this.router.navigate(['/login']).then(() => {
          console.log('Навигация завершена');
        });
      }),
      catchError((err) => {
        // Even if the server crashes, we have to "kick" the user out of the application
        this.currentUser.set(null);
        this.isAuthenticated.set(false);
        this.router.navigate(['/login']);
        return of(null);
      }),
    );
  }
}
