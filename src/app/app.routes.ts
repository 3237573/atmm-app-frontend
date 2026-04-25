import {Routes} from '@angular/router';
import {authGuard} from './core/guards/auth.guard';

// Компоненты
import {Login} from './core/auth/login/login';
import {Register} from './core/auth/register/register';
import {Tracker} from './pages/tracker/tracker';
import {Members} from './pages/members/members';
import {MainLayout} from './core/layout/main-layout/main-layout';
import {AdminPage} from './pages/admin/admin';

export const routes: Routes = [
  // 1. Публичные маршруты
  { path: 'login', component: Login },
  { path: 'register', component: Register },

  // 2. Приватные маршруты
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'tracker', component: Tracker },
      { path: 'members', component: Members },

      // Администрирование (единая точка входа)
      {
        path: 'admin',
        component: AdminPage,  // 👈 Внутри будут вкладки: profile, members, roles, permissions, tracker
        children: []  // Не нужны дочерние маршруты, так как AdminPage сам управляет вкладками
      },

      { path: '', redirectTo: 'tracker', pathMatch: 'full' }
    ]
  },

  // 3. Fallback
  { path: '**', redirectTo: '/login' }
];
