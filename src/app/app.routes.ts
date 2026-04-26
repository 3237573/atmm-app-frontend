import {Routes} from '@angular/router';
import {authGuard} from './core/guards/auth.guard';

// Компоненты
import {Login} from './core/auth/login/login';
import {Register} from './core/auth/register/register';
import {Tracker} from './pages/tracker/tracker';
import {MainLayout} from './core/layout/main-layout/main-layout';
import {AdminPage} from './pages/admin-page/admin-page';
import {MembersList} from './features/members-list/members-list';
import {TaskList} from './features/task-list/task-list';
import {TaskCreate} from './features/task-list/task-create/task-create';
import {TaskDetail} from './features/task-list/task-detail/task-detail';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'tracker', component: Tracker },
      { path: 'members', component: MembersList },
      {
        path: 'tasks',
        children: [
          { path: '', component: TaskList, title: 'Задачи' },
          { path: 'create', component: TaskCreate, title: 'Создать задачу' },
          { path: ':id', component: TaskDetail, title: 'Детали задачи' }
        ]
      },
      {
        path: 'admin',
        component: AdminPage,
      },
      { path: '', redirectTo: 'tracker', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '/login' }
];
