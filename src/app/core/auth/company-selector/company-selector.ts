import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import {CompanyInfo} from '../../models/auth.model';
import {NavigationService} from '../../services/navigation/navigation.service';

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
  private readonly navigationService = inject(NavigationService);

  loading = signal(false);
  companies = this.authService.availableCompanies;
  email = this.authService.currentUser()?.email || '';

  getRoleLabel(role: string): string {
    switch (role) {
      case 'OWNER': return 'Owner';
      case 'ADMIN': return 'Admin';
      case 'MEMBER': return 'Member';
      case 'GUEST': return 'Guest';
      default: return role;
    }
  }

  // При выборе компании нужно передать companyId и membershipId
  selectCompany(company: CompanyInfo): void {
    if (!company.membershipId) {
      console.error('No membershipId for company', company);
      return;
    }

    this.loading.set(true);
    this.authService.selectCompany(company.companyId, company.membershipId).subscribe({
      next: () => {
        this.loading.set(false);
        // Восстанавливаем последний маршрут или идём на tracker
        const lastRoute = this.navigationService.getLastRoute();
        void this.router.navigate([lastRoute || '/tracker']);
      },
      error: (err) => {
        console.error('Error selecting company', err);
        this.loading.set(false);
      }
    });
  }

  backToLogin() {
    this.authService.resetToLogin();
  }
}
