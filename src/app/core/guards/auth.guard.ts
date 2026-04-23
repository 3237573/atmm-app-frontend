import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check the isAuthenticated signal that we filled in checkAuth
  if (authService.isAuthenticated()) {
    return true; // Access allowed
  }

  // If it is not authorized, we send it to the login
  return router.parseUrl('/login');
};
