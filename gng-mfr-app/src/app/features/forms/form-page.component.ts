import { Component, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormShellComponent } from '../../shared/form-shell/form-shell.component';
import { FormShellConfig } from '../../core/models/form-shell.model';
import { AlmFormFeature, AlmFormSpec, AlmFormSpecService } from '../../core/services/alm-form-spec.service';
import { getDetailedFormComponent, getFormConfig } from './data/forms-registry';

interface FeatureGroup {
  title: string;
  tone: string;
  features: AlmFormFeature[];
}

/**
 * صفحه‌ی عمومی «هر فرمِ منو» — با یک روت (forms/:formCode) هر آیتم سطح ۲
 * منو که FormCode دارد را سرویس می‌دهد. اگر فرم به کامپوننت اختصاصی
 * «چکش‌کاری‌شده» ارتقا یافته باشد همان رندر می‌شود؛ در غیر این صورت
 * پوسته‌ی عمومی (FormShellComponent) بر اساس داده‌ی alm.Form/Feature نمایش
 * داده می‌شود. فرمی که هیچ‌کدام را ندارد (مثلاً فرم‌های زیرسیستم‌های برنامه‌ریزی،
 * کیفیت، بهای تمام‌شده، انبار و نت) شناسنامه‌ی طراحی‌اش را از ALM نشان می‌دهد.
 */
@Component({
  selector: 'gng-form-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormShellComponent],
  templateUrl: './form-page.component.html',
  styleUrl: './form-page.component.scss',
})
export class FormPageComponent {
  config: FormShellConfig | undefined;
  detailedComponent: Type<unknown> | undefined;
  requestedCode = '';

  spec: AlmFormSpec | null = null;
  specLoading = false;
  specFailed = false;
  tabs: string[] = [];
  groups: FeatureGroup[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly almSpec: AlmFormSpecService,
  ) {
    this.route.paramMap.subscribe((params) => {
      this.requestedCode = params.get('formCode') ?? '';
      this.detailedComponent = getDetailedFormComponent(this.requestedCode);
      this.config = this.detailedComponent ? undefined : getFormConfig(this.requestedCode);
      this.spec = null;
      if (!this.detailedComponent && !this.config && this.requestedCode) this.loadSpec(this.requestedCode);
    });
  }

  private loadSpec(code: string): void {
    this.specLoading = true;
    this.specFailed = false;
    this.almSpec.load(code).subscribe({
      next: (s) => {
        if (code !== this.requestedCode) return;
        this.spec = s;
        this.tabs = (s.form.tabsDescription ?? '')
          .split(/[·•،,]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        const by = (p: string) => s.features.filter((f) => (f.priorityCode ?? '') === p);
        const known = new Set(['M', 'S', 'C']);
        this.groups = [
          { title: 'الزامی', tone: 'm', features: by('M') },
          { title: 'مهم', tone: 's', features: by('S') },
          { title: 'مطلوب', tone: 'c', features: by('C') },
          { title: 'بدون اولویت', tone: 'x', features: s.features.filter((f) => !known.has(f.priorityCode ?? '')) },
        ].filter((g) => g.features.length > 0);
        this.specLoading = false;
      },
      error: () => {
        this.specLoading = false;
        this.specFailed = true;
      },
    });
  }

  get started(): number {
    return this.spec ? this.spec.features.filter((f) => !!f.devStatusCode).length : 0;
  }

  fa(n: number | null | undefined): string {
    return n === null || n === undefined ? '—' : n.toLocaleString('fa-IR');
  }
}
