import { Component, input, output, OnInit, inject, DestroyRef, HostListener, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {FormBuilder, FormControl, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import { TranslocoModule } from '@ngneat/transloco';
import { CommonModule } from '@angular/common';
import { Category } from '../../../../core/models/tracker/category.model';
import { translit } from '../../../../core/utils/translit.utils';
import {BackOnEscapeDirective} from '../../../../core/services/navigation/back-on-escape';

// Популярные иконки для категорий
const POPULAR_ICONS = [
  'code', 'terminal', 'developer_mode', 'integration_instructions',  // Development
  'chat', 'forum', 'message', 'sms', 'group',                         // Communication
  'dns', 'storage', 'cloud', 'router', 'settings_ethernet',           // Infrastructure
  'public', 'language', 'web', 'explore', 'travel_explore',           // Browsing
  'brush', 'palette', 'design_services', 'draw', 'auto_awesome',      // Design
  'assignment', 'folder', 'work', 'business', 'dashboard',            // Management
  'category', 'more_horiz', 'apps', 'extension', 'widgets',           // Other
  'favorite', 'star', 'schedule', 'alarm', 'timer',                   // Common
  'check_circle', 'warning', 'info', 'help', 'settings'               // Common 2
];

@Component({
  selector: 'app-category-modal',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoModule, CommonModule, FormsModule, BackOnEscapeDirective],
  templateUrl: './category-modal.html',
  styleUrls: ['../tracker-admin.scss', 'category-modal.scss']
})
export class CategoryModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  category = input<Category | null>(null);
  close = output<void>();
  save = output<Category>();

  // Состояние для выбора иконок
  showIconPicker = signal(false);
  iconSearchQuery = signal('');

  filteredIcons = computed(() => {
    const query = this.iconSearchQuery().toLowerCase();
    if (!query) return POPULAR_ICONS;
    return POPULAR_ICONS.filter(icon => icon.toLowerCase().includes(query));
  });

  categoryForm = this.fb.group({
    id: [null as string | null],
    name: ['', Validators.required],
    slug: ['', Validators.required],
    color: ['#3b82f6', Validators.required],
    icon: ['folder', Validators.required],
    priority: new FormControl(0, [Validators.required, Validators.min(0)])
  });

  @HostListener('document:keydown.escape')
  onEsc() {
    this.showIconPicker.set(false);
    this.close.emit();
  }

  ngOnInit() {
    if (this.category()) {
      this.categoryForm.patchValue(this.category()!);
    }

    // Следим за name для авто-генерации слага
    this.categoryForm.get('name')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        const slugCtrl = this.categoryForm.get('slug');
        if (slugCtrl?.pristine || !slugCtrl?.value) {
          slugCtrl?.setValue(translit(val || ''), { emitEvent: false });
        }
      });
  }

  submit() {
    if (this.categoryForm.valid) {
      this.save.emit(this.categoryForm.getRawValue() as Category);
    }
  }

  selectIcon(icon: string) {
    this.categoryForm.patchValue({ icon });
    this.showIconPicker.set(false);
    this.iconSearchQuery.set('');
  }

  toggleIconPicker() {
    this.showIconPicker.update(v => !v);
    if (!this.showIconPicker()) {
      this.iconSearchQuery.set('');
    }
  }
}
