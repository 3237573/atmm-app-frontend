import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import {Router, RouterLink} from '@angular/router';

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

  regForm = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    companyName: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit() {
    if (this.regForm.valid) {
      this.authService.register(this.regForm.value as any).subscribe({
        next: (res) => {
          console.log('Успех!', res);
          // 3. Перенаправление на /tracker
          this.router.navigate(['/members']);
        },
        error: (err) => {
          console.error('Ошибка регистрации:', err);
          // Тут можно добавить алерт для пользователя, если e-mail уже занят
        },
      });
    }
  }
}
