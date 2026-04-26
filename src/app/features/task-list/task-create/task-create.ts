import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { TaskService } from '../../../core/services/task/task.service';
import { MemberService } from '../../../core/services/member/member.service';
import { IMemberResponse } from '../../../core/models/member.model';
import { ITaskCreateRO, TaskPriority } from '../../../core/models/task.model';

@Component({
  selector: 'app-task-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './task-create.html',
  styleUrl: './task-create.scss'
})
export class TaskCreate implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly memberService = inject(MemberService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  members = signal<IMemberResponse[]>([]);
  loading = signal(false);
  submitting = signal(false);

  // Минимальная дата для выбора (сегодня)
  minDate: string = new Date().toISOString().split('T')[0];

  taskData = {
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    departmentId: '',
    assigneeMembershipIds: [] as string[],
    dueDate: ''
  };

  ngOnInit(): void {
    this.loadMembers();

    this.route.queryParams.subscribe(params => {
      if (params['assigneeId']) {
        // Это теперь membershipId
        this.taskData.assigneeMembershipIds = [params['assigneeId']];
        console.log('Preselected membershipId:', params['assigneeId']);
      }
      if (params['title']) {
        this.taskData.title = params['title'];
      }
    });
  }

  loadMembers(): void {
    this.loading.set(true);
    this.memberService.getMembers().subscribe({
      next: (data) => {
        this.members.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSubmit(): void {
    if (!this.taskData.title.trim()) return;

    // Убеждаемся что все ID - membershipId
    const validMembershipIds = this.taskData.assigneeMembershipIds.filter(id => {
      const member = this.members().find(m => m.membershipId === id);
      if (!member) {
        console.warn('Invalid membershipId:', id);
      }
      return !!member;
    });

    if (validMembershipIds.length === 0) {
      alert('Выберите исполнителя');
      return;
    }

    const request: ITaskCreateRO = {
      title: this.taskData.title,
      description: this.taskData.description || undefined,
      priority: this.taskData.priority,
      departmentId: this.taskData.departmentId || undefined,
      assigneeMembershipIds: validMembershipIds,  // ✅ только membershipId
      dueDate: this.taskData.dueDate || undefined,
      parentTaskId: undefined
    };

    console.log('Creating task for members:', request.assigneeMembershipIds);

    this.taskService.createTask(request).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.router.navigate(['/tasks', res.id]);
      },
      error: (err) => {
        console.error('Ошибка', err);
        this.submitting.set(false);
        alert('Ошибка создания задачи');
      }
    });
  }

  toggleAssignee(membershipId: string): void {
    const index = this.taskData.assigneeMembershipIds.indexOf(membershipId);
    if (index === -1) {
      this.taskData.assigneeMembershipIds.push(membershipId);
    } else {
      this.taskData.assigneeMembershipIds.splice(index, 1);
    }
  }

  isSelected(membershipId: string): boolean {
    return this.taskData.assigneeMembershipIds.includes(membershipId);
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

  getInitials(member: IMemberResponse): string {
    return (member.displayName || member.email).charAt(0).toUpperCase();
  }
}
