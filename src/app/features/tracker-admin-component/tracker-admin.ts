import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ReactiveFormsModule} from '@angular/forms';
import {Category} from '../../core/models/tracker/category.model';
import {CategoryRule} from '../../core/models/tracker/category.rule.model';
import {TrackerAdminService} from '../../core/services/tracker/tracker.admin.service';
import {CategoryRuleModal} from './category-rule-modal/category-rule-modal';
import {CategoryModal} from './category-modal/category-modal';

@Component({
  selector: 'app-tracker-admin',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CategoryRuleModal,
    CategoryModal
  ],
  templateUrl: './tracker-admin.html',
  styleUrl: './tracker-admin.scss',
})
export class TrackerAdmin implements OnInit {
  private readonly trackerAdminService = inject(TrackerAdminService);
  private readonly http = inject(HttpClient);

  // Используем сигналы для реактивности и производительности
  categories = signal<Category[]>([]);
  rules = signal<CategoryRule[]>([]);
  isRecalculating = signal(false);
  showCategoryModal = signal(false);
  editingCategory = signal<Category | null>(null);

  showCategoryRuleModal = signal(false);
  selectedCategory = signal<Category | null>(null);

  addRule(category: Category) {
    this.selectedCategory.set(category);
    this.showCategoryRuleModal.set(true);
  }

  handleSaveCategoryRule(payload: { categoryId: string, pattern: string }) {
    this.trackerAdminService.createRule(payload).subscribe({
      next: () => {
        this.loadData();
        this.closeCategoryRuleModal();
      }
    });
  }

  closeCategoryRuleModal() {
    this.showCategoryRuleModal.set(false);
  }

  handleSaveCategory(category: Category) {
    const obs$ = category.id
      ? this.trackerAdminService.patchCategory(category)
      : this.trackerAdminService.createCategory(category);

    obs$.subscribe({
      next: () => {
        this.loadData();
        this.closeCategoryModal();
      }
    });
  }


  // Автоматическая группировка данных
  categoryGroups = computed(() => {
    const allRules = this.rules();
    return this.categories().map(category => ({
      category,
      rules: allRules.filter(r => r.categoryId === category.id)
    }));
  });


  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.trackerAdminService.getCategories().subscribe(res => this.categories.set(res));
    this.trackerAdminService.getRules().subscribe(res => this.rules.set(res));
  }

  // --- Управление категориями ---

  // Открытие модалки
  openCategoryModal(category?: Category) {
    if (category && !category.companyId) return;

    if (category?.id) {
      this.editingCategory.set(category);
    } else {
      this.editingCategory.set(null);
    }
    this.showCategoryModal.set(true);
  }

  closeCategoryModal() {
    this.showCategoryModal.set(false);
    this.editingCategory.set(null);
  }

  deleteCategory(id?: string, event?: Event) {
    event?.stopPropagation();
    if (!id) return;

    const category = this.categories().find(c => c.id === id);
    if (category && !category.companyId) {
      alert('Системные категории нельзя удалять');
      return;
    }

    if (!confirm('Удалить категорию?')) return;

    this.trackerAdminService.deleteCategory(id).subscribe({
      next: () => this.categories.update(list => list.filter(c => c.id !== id)),
      error: () => alert('Не удалось удалить категорию')
    });
  }

  // --- Управление правилами ---

  deleteRule(id?: string) {
    if (!id || !confirm('Удалить правило?')) return;
    this.trackerAdminService.deleteRule(id).subscribe({
      next: () => this.rules.update(list => list.filter(r => r.id !== id))
    });
  }

  recalculate() {
    if (this.isRecalculating() || !confirm('Применить классификацию к истории за 30 дней?')) return;
    this.isRecalculating.set(true);
    this.http.post('admin/tracker/recalculate', {}).subscribe({
      next: () => {
        alert('Успешно');
        this.isRecalculating.set(false);
      },
      error: () => this.isRecalculating.set(false)
    });
  }

}
