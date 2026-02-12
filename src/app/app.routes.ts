import { Routes } from '@angular/router';
import { RegisterComponent } from './core/auth/register/register.component';
import { LoginComponent } from './core/auth/login/login.component';
import { Dashboard } from './pages/dashboard/dashboard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
