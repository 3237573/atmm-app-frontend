import {Component, computed, inject, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { CompanyInfo } from '../../models/auth.model';
import {email} from '@angular/forms/signals';

@Component({
  selector: 'app-company-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './company-selector.html',
  styleUrls: ['./company-selector.scss']
})
export class CompanySelector {
  private readonly authService = inject(AuthService);

  loading = signal(false);
  companies = this.authService.availableCompanies;

  getRoleLabel(role: string): string {
    switch (role) {
      case 'OWNER': return 'Owner';
      case 'ADMIN': return 'Admin';
      case 'MEMBER': return 'Member';
      case 'GUEST': return 'Guest';
      default: return role;
    }
  }

  selectCompany(company: CompanyInfo): void {
    if (!company.membershipId) {
      console.error('No membershipId for company', company);
      return;
    }

    this.loading.set(true);
    this.authService.selectCompany(company.companyId, company.membershipId).subscribe({
      error: (err) => {
        console.error('Error selecting company', err);
        this.loading.set(false);
      },
      complete: () => {
        this.loading.set(false);
      }
    });
  }

  backToLogin() {
    this.authService.resetToLogin();
  }

  protected readonly email = computed(() => this.authService.currentUser()?.email || '');
}
