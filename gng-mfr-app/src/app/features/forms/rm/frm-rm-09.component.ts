import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { ActivityRow, AllocationGroup, CapacityTypeRow, CostChainRow, DriverRow } from './frm-rm-09.data';
import { FrmRm09Service } from './frm-rm-09.service';
import { DEMO_COMPANY_ID } from './rm-scope';

/**
 * FRM-RM-09 — «مبانی هزینه‌یابی و ABC».
 *
 * مدل داده‌ی ABC در سمت تولید: فعالیت (با عملیات و منابع و مراکز هزینه‌اش)،
 * محرک هزینه بر پایه‌ی انواع کارکرد FRM-RM-06، کارکردهای مجاز به‌عنوان محرک، و
 * تسهیم منبع مشترک بین مراکز هزینه. منطق محاسبه در سیستم بهای تمام‌شده است.
 *
 * استثنای فاز اول به درخواست کاربر (همه‌ی فیچرها «مهم، فاز ۳»اند). گردآوری
 * خودکار محرک و ارسال به CO (F-RM-063) فقط پیکربندی‌اش نمایش داده می‌شود.
 */
@Component({
  selector: 'gng-frm-rm-09',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-rm-09.component.html',
})
export class FrmRm09Component implements OnInit {
  activities: ActivityRow[] = [];
  drivers: DriverRow[] = [];
  capacityTypes: CapacityTypeRow[] = [];
  chain: CostChainRow[] = [];
  allocations: AllocationGroup[] = [];

  readonly companyId = DEMO_COMPANY_ID;
  loading = true;
  loadFailed = false;

  constructor(private rm09: FrmRm09Service) {}

  ngOnInit(): void {
    this.rm09.load(this.companyId).subscribe({
      next: (b) => {
        this.activities = b.activities;
        this.drivers = b.drivers;
        this.capacityTypes = b.capacityTypes;
        this.chain = b.chain;
        this.allocations = b.allocations;
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-RM-09] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  private get issues(): { tone: 'danger' | 'warning'; text: string }[] {
    const out: { tone: 'danger' | 'warning'; text: string }[] = [];
    for (const g of this.allocations.filter((x) => !x.ok)) {
      out.push({ tone: 'danger', text: `جمع ضرایب تسهیم «${g.resource}» ${this.fa(g.total ?? 0)}٪ است، نه ۱۰۰٪` });
    }
    for (const d of this.drivers.filter((x) => !x.typeAllowed)) {
      out.push({ tone: 'warning', text: `محرک ${d.code} بر پایه‌ی «${d.type}» است که به‌عنوان محرک هزینه مجاز نیست` });
    }
    for (const a of this.activities.filter((x) => x.active && !x.driverCount)) {
      out.push({ tone: 'warning', text: `فعالیت «${a.title}» محرک هزینه ندارد و هزینه‌اش جذب نمی‌شود` });
    }
    return out;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.loading) return 'info';
    const i = this.issues;
    if (i.some((x) => x.tone === 'danger')) return 'danger';
    if (i.length) return 'warning';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) {
      return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_rm09_setup.sql را بررسی کنید.';
    }
    if (this.loading) return 'در حال خواندن…';
    const i = this.issues;
    if (i.length) return i.map((x) => x.text).join('؛ ') + '.';
    return `${this.fa(this.activities.length)} فعالیت و ${this.fa(this.drivers.length)} محرک؛ جمع ضرایب تسهیم هر منبع ۱۰۰٪ است.`;
  }

  get contextLabel(): string {
    return `فعالیت‌ها: ${this.fa(this.activities.length)} · محرک‌ها: ${this.fa(this.drivers.length)}`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
