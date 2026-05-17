import { Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICompany } from '../../../core/models/company.model';
import { CompanyService } from '../../../core/services/company.service';
import { finalize, Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { BackOnEscapeDirective } from '../../../core/directives/back-on-escape.directive';

@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ClipboardModule, BackOnEscapeDirective],
  templateUrl: './company-profile.html',
  styleUrls: ['./company-profile.scss'],
})
export class CompanyProfile implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly companyService = inject(CompanyService);
  private readonly destroy$ = new Subject<void>();

  copySuccess = false;
  canEdit = computed(() => this.authService.hasPermission('company:update'));

  company: ICompany = { name: '', code: '', owner: { email: '', displayName: '' }, status: 'ACTIVE' };
  loading = true;
  saving = false;
  editing = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadCompany();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCopy(): void {
    this.copySuccess = true;
    setTimeout(() => {
      this.copySuccess = false;
    }, 2000);
  }

  loadCompany(): void {
    this.loading = true;
    this.companyService.getCompany()
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading = false))
      .subscribe({
        next: data => this.company = data,
        error: () => this.errorMessage = 'Не удалось загрузить данные компании'
      });
  }

  saveChanges(): void {
    if (!this.canEdit()) return;

    const name = this.company.name?.trim();
    const code = this.company.code?.trim();

    if (!name || !code) {
      this.errorMessage = 'Все поля обязательны для заполнения';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.companyService.updateCompany({ name, code })
      .pipe(takeUntil(this.destroy$), finalize(() => this.saving = false))
      .subscribe({
        next: updated => {
          this.company = { ...this.company, ...updated };
          this.successMessage = 'Данные успешно обновлены';
          this.editing = false;
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: err => this.errorMessage = err.error?.message || 'Ошибка сохранения'
      });
  }

  cancelEditing(): void {
    this.editing = false;
    this.loadCompany();
  }
}
