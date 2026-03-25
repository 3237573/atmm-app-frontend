import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

// Компоненты
import { Login } from './core/auth/login/login';
import { Register } from './core/auth/register/register';
import { Dashboard } from './pages/dashboard/dashboard';
import { DexDashboard } from './pages/dex-dashboard/dex-dashboard';
import { Tracker } from './pages/tracker/tracker';
import {Members} from './pages/members/members';
import {MainLayout} from './core/layout/main-layout/main-layout';

export const routes: Routes = [
  // 1. Публичные маршруты (без сайдбара)
  { path: 'login', component: Login },
  { path: 'register', component: Register },

  // 2. Приватные маршруты внутри общего Layout
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'dex', component: DexDashboard },
      { path: 'tracker', component: Tracker },
      { path: 'members', component: Members },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // 3. Обработка несуществующих страниц
  { path: '**', redirectTo: '/login' }
];
