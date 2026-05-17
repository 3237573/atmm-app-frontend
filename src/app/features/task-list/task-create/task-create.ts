import {Component, effect, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import {TaskService} from '../../../core/services/task.service';
import {MemberService} from '../../../core/services/member.service';
import {AuthService} from '../../../core/services/auth.service';
import {MemberRO} from '../../../core/models/member.model';
import {TaskCreateRO, TaskPriority} from '../../../core/models/task/task.model';
import {DepartmentAffiliation} from '../../../core/models/departament.model';
import {ProjectAffiliation} from '../../../core/models/project.model';
import {DepartmentService} from '../../../core/services/departament.service';
import {BackOnEscapeDirective} from '../../../core/directives/back-on-escape.directive';

@Component({
  selector: 'app-task-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackOnEscapeDirective],
  templateUrl: './task-create.html',
  styleUrl: './task-create.scss'
})
export class TaskCreate implements OnInit {
  private readonly departmentService = inject(DepartmentService);
  private readonly taskService = inject(TaskService);
  private readonly memberService = inject(MemberService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  currentUser = signal<MemberRO | null>(null);
  userDepartments = signal<DepartmentAffiliation[]>([]);
  userProjects = signal<ProjectAffiliation[]>([]);
  departmentMembers = signal<MemberRO[]>([]);
  selectedDepartmentId = signal<string>('');   // ← теперь это основной источник departmentId

  loadingUser = signal(false);
  loadingMembers = signal(false);
  submitting = signal(false);

  parentTaskId: string | undefined;
  minDate = new Date().toISOString().split('T')[0];

  taskData = {
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    projectId: '',
    assigneeMembershipIds: [] as string[],
    dueDate: ''
  };

  private initialData = {...this.taskData, departmentId: ''};

  ngOnInit(): void {
    this.loadCurrentUser();

    this.route.queryParams.subscribe(params => {
      if (params['parentId']) this.parentTaskId = params['parentId'];
      if (params['assigneeId']) this.taskData.assigneeMembershipIds = [params['assigneeId']];
      if (params['title']) this.taskData.title = params['title'];
      this.saveInitialData();
    });

    effect(() => {
      const deptId = this.selectedDepartmentId();
      if (deptId && this.currentUser()) {
        this.loadDepartmentMembers(deptId);
      } else {
        this.departmentMembers.set([]);
        this.taskData.assigneeMembershipIds = [];
      }
    });
  }

  loadCurrentUser(): void {
    this.loadingUser.set(true);
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) {
      this.loadingUser.set(false);
      return;
    }

    this.memberService.getMember(currentUserId).subscribe({
      next: (user) => {
        this.currentUser.set(user);
        const uniqueDepartments = (user.departments || []).filter(
          (dept, idx, self) => self.findIndex(d => d.departmentId === dept.departmentId) === idx
        );
        const uniqueProjects = (user.projects || []).filter(
          (proj, idx, self) => self.findIndex(p => p.projectId === proj.projectId) === idx
        );
        this.userDepartments.set(uniqueDepartments);
        this.userProjects.set(uniqueProjects);

        if (uniqueDepartments.length > 0) {
          const firstDeptId = uniqueDepartments[0].departmentId;
          this.selectedDepartmentId.set(firstDeptId);
          this.loadDepartmentMembers(firstDeptId);
        }

        this.loadingUser.set(false);
        this.saveInitialData();
      },
      error: (err) => {
        console.error('Ошибка загрузки пользователя', err);
        this.loadingUser.set(false);
      }
    });
  }

  loadDepartmentMembers(departmentId: string): void {
    this.loadingMembers.set(true);
    this.departmentService.getDepartmentEmployees(departmentId).subscribe({
      next: (members) => {
        this.departmentMembers.set(members);
        const validIds = this.taskData.assigneeMembershipIds.filter(id =>
          members.some(m => m.id === id)
        );
        this.taskData.assigneeMembershipIds = validIds;
        this.loadingMembers.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки сотрудников отдела', err);
        this.departmentMembers.set([]);
        this.loadingMembers.set(false);
      }
    });
  }

  saveInitialData(): void {
    this.initialData = {
      title: this.taskData.title,
      description: this.taskData.description,
      priority: this.taskData.priority,
      projectId: this.taskData.projectId,
      assigneeMembershipIds: [...this.taskData.assigneeMembershipIds],
      dueDate: this.taskData.dueDate,
      departmentId: this.selectedDepartmentId()   // сохраняем отдел из сигнала
    };
  }

  hasUnsavedChanges(): boolean {
    const currentAssignees = JSON.stringify([...this.taskData.assigneeMembershipIds].sort());
    const initialAssignees = JSON.stringify([...this.initialData.assigneeMembershipIds].sort());
    return this.taskData.title !== this.initialData.title ||
      this.taskData.description !== this.initialData.description ||
      this.taskData.priority !== this.initialData.priority ||
      this.selectedDepartmentId() !== this.initialData.departmentId ||
      this.taskData.projectId !== this.initialData.projectId ||
      currentAssignees !== initialAssignees ||
      this.taskData.dueDate !== this.initialData.dueDate;
  }

  canDeactivate(): boolean {
    if (this.hasUnsavedChanges()) {
      return confirm('Есть несохранённые изменения. Вы уверены, что хотите уйти?');
    }
    return true;
  }

  onSubmit(): void {
    if (!this.taskData.title.trim()) return;
    const departmentId = this.selectedDepartmentId();
    if (!departmentId) {
      alert('Пожалуйста, выберите отдел для задачи');
      return;
    }

    const validMembershipIds = this.taskData.assigneeMembershipIds.filter(id =>
      this.departmentMembers().some(m => m.id === id)
    );

    if (validMembershipIds.length === 0) {
      alert('Выберите хотя бы одного исполнителя');
      return;
    }

    this.submitting.set(true);
    const request: TaskCreateRO & { projectId?: string } = {
      title: this.taskData.title.trim(),
      description: this.taskData.description?.trim() || undefined,
      priority: this.taskData.priority,
      departmentId: departmentId,                  // ← используем сигнал
      projectId: this.taskData.projectId || undefined,
      assigneeIds: validMembershipIds,
      dueDate: this.taskData.dueDate || undefined,
      parentTaskId: this.parentTaskId
    };

    this.taskService.createTask(request).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.saveInitialData();
        this.router.navigate(['/tasks', 'edit', res.id]);
      },
      error: (err) => {
        console.error('Ошибка создания задачи', err);
        this.submitting.set(false);
        alert('Ошибка сервера: ' + (err.error?.message || 'не удалось создать задачу'));
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

  onDepartmentChange(departmentId: string): void {
    this.selectedDepartmentId.set(departmentId);
    if (departmentId) {
      this.loadDepartmentMembers(departmentId);
    } else {
      this.departmentMembers.set([]);
      this.taskData.assigneeMembershipIds = [];
    }
  }

  getRoleBadgeClass(roleName: string): string {
    switch (roleName) {
      case 'OWNER': return 'owner';
      case 'ADMIN': return 'admin';
      case 'MEMBER': return 'member';
      case 'GUEST': return 'guest';
      default: return 'member';
    }
  }
}
