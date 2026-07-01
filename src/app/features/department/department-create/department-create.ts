import {Component, inject, OnInit, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';

import { DepartmentService } from '@core/services/departament.service';
import { MemberService } from '@core/services';
import { CreateDepartmentRequest } from '@core/models/departament.model';
import { MemberRO } from '@core/models/member.model';
import {TranslocoDirective} from '@ngneat/transloco';

@Component({
  selector: 'app-department-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslocoDirective],
  templateUrl: './department-create.html',
  styleUrl: './department-create.scss'
})
export class DepartmentCreate implements OnInit {
  private readonly deptService = inject(DepartmentService);
  private readonly memberService = inject(MemberService);
  private readonly router = inject(Router);

  loading = signal(false);
  departments = signal<any[]>([]);
  allMembers = signal<MemberRO[]>([]);
  selectedMembers = signal<Map<string, string>>(new Map());

  formData: CreateDepartmentRequest = {
    name: '',
    parentDepartmentId: null,
    headMemberId: null
  };

  ngOnInit() {
    this.loading.set(true);

    forkJoin([
      this.deptService.getDepartments(),
      this.memberService.getMembers()
    ]).subscribe({
      next: ([depts, members]) => {
        this.departments.set(depts);
        this.allMembers.set(members);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSubmit() {
    if (!this.formData.name.trim()) return;

    this.loading.set(true);

    this.deptService.createDepartment(this.formData).subscribe({
      next: (newDept) => {
        const assignments = Array.from(this.selectedMembers().entries())
          .map(([memberId, role]) =>
            this.deptService.assignEmployee(newDept.id, memberId, role)
          );

        if (assignments.length === 0) {
          this.router.navigate(['/departments', newDept.id]);
          return;
        }

        forkJoin(assignments).subscribe(() => {
          this.router.navigate(['/departments', newDept.id]);
        });
      },
      error: (err) => {
        console.error('Ошибка создания:', err);
        this.loading.set(false);
      }
    });
  }

  goBack() {
    void this.router.navigate(['/departments']);
  }

  toggleMember(id: string, checked: boolean) {
    const map = new Map(this.selectedMembers());
    if (checked) {
      map.set(id, 'Участник');
    } else {
      map.delete(id);
    }
    this.selectedMembers.set(map);
  }

  setRole(id: string, role: string) {
    const map = new Map(this.selectedMembers());
    if (map.has(id)) {
      map.set(id, role);
      this.selectedMembers.set(map);
    }
  }
}
