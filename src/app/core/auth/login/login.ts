import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CompanySelector } from '../company-selector/company-selector';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, CompanySelector],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);

  authStep = this.authService.authStep;
  availableCompanies = this.authService.availableCompanies;

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    // Просто делаем вход - clearAuth уже вызывается в authenticate
    this.authService.login(this.loginForm.value as any).subscribe({
      next: (res) => {
        this.loading.set(false);
        console.log('✅ Login successful, companies:', res.companies.length);
        // authStep автоматически станет 'select-company' в AuthService
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Неверный email или пароль');
      }
    });
  }
}
