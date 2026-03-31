import {Component, inject, input, OnInit, output} from '@angular/core';
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {Category} from '../../../core/models/tracker/category.model';

@Component({
  selector: 'app-category-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './category-modal.html',
  styleUrls: ['../tracker-admin.scss']
})
export class CategoryModal implements OnInit {
  private readonly fb =   inject(FormBuilder)

  // Входные данные: категория для редактирования (если null — создаем новую)
  category = input<Category | null>(null);

  // События
  close = output<void>();
  save = output<Category>();

  // Форма теперь живет здесь
  categoryForm = this.fb.group({
    id: new FormControl<string | null>(null),
    nameRu: new FormControl('', [Validators.required]),
    nameEn: new FormControl('', [Validators.required]),
    slug: new FormControl('', [Validators.required]),
    color: new FormControl('#3b82f6', [Validators.required]),
    icon: new FormControl('folder', [Validators.required]),
    priority: new FormControl(0)
  });

  ngOnInit() {
    // Если передана категория, заполняем форму
    const initialData = this.category();
    if (initialData) {
      this.categoryForm.patchValue(initialData);
    }
  }

  submit() {
    if (this.categoryForm.valid) {
      // Отправляем объект Category наверх родителю
      this.save.emit(this.categoryForm.value as Category);
    }
  }

}
