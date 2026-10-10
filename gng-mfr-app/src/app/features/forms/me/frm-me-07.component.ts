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
import { Issue, Me07Bundle, OutsourcedOpRow, SubcontractRow, TollRow } from './frm-me-07.data';
import { FrmMe07Service, SETTLEMENT } from './frm-me-07.service';

/**
 * FRM-ME-07 — «برون‌سپاری و کارمزدی».
 *
 * دو جهت در یک فرم: برون‌سپاری عملیات روش (پیمانکاران با اولویت، نرخ، زمان تحویل، ضایعات مجاز،
 * اقلام ارسالی/دریافتی و منبع تأمین، قلم خدمت خرید) با کنترل قابلیت و نرخ FRM-RM-08؛ و
 * کارمزدی دریافتی (مالکیت هر قلم ساختار و تسویه‌ی مازاد/ضایعات مواد امانی مشتری).
 *
 * فاز اول: F-ME-050 تا 058.
 */
@Component({
  selector: 'gng-frm-me-07',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-me-07.component.html',
})
export class FrmMe07Component implements OnInit {
  data: Me07Bundle | null = null;
  issues: Issue[] = [];
  readonly settlement = SETTLEMENT;
  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private me07: FrmMe07Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.me07.load(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.issues = this.validate(b);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-ME-07] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  private validate(b: Me07Bundle): Issue[] {
    const out: Issue[] = [];
    for (const o of b.operations.filter((x) => x.routingStatusCode === 3 && !x.contractorCount))
      out.push({ severity: 'danger', text: `${o.routing} / ${this.fa(o.sequence)} برون‌سپاری است ولی پیمانکاری ندارد` });
    for (const s of b.subcontracts) {
      if (!s.contractorActive) out.push({ severity: 'danger', text: `${s.contractor} (اولویت ${this.fa(s.priority)}) غیرفعال است` });
      else if (s.qualificationCode === 3) out.push({ severity: 'danger', text: `${s.contractor} در تعلیق است` });
      if (s.contractorActive && !s.hasCapability) out.push({ severity: 'danger', text: `${s.contractor} برای «${s.capabilityOperation}» قابلیت تأییدشده در FRM-RM-08 ندارد` });
      if (s.fee !== null && s.registeredFee !== null && Math.abs(s.fee - s.registeredFee) > 0.5)
        out.push({ severity: 'warning', text: `نرخ ${s.contractor} در روش (${faNum(s.fee)}) با نرخ جاری FRM-RM-08 (${faNum(s.registeredFee)}) فرق دارد` });
      if (!s.serviceItem) out.push({ severity: 'warning', text: `${s.contractor} قلم خدمت برای درخواست خرید ندارد` });
    }
    const prio = new Map<number, number[]>();
    for (const s of b.subcontracts) prio.set(s.routingOperationId, [...(prio.get(s.routingOperationId) ?? []), s.priority]);
    for (const [, ps] of prio) if (new Set(ps).size !== ps.length) out.push({ severity: 'warning', text: 'دو پیمانکار یک عملیات اولویت یکسان دارند' });
    for (const t of b.toll.filter((x) => x.ownershipCode === null)) out.push({ severity: 'danger', text: `روش کارمزدی ${t.routing}: مالکیت «${t.product}» تعیین نشده` });
    for (const t of b.toll.filter((x) => x.ownershipCode === 1 && (!x.surplusCode || !x.wasteCode)))
      out.push({ severity: 'warning', text: `«${t.product}» امانی مشتری است ولی نحوه‌ی تسویه‌ی مازاد/ضایعاتش تعیین نشده` });
    return out.sort((a, c) => (a.severity === c.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }

  // ───────── نمایش ─────────

  subsOf(o: OutsourcedOpRow): SubcontractRow[] {
    return this.data?.subcontracts.filter((s) => s.routingOperationId === o.id) ?? [];
  }

  opTitle(id: number): string {
    const o = this.data?.operations.find((x) => x.id === id);
    return o ? `${o.routing} / ${this.fa(o.sequence)}` : '';
  }

  position(o: OutsourcedOpRow): string {
    if (!o.opsBefore && !o.opsAfter) return 'تنها عملیات روش';
    if (!o.opsBefore) return `ابتدای روش؛ ${this.fa(o.opsAfter)} عملیات داخلی پس از آن`;
    if (!o.opsAfter) return `انتهای روش؛ ${this.fa(o.opsBefore)} عملیات داخلی پیش از آن`;
    return `میانه‌ی روش: ${this.fa(o.opsBefore)} پیش و ${this.fa(o.opsAfter)} پس`;
  }

  get customerTollRows(): TollRow[] {
    return this.data?.toll.filter((t) => t.ownershipCode === 1) ?? [];
  }

  get customerItems(): number {
    return this.customerTollRows.length;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.severity === 'danger')) return 'danger';
    return this.issues.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_me07_setup.sql را بررسی کنید.';
    if (this.loading || !this.data) return 'در حال خواندن…';
    if (this.issues.length) return this.issues.map((i) => i.text).join('؛ ') + '.';
    return 'برون‌سپاری و کارمزدی سازگار با پیمانکاران FRM-RM-08 است.';
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
