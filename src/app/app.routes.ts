import {Routes} from '@angular/router';
import {authGuard} from './core/guards/auth.guard';
import {Login} from './core/auth/login/login';
import {Register} from './core/auth/register/register';
import {Tracker} from './pages/tracker/tracker';
import {MainLayout} from './core/layout/main-layout/main-layout';
import {AdminPage} from './pages/admin-page/admin-page';
import {MembersList} from './features/members-list/members-list';
import {TaskList} from './features/task-list/task-list';
import {TaskCreate} from './features/task-list/task-create/task-create';
import {TaskDetail} from './features/task-list/task-detail/task-detail';
import {UnsavedChangesGuard} from './core/interceptors/unsaved-changes.guard';

export const routes: Routes = [
  {path: 'login', component: Login, title: 'Вход'},
  {path: 'register', component: Register, title: 'Регистрация'},
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      {path: 'tracker', component: Tracker, title: 'Трекер'},
      {path: 'members', component: MembersList, title: 'Участники'},
      {
        path: 'tasks',
        children: [
          {path: '', component: TaskList, title: 'Задачи'},
          {path: 'create', component: TaskCreate, title: 'Создать задачу', canDeactivate: [UnsavedChangesGuard]},
          {path: ':id', component: TaskDetail, title: 'Детали задачи', canDeactivate: [UnsavedChangesGuard]}
        ]
      },
      {
        path: 'admin',
        component: AdminPage,
        title: 'Администрирование',
        canActivate: [authGuard]  // можно заменить на adminGuard при необходимости
      },
      {path: '', redirectTo: 'tracker', pathMatch: 'full'}
    ]
  },
  {path: '**', redirectTo: '/login'}
];
