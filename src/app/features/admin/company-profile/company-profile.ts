import {Component, computed, inject, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ICompany} from '../../../core/models/company.model';
import {CompanyService} from '../../../core/services/company/company.service';
import {finalize, Subject, takeUntil} from 'rxjs';
import {AuthService} from '../../../core/services/auth/auth.service';
import {Clipboard, ClipboardModule} from '@angular/cdk/clipboard';
import {BackOnEscapeDirective} from '../../../core/services/navigation/back-on-escape';

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
  private readonly clipboard = inject(Clipboard);
  copySuccess = false;

  canEdit = computed(() => this.authService.hasPermission('company:update'));

  company: ICompany = {name: '', code: '', owner: {email: '', displayName: ''}, status: 'ACTIVE'};
  loading = true;
  saving = false;
  editing = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit() {
    this.loadCompany();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCompany(): void {
    this.loading = true;
    this.companyService.getCompany()
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading = false))
      .subscribe({
        next: data => {
          this.company = data;
          this.errorMessage = '';
        },
        error: err => {
          console.error('Ошибка загрузки компании', err);
          this.errorMessage = 'Не удалось загрузить данные компании';
        }
      });
  }

  saveChanges(): void {
    if (!this.canEdit()) return;

    const name = this.company.name?.trim();
    const code = this.company.code?.trim();

    if (!name) {
      this.errorMessage = 'Название компании обязательно';
      return;
    }
    if (!code) {
      this.errorMessage = 'Код компании обязателен';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {name, code}; // теперь оба поля точно string

    this.companyService.updateCompany(payload)
      .pipe(takeUntil(this.destroy$), finalize(() => this.saving = false))
      .subscribe({
        next: updated => {
          this.company = {...this.company, ...updated};
          this.successMessage = 'Данные компании успешно обновлены';
          this.editing = false;
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: err => {
          console.error('Ошибка сохранения', err);
          this.errorMessage = err.error?.message || 'Не удалось сохранить изменения';
        }
      });
  }

  cancelEditing(): void {
    this.editing = false;
    this.loadCompany(); // откат к сохранённым данным
    this.errorMessage = '';
    this.successMessage = '';
  }

  copyCode(code: string): void {
    this.clipboard.copy(code);
    this.copySuccess = true;
    setTimeout(() => this.copySuccess = false, 2000);
  }
}
