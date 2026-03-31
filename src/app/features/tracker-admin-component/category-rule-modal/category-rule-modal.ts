import {Component, HostListener, input, output} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-category-rule-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
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

  submit() {
    if (this.ruleForm.valid) {
      this.save.emit({
        categoryId: this.categoryId(),
        pattern: this.ruleForm.value.pattern!
      });
    }
  }
}
