import { Component, Input, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MemberService } from '../../../../core/services/member/member.service';
import { TaskService } from '../../../../core/services/task/task.service';
import { IMemberResponse } from '../../../../core/models/member.model';
import { TaskRO } from '../../../../core/models/task/task.model';
import { AuthService } from '../../../../core/services/auth/auth.service';

@Component({
  selector: 'app-assignee-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignee-manager.html',
  styleUrl: './assignee-manager.scss'
})
export class AssigneeManager implements OnInit {
  @Input() task!: TaskRO;
    @Input() visible = false;
  @Output() assigneesUpdated = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  private readonly memberService = inject(MemberService);
  private readonly taskService = inject(TaskService);
  private readonly authService = inject(AuthService);

  members = signal<IMemberResponse[]>([]);
  selectedMembershipIds = signal<string[]>([]);
  loading = signal(true);
  saving = signal(false);
  searchQuery = signal('');

  currentMembershipId = this.authService.currentMembership()?.id;

  ngOnInit(): void {
    this.loadMembers();
  }

  loadMembers(): void {
    this.loading.set(true);
    this.memberService.getMembers().subscribe({
      next: (data) => {
        this.members.set(data);
        // Заполняем текущих исполнителей (нужно будет получить из задачи)
        this.selectedMembershipIds.set(this.task.assigneeMembershipIds || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  filteredMembers(): IMemberResponse[] {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.members();

    return this.members().filter(m =>
      m.displayName.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query)
    );
  }

  isSelected(membershipId: string): boolean {
    return this.selectedMembershipIds().includes(membershipId);
  }

  toggleAssignee(membershipId: string): void {
    const current = this.selectedMembershipIds();
    if (current.includes(membershipId)) {
      this.selectedMembershipIds.set(current.filter(id => id !== membershipId));
    } else {
      this.selectedMembershipIds.set([...current, membershipId]);
    }
  }

  // В методе saveAssignees() измените эмит:
  saveAssignees(): void {
    this.saving.set(true);
    this.taskService.updateTask(this.task.id, {
      assigneeMembershipIds: this.selectedMembershipIds()
    }).subscribe({
      next: () => {
        this.saving.set(false);
        // ✅ Эмитим событие, чтобы родитель перезагрузил задачу
        this.assigneesUpdated.emit();
        // ✅ Закрываем модалку
        this.closeModal();
      },
      error: (err) => {
        console.error('Ошибка сохранения исполнителей', err);
        this.saving.set(false);
        alert('Ошибка сохранения исполнителей');
      }
    });
  }

// Добавьте метод закрытия
  closeModal(): void {
    // Эмитим событие для закрытия
    this.assigneesUpdated.emit();
  }

  getInitials(member: IMemberResponse): string {
    return (member.displayName || member.email).charAt(0).toUpperCase();
  }

  getRoleClass(roleName: string): string {
    switch(roleName) {
      case 'OWNER': return 'owner';
      case 'ADMIN': return 'admin';
      case 'MEMBER': return 'member';
      default: return 'guest';
    }
  }
}
