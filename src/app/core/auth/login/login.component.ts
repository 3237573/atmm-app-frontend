import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  onSubmit() {
    if (this.loginForm.valid) {
      // Приводим к типу any или создаем интерфейс LoginRequest
      this.authService.login(this.loginForm.value as any).subscribe({
        next: (res) => {
          console.log('Вход выполнен!', res);
          // После успешного входа обычно сохраняем токен и идем на главную
          this.router.navigate(['/dashboard']); 
        },
        error: (err) => {
          console.error('Ошибка входа:', err);
          alert('Неверный логин или пароль');
        }
      });
    }
  }
}