import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { faNum } from './me-routing';
import { Issue, Me05Bundle } from './frm-me-05.data';
import { FrmMe05Service } from './frm-me-05.service';

/**
 * FRM-ME-05 — «عملیات بازیابی مواد».
 *
 * عملیات بازیابی (تقطیر، تغلیظ، جداسازی، فیلتراسیون) در روش ساخت با ماده‌ی بازیابی‌شده‌ی
 * PE-05 به‌عنوان خروجی، نرخ و تلفات همین عملیات در برابر استاندارد ماده، انبار و الگوی سند
 * رسید و بازگشت به همان دستور یا انبار عمومی، و محل اجرا. بدون پنل کناری (همه‌ی روش‌ها).
 *
 * فاز اول: F-ME-036، 037، 038.
 */
@Component({
  selector: 'gng-frm-me-05',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-me-05.component.html',
})
export class FrmMe05Component implements OnInit {
  data: Me05Bundle | null = null;
  issues: Issue[] = [];
  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private me05: FrmMe05Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.me05.load(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.issues = this.validate(b);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-ME-05] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  private validate(b: Me05Bundle): Issue[] {
    const out: Issue[] = [];
    for (const r of b.recoveries) {
      if (r.standardPercent !== null && Math.abs(r.percent - r.standardPercent) > 2)
        out.push({ severity: 'warning', text: `${r.recoveredCode} در ${r.routing}: نرخ عملیات ${faNum(r.percent)}٪ با نرخ استاندارد ماده (${faNum(r.standardPercent)}٪، FRM-PE-05) فاصله دارد` });
      if (r.returnModeCode === 1 && r.requiresQc)
        out.push({ severity: 'warning', text: `${r.recoveredCode} مستقیم به همان دستور برمی‌گردد ولی تأیید QC لازم دارد — بازگشت باید پس از آزادسازی باشد` });
      if (r.locationCode === 3 && !r.contractor) out.push({ severity: 'danger', text: `${r.recoveredCode} برون‌سپاری است ولی پیمانکار ندارد` });
      if (r.expectedOutput !== null && r.output !== null && Math.abs(r.expectedOutput - r.output) > 0.01)
        out.push({ severity: 'danger', text: `${r.recoveredCode}: خروجی ثبت‌شده (${faNum(r.output)}) با ورودی × نرخ (${faNum(r.expectedOutput)}) نمی‌خواند` });
      if (r.output === null) out.push({ severity: 'danger', text: `${r.operation} خروجی ماده‌ی بازیابی‌شده (نوع بازیافتی، FRM-ME-04) ندارد` });
      if (!r.receiptInventory) out.push({ severity: 'warning', text: `${r.recoveredCode} انبار رسید ندارد` });
    }
    for (const c of b.coverage.filter((x) => x.isActive && !x.operationCount))
      out.push({ severity: 'warning', text: `ماده‌ی بازیابی‌شده‌ی ${c.code} (${c.product}) در هیچ روش ساختی عملیات بازیابی ندارد` });
    return out.sort((a, c) => (a.severity === c.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.severity === 'danger')) return 'danger';
    return this.issues.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_me05_setup.sql را بررسی کنید.';
    if (this.loading || !this.data) return 'در حال خواندن…';
    if (this.issues.length) return this.issues.map((i) => i.text).join('؛ ') + '.';
    return `${this.fa(this.data.recoveries.length)} عملیات بازیابی سازگار با مواد بازیابی‌شده‌ی FRM-PE-05.`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  num(n: number | null, d = 3): string {
    return faNum(n, d);
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
