import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TaskService } from '@core/services/task.service';
import { MemberService } from '@core/services/member.service';
import { AuthService } from '@core/services/auth.service';
import { MemberRO } from '@core/models/member.model';
import { TaskCreateRO, TaskPriority, TaskRO, TaskTreeRO } from '@core/models/task/task.model';
import { DepartmentAffiliation } from '@core/models/departament.model';
import { ProjectAffiliation } from '@core/models/project.model';
import { DepartmentService } from '@core/services/departament.service';
import { BackOnEscapeDirective } from '@core/directives/back-on-escape.directive';
import { ComponentDeactivateService } from '@core/services/component-deactivate.service';
import { CanComponentDeactivate } from '@core/interfaces/can-deactivate.interface';
import { TranslocoPipe, TranslocoService } from '@ngneat/transloco';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-task-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackOnEscapeDirective, TranslocoPipe],
  templateUrl: './task-create.html',
  styleUrl: './task-create.scss'
})
export class TaskCreate implements OnInit, OnDestroy, CanComponentDeactivate {
  private readonly authService = inject(AuthService);
  private readonly deactivateService = inject(ComponentDeactivateService);
  private readonly departmentService = inject(DepartmentService);
  private readonly taskService = inject(TaskService);
  private readonly memberService = inject(MemberService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translocoService = inject(TranslocoService);

  private queryParamsSub?: Subscription;

  // ========== Состояния ==========
  currentUser = signal<MemberRO | null>(null);
  departmentMembers = signal<MemberRO[]>([]);
  parentTasksList = signal<{ id: string; title: string }[]>([]);
  loadingMembers = signal(false);
  loadingUser = signal(false);
  submitting = signal(false);
  userDepartments = signal<DepartmentAffiliation[]>([]);
  userProjects = signal<ProjectAffiliation[]>([]);

  minDate = new Date().toISOString().split('T')[0];

  // ========== Form fields (signals) ==========
  title = signal('');
  description = signal('');
  selectedDepartmentId = signal<string>('');
  projectId = signal<string>('');
  parentTaskId = signal<string>('');
  priority = signal<TaskPriority>('MEDIUM');
  dueDate = signal('');
  assigneeMemberIds = signal<string[]>([]);

  // ========== Валидация (computed) ==========
  isFormValid = computed(() => {
    return this.title().trim().length > 0 &&
      this.selectedDepartmentId() !== '' &&
      this.assigneeMemberIds().length > 0;
  });

  // ========== Данные для отслеживания несохранённых изменений ==========
  private readonly initialData = signal({
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    departmentId: '',
    projectId: '',
    parentTaskId: '',
    assigneeMemberIds: [] as string[],
    dueDate: ''
  });

  // ========== Lifecycle ==========
  ngOnInit(): void {
    this.deactivateService.register(this);
    this.loadCurrentUser();
    this.loadParentTasks();

    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      if (params['parentId']) this.parentTaskId.set(params['parentId']);
      if (params['assigneeId']) this.assigneeMemberIds.set([params['assigneeId']]);
      if (params['title']) this.title.set(params['title']);
      this.saveInitialData();
    });
  }

  ngOnDestroy(): void {
    this.deactivateService.unregister();
    this.queryParamsSub?.unsubscribe();
  }

  // ========== Возвращает класс цвета приоритета (как в списке задач) ==========
  getPriorityColor(priority: string): string {
    return priority ? priority.toLowerCase() : 'low';
  }

  // ========== Загрузка текущего пользователя ==========
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

        const uniqueDepartments = Array.from(
          new Map((user.departments || []).map(d => [d.departmentId, d])).values()
        );
        const uniqueProjects = Array.from(
          new Map((user.projects || []).map(p => [p.projectId, p])).values()
        );

        this.userDepartments.set(uniqueDepartments);
        this.userProjects.set(uniqueProjects);

        if (uniqueDepartments.length > 0) {
          const firstDeptId = uniqueDepartments[0].departmentId;
          this.selectedDepartmentId.set(firstDeptId);
          this.loadDepartmentMembers(firstDeptId);
        }

        this.saveInitialData();
        this.loadingUser.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки пользователя', err);
        this.loadingUser.set(false);
      }
    });
  }

  // ========== Загрузка сотрудников отдела ==========
  loadDepartmentMembers(departmentId: string): void {
    this.loadingMembers.set(true);
    this.departmentService.getDepartmentEmployees(departmentId).subscribe({
      next: (members) => {
        const sortedMembers = [...members].sort((a, b) => a.email.localeCompare(b.email));
        this.departmentMembers.set(sortedMembers);

        const validIds = this.assigneeMemberIds().filter(id =>
          sortedMembers.some(m => m.id === id)
        );
        this.assigneeMemberIds.set(validIds);
        this.loadingMembers.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки сотрудников отдела', err);
        this.departmentMembers.set([]);
        this.loadingMembers.set(false);
      }
    });
  }

  // ========== Загрузка родительских задач ==========
  loadParentTasks(): void {
    this.taskService.getMyTaskTree().subscribe({
      next: (trees) => {
        const allTasks = this.flattenTaskTree(trees);
        allTasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        const available = allTasks.map(t => ({ id: t.id, title: t.title }));
        this.parentTasksList.set(available);
      },
      error: (err) => console.error('Ошибка загрузки списка задач', err)
    });
  }

  private flattenTaskTree(trees: TaskTreeRO[]): TaskRO[] {
    const result: TaskRO[] = [];
    const traverse = (nodes: TaskTreeRO[]) => {
      for (const node of nodes) {
        result.push(node.task);
        if (node.subtasks?.length) traverse(node.subtasks);
      }
    };
    traverse(trees);
    return result;
  }

  // ========== Сохранение начального состояния ==========
  saveInitialData(): void {
    this.initialData.set({
      title: this.title(),
      description: this.description(),
      priority: this.priority(),
      departmentId: this.selectedDepartmentId(),
      projectId: this.projectId(),
      parentTaskId: this.parentTaskId(),
      assigneeMemberIds: [...this.assigneeMemberIds()],
      dueDate: this.dueDate()
    });
  }

  hasUnsavedChanges(): boolean {
    const initial = this.initialData();
    const currentAssignees = [...this.assigneeMemberIds()].sort();
    const initialAssignees = [...initial.assigneeMemberIds].sort();

    return this.title() !== initial.title ||
      this.description() !== initial.description ||
      this.priority() !== initial.priority ||
      this.selectedDepartmentId() !== initial.departmentId ||
      this.projectId() !== initial.projectId ||
      this.parentTaskId() !== initial.parentTaskId ||
      this.dueDate() !== initial.dueDate ||
      JSON.stringify(currentAssignees) !== JSON.stringify(initialAssignees);
  }

  canDeactivate(): boolean {
    if (this.hasUnsavedChanges()) {
      return confirm('Есть несохранённые изменения. Вы уверены, что хотите уйти?');
    }
    return true;
  }

  // ========== Отправка формы ==========
  onSubmit(): void {
    if (!this.isFormValid()) return;

    const departmentId = this.selectedDepartmentId();
    const validMemberIds = this.assigneeMemberIds().filter(id =>
      this.departmentMembers().some(m => m.id === id)
    );

    this.submitting.set(true);

    const request: TaskCreateRO = {
      title: this.title().trim(),
      description: this.description().trim() || undefined,
      priority: this.priority(),
      departmentId: departmentId,
      projectId: this.projectId() || undefined,
      assigneeIds: validMemberIds,
      dueDate: this.dueDate() || undefined,
      parentTaskId: this.parentTaskId() || undefined
    };

    this.taskService.createTask(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.saveInitialData();
        this.router.navigate(['/tasks']);
      },
      error: (err) => {
        console.error('Ошибка создания задачи', err);
        this.submitting.set(false);
        alert('Ошибка сервера: ' + (err.error?.message || 'не удалось создать задачу'));
      }
    });
  }

  toggleAssignee(memberId: string): void {
    const current = this.assigneeMemberIds();
    if (current.includes(memberId)) {
      this.assigneeMemberIds.set(current.filter(id => id !== memberId));
    } else {
      this.assigneeMemberIds.set([...current, memberId]);
    }
  }

  isSelected(memberId: string): boolean {
    return this.assigneeMemberIds().includes(memberId);
  }

  onDepartmentChange(departmentId: string): void {
    this.selectedDepartmentId.set(departmentId);
    if (departmentId) {
      this.loadDepartmentMembers(departmentId);
    } else {
      this.departmentMembers.set([]);
      this.assigneeMemberIds.set([]);
    }
  }

  getDepartmentRole(member: MemberRO): string {
    const currentDeptId = this.selectedDepartmentId();
    const affiliation = member.departments?.find(dept => dept.departmentId === currentDeptId);
    return affiliation ? affiliation.role : this.translocoService.translate('taskCreate.fields.defaultDeptRole');
  }

  getRoleBadgeClass(roleName: string): string {
    switch (roleName?.toUpperCase()) {
      case 'OWNER': return 'owner';
      case 'ADMIN': return 'admin';
      case 'MEMBER': return 'member';
      case 'GUEST': return 'guest';
      default: return 'member';
    }
  }
}
