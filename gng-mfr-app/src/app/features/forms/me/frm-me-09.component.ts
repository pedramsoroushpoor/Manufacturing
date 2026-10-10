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
import { Issue, Me09Bundle } from './frm-me-09.data';
import { FrmMe09Service } from './frm-me-09.service';

/**
 * FRM-ME-09 — «تولید پیوسته و کمپین».
 *
 * روش ساخت پیوسته با مبنای نرخ (مقدار در واحد زمان)، الگوی دستور شیفتی روی نسخه‌ی تولید
 * شیفتی (مقدار برنامه‌ی هر شیفت در برابر ظرفیت نظری = نرخ × زمان خالص) و انتقال شیفت (موجودی
 * در جریان پایان شیفت ورودی شیفت بعد).
 *
 * فاز اول: F-ME-068، 069، 072. کمپین (070) و موازنه‌ی جرم (071) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-me-09',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-me-09.component.html',
})
export class FrmMe09Component implements OnInit {
  data: Me09Bundle | null = null;
  issues: Issue[] = [];
  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private me09: FrmMe09Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.me09.load(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.issues = this.validate(b);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-ME-09] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  private validate(b: Me09Bundle): Issue[] {
    const out: Issue[] = [];
    for (const r of b.routings) {
      if (r.rate === null) out.push({ severity: 'danger', text: `${r.routing} پیوسته است ولی نرخ تولید ندارد` });
      if (!r.versions) out.push({ severity: 'warning', text: `${r.routing} نسخه‌ی تولیدی ندارد (FRM-ME-08)` });
    }
    for (const t of b.templates) {
      if (t.planned > t.capacity + 0.0001)
        out.push({ severity: 'danger', text: `${t.shift}: برنامه‌ی ${faNum(t.planned)} از ظرفیت نظری شیفت (${faNum(t.capacity)}) بیشتر است` });
      if (t.netRunMinutes !== null && t.netRunMinutes > t.shiftMinutes) out.push({ severity: 'danger', text: `${t.shift}: زمان خالص اجرا از طول شیفت بیشتر است` });
      if (t.orderBasisCode !== 2) out.push({ severity: 'warning', text: `${t.version} الگوی شیفتی دارد ولی مبنای دستورش مقدار است` });
    }
    for (const h of b.handovers.filter((x) => x.modeCode === null))
      out.push({ severity: 'warning', text: `${h.routing} / ${this.fa(h.sequence)} «${h.operation}» قاعده‌ی انتقال شیفت ندارد` });
    return out.sort((a, c) => (a.severity === c.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }

  // ───────── نمایش ─────────

  hhmm(min: number): string {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
  }

  utilization(planned: number, capacity: number): number {
    return capacity ? (planned / capacity) * 100 : 0;
  }

  get dayTotal(): number {
    return this.data?.templates.reduce((s, t) => s + t.planned, 0) ?? 0;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.severity === 'danger')) return 'danger';
    return this.issues.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_me09_setup.sql را بررسی کنید.';
    if (this.loading || !this.data) return 'در حال خواندن…';
    if (this.issues.length) return this.issues.map((i) => i.text).join('؛ ') + '.';
    return 'روش‌های پیوسته، الگوهای شیفتی و قواعد انتقال شیفت سازگارند.';
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
