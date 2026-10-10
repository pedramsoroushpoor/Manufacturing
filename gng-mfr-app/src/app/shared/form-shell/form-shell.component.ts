import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { FormCodeChipComponent } from '../form-code-chip/form-code-chip.component';
import {
  FeatureArtifactType,
  FeatureComplexity,
  FeaturePriority,
  FormShellConfig,
} from '../../core/models/form-shell.model';

const ARTIFACT_LABEL: Record<FeatureArtifactType, string> = {
  BasicForm: 'فرم پایه',
  SpecializedUI: 'رابط تخصصی',
  ReportDashboard: 'گزارش / داشبورد',
  CalcEngine: 'موتور محاسباتی',
  ServiceIntegration: 'یکپارچه‌سازی سرویس',
  PlatformInfra: 'زیرساخت پلتفرم',
};

const PRIORITY_LABEL: Record<FeaturePriority, string> = {
  M: 'الزامی',
  S: 'مطلوب',
  C: 'اختیاری',
};
const PRIORITY_SEVERITY: Record<FeaturePriority, 'danger' | 'warning' | 'info'> = {
  M: 'danger',
  S: 'warning',
  C: 'info',
};

const COMPLEXITY_LABEL: Record<FeatureComplexity, string> = {
  Simple: 'ساده',
  Medium: 'متوسط',
  Complex: 'پیچیده',
  VeryComplex: 'بسیار پیچیده',
};
const COMPLEXITY_SEVERITY: Record<FeatureComplexity, 'success' | 'info' | 'warning' | 'danger'> = {
  Simple: 'success',
  Medium: 'info',
  Complex: 'warning',
  VeryComplex: 'danger',
};

/**
 * رندرر عمومی «پوسته‌ی فرم» — یک کامپوننت برای همه‌ی فرم‌های پروتوتایپ.
 * ورودی singleش FormShellConfig است؛ هیچ فرمی کامپوننت اختصاصی ندارد مگر
 * در فاز بعد که طراحی فیلد‌به‌فیلد هر تب نهایی شود.
 */
@Component({
  selector: 'gng-form-shell',
  standalone: true,
  imports: [CommonModule, TabViewModule, TableModule, TagModule, ButtonModule, FormCodeChipComponent],
  templateUrl: './form-shell.component.html',
  styleUrl: './form-shell.component.scss',
})
export class FormShellComponent {
  @Input({ required: true }) config!: FormShellConfig;

  artifactLabel(type: FeatureArtifactType): string {
    return ARTIFACT_LABEL[type];
  }
  priorityLabel(p: FeaturePriority): string {
    return PRIORITY_LABEL[p];
  }
  prioritySeverity(p: FeaturePriority) {
    return PRIORITY_SEVERITY[p];
  }
  complexityLabel(c: FeatureComplexity): string {
    return COMPLEXITY_LABEL[c];
  }
  complexitySeverity(c: FeatureComplexity) {
    return COMPLEXITY_SEVERITY[c];
  }
}
