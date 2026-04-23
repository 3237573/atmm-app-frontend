import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth/auth.service';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
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
    fullName: ['', Validators.required],           // Глобальное имя (users.full_name)
    displayName: ['', Validators.required],        // Имя в компании (memberships.display_name)
    email: ['', [Validators.required, Validators.email]],
    companyName: ['', Validators.required],
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
      companyName: formValue.companyName,
      password: formValue.password
    }).subscribe({
      next: (res) => {
        console.log('Успех!', res);
        this.router.navigate(['/members']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Ошибка регистрации. Возможно, email уже используется.');
        console.error('Ошибка регистрации:', err);
      }
    });
  }
}
