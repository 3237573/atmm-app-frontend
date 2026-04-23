import {Component, inject} from '@angular/core';
import {NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {Sidebar} from '../sidebar/sidebar';
import {Header} from '../header/header';
import {AuthService} from '../../services/auth/auth.service';
import {filter} from 'rxjs';
import {map} from 'rxjs/operators';
import {AsyncPipe} from '@angular/common';

@Component({
  selector: 'app-main-layout',
  imports: [
    Sidebar,
    RouterOutlet,
    Header,
    AsyncPipe
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Проверяем, не на странице ли мы логина/регистрации
  readonly isAuthPage$ = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    map(() => this.router.url.includes('/login') || this.router.url.includes('/register'))
  );

}
