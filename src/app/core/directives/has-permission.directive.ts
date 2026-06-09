// has-permission.directive.ts
import {Directive, inject, Input, OnInit, TemplateRef, ViewContainerRef} from '@angular/core';
import {AuthService} from '../services/auth.service';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly templateRef = inject(TemplateRef);
  private readonly vcr = inject(ViewContainerRef);

  @Input({ required: true, alias: 'appHasPermission' })
  permissions!: string[];

  ngOnInit() {
    let isPermitted = false;
    for (const permission of this.permissions) {
      if (this.auth.hasPermission(permission)) {
        isPermitted = true;
      }
    }
    if (isPermitted) {
      this.vcr.createEmbeddedView(this.templateRef);
    } else {
      this.vcr.clear();
    }
  }
}
