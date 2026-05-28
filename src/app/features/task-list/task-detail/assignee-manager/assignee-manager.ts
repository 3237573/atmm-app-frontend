import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MemberService } from '../../../../core/services/member.service';
import { TaskService } from '../../../../core/services/task.service';
import { MemberRO } from '../../../../core/models/member.model';
import { TaskRO } from '../../../../core/models/task/task.model';
import { AuthService } from '../../../../core/services/auth.service';
import { DepartmentService } from '../../../../core/services/departament.service';

@Component({
  selector: 'app-task-assignee-manager',
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

  private readonly authService = inject(AuthService);
  private readonly departmentService = inject(DepartmentService);
  private readonly memberService = inject(MemberService);
  private readonly taskService = inject(TaskService);

  departmentMembers = signal<MemberRO[]>([]);
  selectedMemberIds = signal<string[]>([]);
  loading = signal(true); // Используем ОДИН этот сигнал для контроля UI
  saving = signal(false);
  searchQuery = signal('');

  currentMemberId = this.authService.currentMember()?.id;

  ngOnInit(): void {
    this.loadDepartmentMembers(this.task.departmentId);
  }

  loadDepartmentMembers(departmentId: string): void {
    this.loading.set(true); // Включаем лоадер
    this.departmentService.getDepartmentEmployees(departmentId).subscribe({
      next: (members) => {
        this.departmentMembers.set(members);
        this.task.assigneeIds = (this.task.assigneeIds || []).filter(id =>
          members.some(m => m.id === id)
        );
        this.selectedMemberIds.set(this.task.assigneeIds || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки сотрудников отдела', err);
        this.departmentMembers.set([]);
        this.loading.set(false);
      }
    });
  }

  filteredMembers(): MemberRO[] {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.departmentMembers();

    return this.departmentMembers().filter(m =>
      (m.displayName || '').toLowerCase().includes(query) ||
      (m.email || '').toLowerCase().includes(query)
    );
  }

  isSelected(memberId: string): boolean {
    return this.selectedMemberIds().includes(memberId);
  }

  toggleAssignee(memberId: string): void {
    const current = this.selectedMemberIds();
    if (current.includes(memberId)) {
      this.selectedMemberIds.set(current.filter(id => id !== memberId));
    } else {
      this.selectedMemberIds.set([...current, memberId]);
    }
  }

  saveAssignees(): void {
    this.saving.set(true);
    this.taskService.updateTask(this.task.id, {
      assigneeMemberIds: this.selectedMemberIds()
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.assigneesUpdated.emit();
        this.closeModal();
      },
      error: (err) => {
        console.error('Ошибка сохранения исполнителей', err);
        this.saving.set(false);
        alert('Ошибка сохранения исполнителей');
      }
    });
  }

  closeModal(): void {
    this.assigneesUpdated.emit();
  }

  getInitials(member: MemberRO): string {
    return (member.displayName || member.email || '?').charAt(0).toUpperCase();
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
