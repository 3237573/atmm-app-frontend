// has-permission.directive.ts
import {Directive, inject, Input, TemplateRef, ViewContainerRef} from '@angular/core';
import {AuthService} from '../services/auth/auth.service';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {
  private readonly auth = inject(AuthService);
  private readonly templateRef = inject(TemplateRef);
  private readonly vcr = inject(ViewContainerRef);

  @Input({ required: true, alias: 'appHasPermission' })
  permission!: string;

  ngOnInit() {
    if (this.auth.hasPermission(this.permission)) {
      this.vcr.createEmbeddedView(this.templateRef);
    } else {
      this.vcr.clear();
    }
  }
}
