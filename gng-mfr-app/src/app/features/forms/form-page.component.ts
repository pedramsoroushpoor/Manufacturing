import { Component, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormShellComponent } from '../../shared/form-shell/form-shell.component';
import { FormShellConfig } from '../../core/models/form-shell.model';
import { getDetailedFormComponent, getFormConfig } from './data/forms-registry';

/**
 * صفحه‌ی عمومی «هر فرمِ منو» — با یک روت (forms/:formCode) هر آیتم سطح ۲
 * منو که FormCode دارد را سرویس می‌دهد. اگر فرم به کامپوننت اختصاصی
 * «چکش‌کاری‌شده» ارتقا یافته باشد همان رندر می‌شود؛ در غیر این صورت
 * پوسته‌ی عمومی (FormShellComponent) بر اساس داده‌ی alm.Form/Feature نمایش
 * داده می‌شود.
 */
@Component({
  selector: 'gng-form-page',
  standalone: true,
  imports: [CommonModule, FormShellComponent],
  templateUrl: './form-page.component.html',
  styleUrl: './form-page.component.scss',
})
export class FormPageComponent {
  config: FormShellConfig | undefined;
  detailedComponent: Type<unknown> | undefined;
  requestedCode = '';

  constructor(private readonly route: ActivatedRoute) {
    this.route.paramMap.subscribe((params) => {
      this.requestedCode = params.get('formCode') ?? '';
      this.detailedComponent = getDetailedFormComponent(this.requestedCode);
      this.config = this.detailedComponent ? undefined : getFormConfig(this.requestedCode);
    });
  }
}
