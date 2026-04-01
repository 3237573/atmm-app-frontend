import { Component, input, output, inject, HostListener } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@ngneat/transloco';

@Component({
  selector: 'app-category-rule-modal',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoModule],
  templateUrl: './category-rule-modal.html',
  styleUrls: ['../tracker-admin.scss']
})
export class CategoryRuleModal {
  categoryName = input.required<string>();
  categoryId = input.required<string>();

  close = output<void>();
  save = output<{ categoryId: string, pattern: string }>();

  ruleForm = new FormGroup({
    pattern: new FormControl('', [Validators.required, Validators.minLength(2)])
  });

  @HostListener('document:keydown.escape')
  onEsc() { this.close.emit(); }

  submit() {
    if (this.ruleForm.valid) {
      this.save.emit({
        categoryId: this.categoryId(),
        pattern: this.ruleForm.value.pattern!
      });
    }
  }
}
