import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MemberService } from '../../core/services/member/member.service';
import { MemberResponse } from '../../core/models/member.model';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-members-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './members-list.html',
  styleUrl: './members-list.scss'
})
export class MembersList implements OnInit {
  private readonly authService = inject(AuthService);

  members = signal<MemberResponse[]>([]);
  loading = signal(true);
  searchQuery = signal('');
  selectedRole = signal('');
  selectedDepartment = signal('');

  currentUser = computed(() => this.authService.currentUser());

  constructor(
    private readonly memberService: MemberService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadMembers();
  }

  loadMembers(): void {
    this.loading.set(true);
    this.memberService.getMembers().subscribe({
      next: (data) => {
        this.members.set(this.sortMembersByRole(data));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки', err);
        this.loading.set(false);
      }
    });
  }

  filteredMembers(): MemberResponse[] {
    return this.members().filter(member => {
      const matchesSearch = !this.searchQuery() ||
        member.displayName?.toLowerCase().includes(this.searchQuery().toLowerCase()) ||
        member.email.toLowerCase().includes(this.searchQuery().toLowerCase());

      const matchesRole = !this.selectedRole() || member.roleName === this.selectedRole();

      return matchesSearch && matchesRole;
    });
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
      if (priorityA !== priorityB) return priorityA - priorityB;

      const nameA = (a.displayName || a.email).toLowerCase();
      const nameB = (b.displayName || b.email).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  // Действия с пользователем
  sendMessage(member: MemberResponse): void {
    // TODO: открыть чат
    console.log('Send message to', member.displayName);
  }

  assignTask(member: MemberResponse): void {
    // Переходим на создание задачи с параметром исполнителя
    void this.router.navigate(['/tasks/create'], {
      queryParams: { assigneeId: member.id, assigneeName: member.displayName }
    });
  }

  viewProfile(member: MemberResponse): void {
    this.router.navigate(['/profile', member.id]);
  }

  getRoleBadgeClass(roleName: string): string {
    switch(roleName) {
      case 'OWNER': return 'owner';
      case 'ADMIN': return 'admin';
      case 'MEMBER': return 'member';
      case 'GUEST': return 'guest';
      default: return 'member';
    }
  }



}
