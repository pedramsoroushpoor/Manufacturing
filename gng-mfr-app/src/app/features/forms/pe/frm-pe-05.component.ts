import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { FormulaRow, RecoveredRow, RecoveryOutputRow } from './frm-pe-05.data';
import { FrmPe05Service } from './frm-pe-05.service';

/**
 * FRM-PE-05 — «بازیابی مواد در فرایند».
 *
 * جریان استاندارد فرمول، متمایز از بازیافت ضایعات: ماده‌ی بازیابی‌شده (قلم مستقل یا
 * گرید)، نرخ و تلفات بازیابی، درصد مجاز در هر ردیف فرمول، نسبت جایگزینی با ماده‌ی
 * نو، حداقل خلوص و سقف چرخه، اولویت مصرف، و خروجی صریح ساختار.
 *
 * فاز اول: F-PE-041 تا 048، 050. بازیابی متقاطع (049) و ارزش‌گذاری (051) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-pe-05',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-pe-05.component.html',
})
export class FrmPe05Component implements OnInit {
  policy = '';
  policyNote = '';
  materials: RecoveredRow[] = [];
  formulaRows: FormulaRow[] = [];
  outputs: RecoveryOutputRow[] = [];

  readonly companyId = DEMO_COMPANY_ID;
  loading = true;
  loadFailed = false;

  constructor(private pe05: FrmPe05Service) {}

  ngOnInit(): void {
    this.pe05.load(this.companyId).subscribe({
      next: (b) => {
        this.policy = b.policy;
        this.policyNote = b.policyNote;
        this.materials = b.materials;
        this.formulaRows = b.formulaRows;
        this.outputs = b.outputs;
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-PE-05] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  private get issues(): string[] {
    return this.formulaRows
      .filter((f) => f.maxUse !== null && f.maxUse > 0 && !f.hasMaterial)
      .map((f) => `${f.structure} ${f.item}: مصرف ${this.fa(f.maxUse!)}٪ بازیابی‌شده مجاز است ولی ماده‌ی بازیابی‌شده‌ای برایش تعریف نشده`);
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.loading) return 'info';
    return this.issues.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pe05_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن…';
    const i = this.issues;
    if (i.length) return i.join('؛ ') + '.';
    return `${this.fa(this.materials.length)} ماده‌ی بازیابی‌شده؛ همه‌ی ردیف‌های مجاز ماده‌ی بازیابی‌شده‌ی تعریف‌شده دارند.`;
  }

  get contextLabel(): string {
    return `سیاست شرکت: ${this.policy}`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
