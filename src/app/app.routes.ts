import {Routes} from '@angular/router';
import {authGuard} from './core/guards/auth.guard';

// Компоненты
import {Login} from './core/auth/login/login';
import {Register} from './core/auth/register/register';
import {Tracker} from './pages/tracker/tracker';
import {Members} from './pages/members/members';
import {MainLayout} from './core/layout/main-layout/main-layout';
import {TrackerAdmin} from './features/tracker-admin-component/tracker-admin';
import {AdminPage} from './pages/admin/admin';

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
      // { path: 'dashboard', component: Dashboard },
      // { path: 'dex', component: DexDashboard },
      { path: 'tracker', component: Tracker },
      // { path: 'admin/tracker', component: TrackerAdmin },
      { path: 'members', component: Members },
      // --- СЕКЦИЯ АДМИНИСТРИРОВАНИЯ ---
      {
        path: 'admin',
        children: [
          // Основная панель (Permissions Manager, который мы создали)
          { path: 'panel', component: AdminPage },
          // Управление трекером (перенесли сюда для порядка)
          { path: 'tracker', component: TrackerAdmin },
        ]
      },
      { path: '', redirectTo: 'tracker', pathMatch: 'full' }
    ]
  },

  // 3. Обработка несуществующих страниц
  { path: '**', redirectTo: '/login' }
];
