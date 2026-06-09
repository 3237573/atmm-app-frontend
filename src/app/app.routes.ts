import { Routes } from '@angular/router';
import { Login } from '@core/auth/login/login';
import { Register } from '@core/auth/register/register';
import { MainLayout } from '@core/layout/main-layout/main-layout';
import { authGuard } from '@core/guards/auth.guard';
import { Tracker } from './pages/tracker/tracker';
import { MembersList } from '@features/member/members-list/members-list';
import { ChatLayout } from '@features/chat/chat-layout';
import { ChatWindow } from '@features/chat/chat-window/chat-window';
import { permissionGuard } from '@core/guards/permission.guard';
import { ProjectList } from '@features/project/project-list/project-list';
import { ProjectForm } from '@features/project/project-form/project-form';
import { TaskList } from '@features/task/task-list/task-list';
import { TaskCreate } from '@features/task/task-create/task-create';
import { TaskDetail } from '@features/task/task-detail/task-detail';
import { AdminPage } from './pages/admin-page/admin-page';

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
      {
        path: 'chat',
        component: ChatLayout,
        children: [
          {
            path: ':roomId',
            component: ChatWindow
          }
        ]
      },

      // PROJECT: Защита дочерних роутов через canActivateChild
      {
        path: 'projects',
        data: { permission: 'project:read' },
        canActivateChild: [permissionGuard], // <--- ИСПРАВЛЕНО
        children: [
          { path: '', component: ProjectList, title: 'Проекты' },
          {
            path: 'create',
            component: ProjectForm,
            title: 'Новый проект',
            data: { permission: 'project:create' }
          },
          {
            path: 'edit/:id',
            component: ProjectForm,
            title: 'Редактирование проекта',
            data: { permission: 'project:update' }
          }
        ]
      },

      // TASKS: Защита дочерних роутов через canActivateChild
      {
        path: 'tasks',
        data: { permission: 'task:read' },
        canActivateChild: [permissionGuard], // <--- ИСПРАВЛЕНО
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
            title: 'Редактирование задачи', // <--- ИСПРАВЛЕНО (тайпо)
            data: { permission: 'task:update' }
          }
        ]
      },

      // DEPARTMENTS: Lazy Loading + canActivateChild
      {
        path: 'departments',
        data: { permission: 'department:read' },
        canActivateChild: [permissionGuard], // <--- ИСПРАВЛЕНО
        children: [
          {
            path: '',
            loadComponent: () => import('@features/department/department-list/department-list').then(m => m.DepartmentList),
            title: 'Структура пространства'
          },
          {
            path: 'create',
            loadComponent: () => import('@features/department/department-create/department-create').then(m => m.DepartmentCreate),
            title: 'Создать отдел',
            data: { permission: 'department:create' }
          },
          {
            path: ':id',
            loadComponent: () => import('@features/department/department-detail/department-detail').then(m => m.DepartmentDetail),
            title: 'Детали отдела'
          }
        ]
      },

      // ADMIN: Здесь детей нет, оставляем обычный canActivate
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
