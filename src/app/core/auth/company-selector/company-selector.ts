import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-company-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './company-selector.html',
  styleUrls: ['./company-selector.scss']
})
export class CompanySelector {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  loading = signal(false);
  companies = this.authService.availableCompanies;
  email = this.authService.currentUser()?.email || '';

  // Маппинг ролей для красивого отображения
  private readonly roleLabels: Record<string, string> = {
    'OWNER': 'Владелец',
    'ADMIN': 'Администратор',
    'MEMBER': 'Участник',
    'GUEST': 'Гость'
  };

  getRoleLabel(role: string): string {
    return this.roleLabels[role] || role;
  }

  async selectCompany(companyId: string) {
    this.loading.set(true);
    this.authService.selectCompany(companyId).subscribe({
      next: () => {
        this.router.navigate(['/members']);
      },
      error: (err) => {
        console.error('Ошибка выбора компании', err);
        this.loading.set(false);
      }
    });
  }

  backToLogin() {
    this.authService.resetToLogin();
  }
}
