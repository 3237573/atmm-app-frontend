import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MemberService } from '../../../core/services/member/member.service';
import { MemberResponse } from '../../../core/models/member.model';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Subject, finalize, takeUntil } from 'rxjs';

interface InviteData {
  email: string;
  password: string;
  displayName: string;
  roleName: string;
}

interface StatsData {
  total: number;
  active: number;
  admins: number;
  guests: number;
  pending: number;
  deleted: number;
}

@Component({
  selector: 'app-members-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './members-admin.html',
  styleUrl: './members-admin.scss'
})
export class MembersAdmin implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly destroy$ = new Subject<void>();

  // Reactive state
  members = signal<MemberResponse[]>([]);
  loading = signal(true);
  isSubmitting = signal(false);

  // Edit modal
  editingMember = signal<MemberResponse | null>(null);
  showEditModal = signal(false);

  // Invite form
  showInviteForm = signal(false);
  inviteData: InviteData = {
    email: '',
    password: '',
    displayName: '',
    roleName: 'MEMBER'
  };

  // Filters
  searchQuery = signal('');
  selectedRole = signal('');
  selectedStatus = signal('');

  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(10);

  // Permissions
  canManage = computed(() => this.authService.hasPermission('user:update'));
  canDelete = computed(() => this.authService.hasPermission('user:delete'));
  canCreate = computed(() => this.authService.hasPermission('user:create'));

  // Sort configuration
  sortColumn = signal<string>('roleName');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Toast messages
  toastMessage = signal<string | null>(null);
  toastType = signal<'success' | 'error'>('success');

  constructor(
    private readonly memberService: MemberService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadMembers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========== DATA LOADING ==========

  loadMembers(): void {
    this.loading.set(true);
    this.memberService.getMembers()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (data) => {
          this.members.set(this.sortMembersByRole(data));
          this.resetPagination();
        },
        error: (err) => {
          console.error('Ошибка загрузки сотрудников', err);
          this.showToast('Не удалось загрузить список сотрудников', 'error');
        }
      });
  }

  // ========== FILTERING AND SORTING ==========

  filteredMembers(): MemberResponse[] {
    let filtered = this.members().filter(member => {
      const matchesSearch = !this.searchQuery() ||
        member.displayName?.toLowerCase().includes(this.searchQuery().toLowerCase()) ||
        member.email.toLowerCase().includes(this.searchQuery().toLowerCase());

      const matchesRole = !this.selectedRole() || member.roleName === this.selectedRole();
      const matchesStatus = !this.selectedStatus() || member.status === this.selectedStatus();

      return matchesSearch && matchesRole && matchesStatus;
    });

    // Apply sorting
    filtered = this.sortMembers(filtered);

    return filtered;
  }

  paginatedMembers(): MemberResponse[] {
    const filtered = this.filteredMembers();
    const start = (this.currentPage() - 1) * this.itemsPerPage();
    const end = start + this.itemsPerPage();
    return filtered.slice(start, end);
  }

  sortMembers(members: MemberResponse[]): MemberResponse[] {
    return [...members].sort((a, b) => {
      let aValue: any = a[this.sortColumn() as keyof MemberResponse];
      let bValue: any = b[this.sortColumn() as keyof MemberResponse];

      // Handle displayName sorting
      if (this.sortColumn() === 'displayName') {
        aValue = (a.displayName || a.email).toLowerCase();
        bValue = (b.displayName || b.email).toLowerCase();
      }

      if (aValue < bValue) return this.sortDirection() === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortDirection() === 'asc' ? 1 : -1;
      return 0;
    });
  }

  sortBy(column: string): void {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(column: string): string {
    if (this.sortColumn() !== column) return 'unfold_more';
    return this.sortDirection() === 'asc' ? 'expand_less' : 'expand_more';
  }

  // ========== PAGINATION ==========

  get totalPages(): number {
    return Math.ceil(this.filteredMembers().length / this.itemsPerPage());
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage.set(page);
    }
  }

  resetPagination(): void {
    this.currentPage.set(1);
  }

  // ========== STATISTICS ==========

  getStats(): StatsData {
    const members = this.members();
    const active = members.filter(m => m.status === 'ACTIVE').length;
    const admins = members.filter(m => m.roleName === 'ADMIN' || m.roleName === 'OWNER').length;
    const guests = members.filter(m => m.roleName === 'GUEST').length;
    const pending = members.filter(m => m.status === 'PENDING').length;
    const deleted = members.filter(m => m.status === 'DELETED').length;

    return {
      total: members.length,
      active,
      admins,
      guests,
      pending,
      deleted
    };
  }

  // ========== CRUD OPERATIONS ==========

  onInvite(): void {
    if (!this.isFormValid()) return;

    this.isSubmitting.set(true);

    this.memberService.inviteMember(
      this.inviteData.email,
      this.inviteData.roleName,
      this.inviteData.password,
      this.inviteData.displayName
    ).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isSubmitting.set(false))
    ).subscribe({
      next: () => {
        this.showInviteForm.set(false);
        this.resetInviteForm();
        this.loadMembers();
        this.showToast('Пользователь успешно приглашен', 'success');
      },
      error: (err) => {
        this.showToast(err.error?.error || 'Ошибка при приглашении', 'error');
      }
    });
  }

  editMember(member: MemberResponse): void {
    this.editingMember.set({ ...member });
    this.showEditModal.set(true);
  }

  updateMember(): void {
    const member = this.editingMember();
    if (!member) return;

    this.memberService.updateMember(
      member.id,
      member.roleName,
      member.displayName
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showEditModal.set(false);
          this.loadMembers();
          this.showToast('Данные пользователя обновлены', 'success');
        },
        error: (err) => this.showToast(err.error?.error || 'Ошибка обновления', 'error')
      });
  }

  deleteMember(userId: string, displayName: string): void {
    if (confirm(`Вы уверены, что хотите исключить сотрудника "${displayName}"?`)) {
      this.memberService.removeMember(userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadMembers();
            this.showToast('Сотрудник исключен из компании', 'success');
          },
          error: (err) => this.showToast(err.error?.error || 'Ошибка удаления', 'error')
        });
    }
  }

  resetPassword(userId: string, displayName: string): void {
    const newPassword = prompt(`Введите новый пароль для "${displayName}" (мин. 6 символов)`);
    if (newPassword && newPassword.length >= 6) {
      this.memberService.resetPassword(userId, newPassword)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => this.showToast('Пароль успешно изменен', 'success'),
          error: (err) => this.showToast(err.error?.error || 'Ошибка сброса пароля', 'error')
        });
    } else if (newPassword) {
      this.showToast('Пароль должен содержать минимум 6 символов', 'error');
    }
  }

  restoreMember(userId: string, displayName: string): void {
    if (confirm(`Восстановить сотрудника "${displayName}"?`)) {
      // Implement restore logic - you may need to add this to your service
      this.showToast('Функция восстановления в разработке', 'error');
    }
  }

  // ========== UTILITY METHODS ==========

  toggleInviteForm(): void {
    this.showInviteForm.update(v => !v);
    if (!this.showInviteForm()) {
      this.resetInviteForm();
    }
  }

  isFormValid(): boolean {
    return !!this.inviteData.email &&
      this.isValidEmail(this.inviteData.email) &&
      !!this.inviteData.password &&
      this.inviteData.password.length >= 6 &&
      !!this.inviteData.displayName &&
      this.inviteData.displayName.trim().length > 0;
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private resetInviteForm(): void {
    this.inviteData = {
      email: '',
      password: '',
      displayName: '',
      roleName: 'MEMBER'
    };
  }

  private sortMembersByRole(members: MemberResponse[]): MemberResponse[] {
    const rolePriority: { [key: string]: number } = {
      'OWNER': 1,
      'ADMIN': 2,
      'MEMBER': 3,
      'GUEST': 4
    };

    return [...members].sort((a, b) => {
      const priorityA = rolePriority[a.roleName] ?? 99;
      const priorityB = rolePriority[b.roleName] ?? 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const nameA = (a.displayName || a.email).toLowerCase();
      const nameB = (b.displayName || b.email).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  viewActivity(userId: string): void {
    this.router.navigate(['/tracker'], { queryParams: { userId } });
  }

  exportToCSV(): void {
    const data = this.filteredMembers().map(m => ({
      'Имя': m.displayName,
      'Email': m.email,
      'Роль': m.roleName,
      'Статус': m.status === 'ACTIVE' ? 'Активен' : m.status === 'PENDING' ? 'Ожидает' : 'Удален'
    }));

    if (data.length === 0) {
      this.showToast('Нет данных для экспорта', 'error');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
    ];

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `members_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    this.showToast('Экспорт выполнен успешно', 'success');
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedRole.set('');
    this.selectedStatus.set('');
    this.currentPage.set(1);
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);

    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3000);
  }

  protected readonly Math = Math;
}

