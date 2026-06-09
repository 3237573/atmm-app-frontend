import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { MemberService } from '@core/services';
import { MemberRO } from '@core/models/member.model';
import { DepartmentService } from '@core/services/departament.service';
import { DepartmentRO } from '@core/models/departament.model';
import {NavigationService} from '@core/services/navigation.service';
import {BackOnEscapeDirective} from '@core/directives/back-on-escape.directive';
import {HasPermissionDirective} from '@core/directives/has-permission.directive';
import {ProjectService} from '@core/services/project.service';
import {ProjectRO} from '@core/models/project.model';

@Component({
  selector: 'app-department-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BackOnEscapeDirective, HasPermissionDirective],
  templateUrl: './department-detail.html',
  styleUrl: './department-detail.scss'
})
export class DepartmentDetail implements OnInit {
  private readonly deptService = inject(DepartmentService);
  private readonly navService = inject(NavigationService);
  private readonly memberService = inject(MemberService);
  private readonly projectService = inject(ProjectService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);


  allMembers = signal<MemberRO[]>([]);
  allDepartments = signal<DepartmentRO[]>([]);
  allProjects = signal<ProjectRO[]>([]);

  department = signal<DepartmentRO | null>(null);
  projects = signal<ProjectRO[]>([]);

  isNew = signal(false);
  loading = signal(true);
  showHeadModal = signal(false);
  showAddMemberModal = signal(false);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');

    if (id === 'create') {
      this.isNew.set(true);
      forkJoin([
        this.memberService.getMembers(),
        this.deptService.getDepartments()
      ]).subscribe({
        next: ([members, depts]) => {
          this.allMembers.set(members);
          this.allDepartments.set(depts);
          this.department.set({ id: '', name: '', status: 'ACTIVE', parentDepartmentId: null } as DepartmentRO);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
    } else if (id) {
      this.isNew.set(false);
      this.loadData(id);
    }
  }

  loadData(id: string) {
    this.loading.set(true);
    forkJoin([
      this.deptService.getDepartmentById(id),
      this.memberService.getMembers(),
      this.deptService.getDepartments()
    ]).subscribe({
      next: ([department, members, depts]) => {
        this.department.set(department);
        this.allMembers.set(members || []);
        this.allDepartments.set(depts || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  departmentEmployees = computed(() => {
    const dept = this.department();
    if (!dept) return [];
    return this.allMembers().filter(m =>
      m.departments?.some(a => a.departmentId === dept.id)
    );
  });

  availableToAssign = computed(() => {
    const employeesInDept = new Set(this.departmentEmployees().map(e => e.id));
    return this.allMembers().filter(m => !employeesInDept.has(m.id));
  });

  save() {
    const dept = this.department();
    if (!dept || !dept.name.trim()) return;

    const payload = {
      name: dept.name,
      parentDepartmentId: dept.parentDepartmentId || null,
      headMemberId: dept.headMemberId || null
    };

    const request$ = this.isNew()
      ? this.deptService.createDepartment(payload)
      : this.deptService.updateDepartment(dept.id, payload);

    request$.subscribe({
      next: (res) => {
        if (this.isNew()) {
          this.router.navigate(['/departments', res.id]);
        }
      },
      error: (err) => alert('Ошибка при сохранении: ' + err.error?.message)
    });
  }

  getRoleInDept(member: MemberRO, deptId: string): string {
    const affiliation = member.departments?.find(a => a.departmentId === deptId);
    return affiliation ? affiliation.role : 'Участник';
  }

  getMemberName(memberId: string): string {
    const member = this.allMembers().find(m => m.id === memberId);
    return member ? member.displayName : 'Не найден';
  }

  assignHead(memberId: string) {
    const deptId = this.department()?.id;
    if (!deptId) return;

    this.deptService.setHead(deptId, memberId).subscribe({
      next: () => {
        this.showHeadModal.set(false);
        this.loadData(deptId);
      },
      error: (err) => alert('Ошибка: ' + err.error?.message)
    });
  }


  assignMember(memberId: string, roleInDepartment: string) {
    const deptId = this.department()?.id;
    if (!deptId) return;

    this.deptService.assignEmployee(deptId, memberId, roleInDepartment).subscribe({
      next: () => {
        this.showAddMemberModal.set(false);
        this.loadData(deptId);
      }
    });
  }

  removeFromDept(memberId: string) {
    const deptId = this.department()?.id;
    if (deptId && confirm('Убрать сотрудника из отдела?')) {
      this.deptService.removeEmployee(deptId, memberId).subscribe(() => {
        this.loadData(deptId);
      });
    }
  }

  goBack(): void {
    this.navService.back('/departments');
  }

  updateRole(memberId: string, newRole: string) {
    const deptId = this.department()?.id;
    if (!deptId) return;

    this.deptService.updateEmployeeRole(deptId, memberId, newRole).subscribe({
      next: () => this.loadData(deptId)
    });
  }


}
