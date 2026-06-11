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
  { path: 'login', component: Login, title: 'routes.login' }, // 👈 Используем ключ
  { path: 'register', component: Register, title: 'routes.register' },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'tracker', component: Tracker, title: 'routes.tracker' },
      { path: 'members', component: MembersList, title: 'routes.members' },
      {
        path: 'chat',
        component: ChatLayout,
        title: 'routes.chat',
        children: [{ path: ':roomId', component: ChatWindow }]
      },
      {
        path: 'projects',
        data: { permission: 'project:read' },
        canActivateChild: [permissionGuard],
        children: [
          { path: '', component: ProjectList, title: 'routes.projects' },
          { path: 'create', component: ProjectForm, title: 'routes.projectCreate', data: { permission: 'project:create' } },
          { path: 'edit/:id', component: ProjectForm, title: 'routes.projectEdit', data: { permission: 'project:update' } }
        ]
      },
      {
        path: 'tasks',
        data: { permission: 'task:read' },
        canActivateChild: [permissionGuard],
        children: [
          { path: '', component: TaskList, title: 'routes.tasks' },
          { path: 'create', component: TaskCreate, title: 'routes.taskCreate', data: { permission: 'task:create' } },
          { path: 'edit/:id', component: TaskDetail, title: 'routes.taskEdit', data: { permission: 'task:update' } }
        ]
      },
      {
        path: 'departments',
        data: { permission: 'department:read' },
        canActivateChild: [permissionGuard],
        children: [
          { path: '', loadComponent: () => import('@features/department/department-list/department-list').then(m => m.DepartmentList), title: 'routes.departments' },
          { path: 'create', loadComponent: () => import('@features/department/department-create/department-create').then(m => m.DepartmentCreate), title: 'routes.departmentCreate', data: { permission: 'department:create' } },
          { path: ':id', loadComponent: () => import('@features/department/department-detail/department-detail').then(m => m.DepartmentDetail), title: 'routes.departmentDetail' }
        ]
      },
      {
        path: 'admin',
        component: AdminPage,
        canActivate: [permissionGuard],
        data: { permission: 'owner:owner' },
        title: 'routes.admin'
      },
      { path: '', redirectTo: 'tracker', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'tracker' }
];
