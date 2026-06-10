import {Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {CommonModule} from '@angular/common';
import {WorkspaceSelector} from '@core/auth/workspace-selector/workspace-selector';
import {AuthService} from '@core/services/auth.service';
import {TranslocoPipe} from '@ngneat/transloco';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TranslocoPipe,WorkspaceSelector],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  loading = signal(false);
  error = signal<string | null>(null);

  authStep = this.authService.authStep;

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    this.authService.login(this.loginForm.value as any).subscribe({
      next: (res) => {
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || err.error?.error || 'error.wrongEmailOrPassword');
      }
    });
  }

}
