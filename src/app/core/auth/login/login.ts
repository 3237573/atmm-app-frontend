import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  onSubmit() {
    if (this.loginForm.valid) {
      // Cast to any or create a LoginRequest interface
      this.authService.login(this.loginForm.value as any).subscribe({
        next: (res) => {
          console.log('Login!', res);
          // After a successful login, we usually save the token and go to the main page
          this.router.navigate(['/members']);
        },
        error: (err) => {
          console.error('Login error:', err);
          alert('Invalid username or password');
        }
      });
    }
  }
}
