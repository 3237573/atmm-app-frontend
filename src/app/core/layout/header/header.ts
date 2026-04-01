import {Component, computed, inject} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { filter, map, startWith } from 'rxjs';
import { AsyncPipe, UpperCasePipe } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, UpperCasePipe, TranslocoModule],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translocoService = inject(TranslocoService);

  readonly currentUserEmail = computed(() => this.authService.currentUser()?.email ?? '');

  readonly isAuthPage$ = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    startWith(null),
    map(() => this.router.url.includes('/login') || this.router.url.includes('/register'))
  );

  get activeLang(): string {
    return this.translocoService.getActiveLang();
  }

  toggleLanguage() {
    const newLang = this.activeLang === 'ru' ? 'en' : 'ru';
    this.translocoService.setActiveLang(newLang);
  }

  onLogout() {
    this.authService.logout().subscribe({
      next: () => {
        localStorage.removeItem('token');
        this.router.navigate(['/login']);
      }
    });
  }
}
