import { Component, input, output, OnInit, inject, DestroyRef, HostListener } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import { TranslocoModule } from '@ngneat/transloco';
import { Category } from '../../../core/models/tracker/category.model';
import { translit } from '../../../core/utils/translit.utils'; // Импорт твоей новой утилиты

@Component({
  selector: 'app-category-modal',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoModule],
  templateUrl: './category-modal.html',
  styleUrls: ['../tracker-admin.scss', 'category-modal.scss']
})
export class CategoryModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  category = input<Category | null>(null);
  close = output<void>();
  save = output<Category>();

  categoryForm = this.fb.group({
    id: [null as string | null],
    name: ['', Validators.required], // Упростили
    slug: ['', Validators.required],
    color: ['#3b82f6', Validators.required],
    icon: ['folder', Validators.required],
    priority: new FormControl(0, [Validators.required, Validators.min(0)])
  });

  @HostListener('document:keydown.escape')
  onEsc() { this.close.emit(); }

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
}
