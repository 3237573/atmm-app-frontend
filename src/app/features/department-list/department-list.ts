import {CommonModule} from '@angular/common';
import {RouterModule} from '@angular/router';
import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {DepartmentService} from '../../core/services/departament.service';
import {DepartmentRO} from '../../core/models/departament.model';
import {BackOnEscapeDirective} from '../../core/directives/back-on-escape.directive';
import {NavigationService} from '../../core/services/navigation.service';
import {HasPermissionDirective} from '../../core/directives/has-permission.directive';

@Component({
  selector: 'app-department-list',
  standalone: true,
  imports: [CommonModule, RouterModule, BackOnEscapeDirective, HasPermissionDirective],
  templateUrl: './department-list.html',
  styleUrl: './department-list.scss'
})
export class DepartmentList implements OnInit {
  private readonly deptService = inject(DepartmentService);
  private readonly navService = inject(NavigationService);


  private readonly rawDepartments = signal<DepartmentRO[]>([]);
  loading = signal(true);

  // Сигнал для хранения ID развернутых узлов
  expandedNodes = signal<Set<string>>(new Set());

  departmentTree = computed(() => {
    const list = this.rawDepartments();
    const map = new Map<string | null, DepartmentRO[]>();

    list.forEach(dept => {
      const pId = dept.parentDepartmentId || null;
      if (!map.has(pId)) map.set(pId, []);
      map.get(pId)!.push({ ...dept, childDepartments: [] as DepartmentRO[] });
    });

    const build = (parentDepartmentId: string | null): DepartmentRO[] => {
      const children = map.get(parentDepartmentId) || [];
      return children.map(child => ({
        ...child,
        childDepartments: build(child.id)
      }));
    };

    return build(null);
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.deptService.getDepartments().subscribe({
      next: (data) => {
        this.rawDepartments.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // Метод для сворачивания/разворачивания
  toggleNode(id: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const newSet = new Set(this.expandedNodes());
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    this.expandedNodes.set(newSet);
  }

  protected readonly Array = Array;
}
