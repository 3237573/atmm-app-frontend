import {AdminPage} from './pages/admin-page/admin-page';
import {permissionGuard} from './core/guards/permission.guard';
import {ProjectForm} from './features/project-list/project-form/project-form';
import {ProjectList} from './features/project-list/project-list';
import {Routes} from '@angular/router';
import {Register} from './core/auth/register/register';
import {Login} from './core/auth/login/login';
import {MainLayout} from './core/layout/main-layout/main-layout';
import {authGuard} from './core/guards/auth.guard';
import {Tracker} from './pages/tracker/tracker';
import {TaskList} from './features/task-list/task-list';
import {TaskDetail} from './features/task-list/task-detail/task-detail';
import {TaskCreate} from './features/task-list/task-create/task-create';
import {MembersList} from './features/members-list/members-list';

export const routes: Routes = [
  { path: 'login', component: Login, title: 'Вход' },
  { path: 'register', component: Register, title: 'Регистрация' },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'tracker', component: Tracker, title: 'Трекер' },
      { path: 'members', component: MembersList, title: 'Участники' },
      // PROJECT: Добавляем проверку прав на чтение
      {
        path: 'projects',
        data: { permission: 'project:read' },
        canActivate: [permissionGuard],
        children: [
          { path: '', component: ProjectList, title: 'Проекты' },
          {
            path: 'create',
            component: ProjectForm,
            title: 'Новый проект',
            data: { permission: 'project:create' } // Уточняем право
          },
          {
            path: 'edit/:id',
            component: ProjectForm,
            title: 'Редактирование проекта',
            data: { permission: 'project:update' }
          }
        ]
      },
      {
        path: 'tasks',
        data: { permission: 'task:read' },
        canActivate: [permissionGuard],
        children: [
          { path: '', component: TaskList, title: 'Задачи' },
          {
            path: 'create',
            component: TaskCreate,
            title: 'Новая задача',
            data: { permission: 'task:create' }
          },
          {
            path: 'edit/:id',
            component: TaskDetail,
            title: 'Редактирование pflfxb',
            data: { permission: 'task:update' }
          }
        ]
      },

      // DEPARTMENTS: Оптимизируем через Lazy Loading
      {
        path: 'departments',
        data: { permission: 'department:read' },
        canActivate: [permissionGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/department-list/department-list').then(m => m.DepartmentList),
            title: 'Структура компании'
          },
          {
            path: 'create',
            loadComponent: () => import('./features/department-list/department-create/department-create').then(m => m.DepartmentCreate),
            title: 'Создать отдел',
            data: { permission: 'department:create' }
          },
          {
            path: ':id',
            loadComponent: () => import('./features/department-list/department-detail/department-detail').then(m => m.DepartmentDetail),
            title: 'Детали отдела'
          }
        ]
      },

      // ADMIN: Защищаем целиком
      {
        path: 'admin',
        component: AdminPage,
        canActivate: [permissionGuard],
        data: { permission: 'owner:owner' },
        title: 'Администрирование'
      },

      { path: '', redirectTo: 'tracker', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'tracker' }
];
