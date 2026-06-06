import {Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../../services/auth.service';
import {CommonModule} from '@angular/common';
import {Router, RouterLink} from '@angular/router';
import {TranslocoPipe} from '@ngneat/transloco';
import {BackOnEscapeDirective} from '@core/directives/back-on-escape.directive';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslocoPipe, BackOnEscapeDirective],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);

  regForm = this.fb.group({
    fullName: ['', Validators.required],
    displayName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    workspaceName: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit() {
    if (this.regForm.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    const formValue = this.regForm.value;

    this.authService.register({
      fullName: formValue.fullName,
      displayName: formValue.displayName,
      email: formValue.email,
      workspaceName: formValue.workspaceName,
      password: formValue.password
    }).subscribe({
      next: (res) => {
        this.authService.login(this.regForm.value as any).subscribe({
          next: (res) => {
            this.loading.set(false);
          },
          error: (err) => {
            this.loading.set(false);
            this.error.set(err.error?.message || err.error?.error || 'Неверный email или пароль');
          }
        });
        void this.router.navigate(['/tasks']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Ошибка регистрации. Возможно, email уже используется.');
        console.error('Ошибка регистрации:', err);
      }
    });
  }
}
