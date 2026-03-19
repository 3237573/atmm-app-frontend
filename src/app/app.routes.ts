import {Routes} from '@angular/router';
import {RegisterComponent} from './core/auth/register/register.component';
import {LoginComponent} from './core/auth/login/login.component';
import {Dashboard} from './pages/dashboard/dashboard';
import {authGuard} from './core/guards/auth.guard';
import {DexDashboard} from './pages/dex-dashboard/dex-dashboard';
import {Tracker} from './pages/tracker/tracker';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'dex', component: DexDashboard, canActivate: [authGuard] },
  { path: 'tracker', component: Tracker, canActivate: [authGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
