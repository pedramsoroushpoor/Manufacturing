import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TabViewModule } from 'primeng/tabview';
import {
  AlmFormAccess,
  AlmFormFeature,
  AlmFormSpec,
  AlmFormSpecService,
} from '../../core/services/alm-form-spec.service';

type CoverageKey = 'delivered' | 'inProgress' | 'assigned' | 'notStarted';

interface CoverageBucket {
  key: CoverageKey;
  label: string;
  count: number;
  effort: number;
}

interface FeatureGroup {
  key: string;
  title: string;
  features: AlmFormFeature[];
  effort: number;
}

const COVERAGE_LABEL: Record<CoverageKey, string> = {
  delivered: 'تحویل نهایی',
  inProgress: 'پیاده‌شده، در حال تکمیل',
  assigned: 'تخصیص یافته',
  notStarted: 'شروع نشده',
};

/**
 * عنوان فارسی گروه‌های کاربری. ALM برای UserGroupCode جدول عنوان ندارد؛
 * این نگاشت فقط گروه‌هایی را پوشش می‌دهد که عنوانشان در خودِ داده‌ی alm
 * (ستون OtherAccessGroupsText فرم‌ها) آمده است — بقیه با کد نمایش داده
 * می‌شوند تا عنوانی از خودمان نساخته باشیم.
 */
const USER_GROUP_LABEL: Record<string, string> = {
  mes_Admin: 'مدیر سیستم / پلتفرم',
  mes_TechOffice: 'دفتر فنی',
  mes_ManufEng: 'مهندسی تولید',
  mes_Planner: 'برنامه‌ریز تولید',
  mes_PointOfUseStorekeeper: 'انباردار پای کار',
  mes_Manager: 'مدیر تولید',
};

/**
 * صفحه‌ی «مشخصات فرم در ALM» — با کلیک روی کد فرم (مثلاً FRM-RM-01) در تب
 * جدا باز می‌شود و چهار چیز را از اسکیمای alm نشان می‌دهد: مشخصات فرم،
 * فیچرهایی که پوشش می‌دهد یا باید بدهد، ماتریس دسترسی و عملیات‌ها.
 */
@Component({
  selector: 'gng-alm-form-spec',
  standalone: true,
  imports: [CommonModule, RouterLink, TabViewModule],
  templateUrl: './alm-form-spec.component.html',
  styleUrl: './alm-form-spec.component.scss',
})
export class AlmFormSpecComponent {
  formCode = '';
  loading = true;
  errorText = '';
  notFound = false;

  spec?: AlmFormSpec;
  coverage: CoverageBucket[] = [];
  groups: FeatureGroup[] = [];
  tabs: string[] = [];
  totalEffort = 0;
  /** فیچرهایی که در فرم پیاده شده‌اند: «در حال کار» یا «تحویل شده». */
  implementedCount = 0;
  deliveredCount = 0;
  notImplementedCount = 0;

  readonly permissionColumns: { key: keyof AlmFormAccess; label: string }[] = [
    { key: 'allowRetrieve', label: 'مشاهده' },
    { key: 'allowCreate', label: 'ایجاد' },
    { key: 'allowModify', label: 'ویرایش' },
    { key: 'allowRemove', label: 'حذف' },
    { key: 'allowExecute', label: 'اجرا' },
  ];

  constructor(route: ActivatedRoute, private readonly service: AlmFormSpecService) {
    route.paramMap.subscribe((params) => {
      this.formCode = params.get('formCode') ?? '';
      this.load();
    });
  }

  private load(): void {
    this.loading = true;
    this.errorText = '';
    this.notFound = false;
    this.spec = undefined;
    this.service.load(this.formCode).subscribe({
      next: (spec) => {
        this.spec = spec;
        this.derive(spec);
        this.loading = false;
        document.title = `${spec.form.code} — مشخصات فرم`;
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.notFound = err.status === 404;
        this.errorText = this.notFound
          ? `فرمی با کد «${this.formCode}» در alm.Form ثبت نشده است.`
          : 'خواندن مشخصات فرم از ALM ناموفق بود. اتصال gng-mfr-api را بررسی کنید.';
      },
    });
  }

  private derive(spec: AlmFormSpec): void {
    this.tabs = (spec.form.tabsDescription ?? '')
      .split('·')
      .map((t) => t.trim())
      .filter(Boolean);

    const buckets: Record<CoverageKey, CoverageBucket> = {
      delivered: { key: 'delivered', label: COVERAGE_LABEL.delivered, count: 0, effort: 0 },
      inProgress: { key: 'inProgress', label: COVERAGE_LABEL.inProgress, count: 0, effort: 0 },
      assigned: { key: 'assigned', label: COVERAGE_LABEL.assigned, count: 0, effort: 0 },
      notStarted: { key: 'notStarted', label: COVERAGE_LABEL.notStarted, count: 0, effort: 0 },
    };
    const groups = new Map<string, FeatureGroup>();
    this.totalEffort = 0;

    for (const f of spec.features) {
      const effort = Number(f.effortDays) || 0;
      this.totalEffort += effort;
      const b = buckets[this.coverageKey(f)];
      b.count++;
      b.effort += effort;

      const key = f.phaseCode ?? '-';
      let g = groups.get(key);
      if (!g) {
        g = { key, title: f.phaseTitle ?? 'بدون فاز توسعه', features: [], effort: 0 };
        groups.set(key, g);
      }
      g.features.push(f);
      g.effort += effort;
    }

    this.coverage = Object.values(buckets);
    this.groups = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
    this.deliveredCount = buckets.delivered.count;
    this.implementedCount = buckets.delivered.count + buckets.inProgress.count;
    this.notImplementedCount = spec.features.length - this.implementedCount;
  }

  coverageKey(f: AlmFormFeature): CoverageKey {
    switch (f.devStatusCode) {
      case 'Delivered':
        return 'delivered';
      case 'InProgress':
        return 'inProgress';
      case 'Assigned':
        return 'assigned';
      default:
        return 'notStarted';
    }
  }

  coverageLabel(f: AlmFormFeature): string {
    return f.devStatusTitle ?? COVERAGE_LABEL.notStarted;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  share(bucket: CoverageBucket): number {
    const total = this.spec?.features.length ?? 0;
    return total ? (100 * bucket.count) / total : 0;
  }

  groupLabel(code: string): string {
    return USER_GROUP_LABEL[code] ?? code;
  }

  hasGroupLabel(code: string): boolean {
    return !!USER_GROUP_LABEL[code];
  }

  allowed(row: AlmFormAccess, key: keyof AlmFormAccess): boolean {
    return row[key] === true;
  }

  isPrimaryEditor(row: AlmFormAccess): boolean {
    return row.allowCreate || row.allowModify || row.allowRemove;
  }
}
