import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { OutputRow, StructureSummary } from './frm-pe-04.data';
import { FrmPe04Service } from './frm-pe-04.service';

/**
 * FRM-PE-04 — «خروجی‌های ساختار و بازدهی».
 *
 * محصول اصلی، هم‌زاد با سهم‌بری از هزینه، جانبی با ارزش‌گذاری، ضایعات مورد انتظار
 * (قابل بازیافت یا نه) و جدول بازدهی با کنترل موازنه‌ی جرم — همه روی جدول
 * ProductStructureMaster نسخه‌ی قبل. پنل کناری فهرست ساختارهاست.
 *
 * فاز اول: F-PE-034 تا 037، 039. انبار پیش‌فرض (040) به نسخه‌ی تولید (FRM-ME-08) وابسته است.
 */
@Component({
  selector: 'gng-frm-pe-04',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-pe-04.component.html',
})
export class FrmPe04Component implements OnInit {
  structures: StructureSummary[] = [];
  outputs: OutputRow[] = [];
  pickTree: TreeNode<{ id: number | null }>[] = [];
  selectedPick: TreeNode<{ id: number | null }> | null = null;
  structureId: number | null = null;

  readonly companyId = DEMO_COMPANY_ID;
  loading = true;
  loadFailed = false;

  constructor(private pe04: FrmPe04Service) {}

  ngOnInit(): void {
    this.pe04.load(this.companyId).subscribe({
      next: (b) => {
        this.structures = b.structures;
        this.outputs = b.outputs;
        const root: TreeNode<{ id: number | null }> = {
          key: 'all',
          label: 'همه‌ی ساختارها',
          icon: 'pi pi-sitemap',
          expanded: true,
          data: { id: null },
          children: b.structures.map((s) => ({ key: `s-${s.id}`, label: `${s.code} — ${s.title}`, icon: 'pi pi-circle', data: { id: s.id } })),
        };
        this.pickTree = [root];
        this.selectedPick = root;
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-PE-04] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  onPick(event: { node: TreeNode<{ id: number | null }> }): void {
    if (event.node?.data) this.structureId = event.node.data.id;
  }

  onUnpick(event: { node: TreeNode<{ id: number | null }> }): void {
    setTimeout(() => (this.selectedPick = event.node));
  }

  get selected(): StructureSummary | null {
    return this.structureId === null ? null : this.structures.find((s) => s.id === this.structureId) ?? null;
  }

  private get scoped(): OutputRow[] {
    return this.structureId === null ? this.outputs : this.outputs.filter((o) => o.structureId === this.structureId);
  }

  rows(...types: number[]): OutputRow[] {
    return this.scoped.filter((o) => types.includes(o.typeCode));
  }

  get yieldRows(): OutputRow[] {
    return this.scoped.filter((o) => o.yieldPercent !== null);
  }

  yieldOf(structureId: number): OutputRow[] {
    return this.outputs.filter((o) => o.structureId === structureId && o.yieldPercent !== null);
  }

  get scopedStructures(): StructureSummary[] {
    return this.selected ? [this.selected] : this.structures;
  }

  codeOf(structureId: number): string {
    return this.structures.find((s) => s.id === structureId)?.code ?? '';
  }

  get contextLabel(): string {
    return this.selected ? `${this.selected.code} — ${this.selected.title}` : 'همه‌ی ساختارها';
  }

  private get issues(): { tone: 'danger' | 'warning'; text: string }[] {
    const out: { tone: 'danger' | 'warning'; text: string }[] = [];
    for (const s of this.scopedStructures.filter((x) => !x.massOk)) {
      out.push({ tone: 'danger', text: `موازنه‌ی جرم ${s.code} برقرار نیست: جمع بازدهی خروجی‌ها ${this.fa(s.yieldTotal ?? 0)}٪` });
    }
    for (const s of this.scopedStructures.filter((x) => !x.costOk)) {
      out.push({ tone: 'warning', text: `جمع سهم‌بری محصول اصلی و هم‌زادهای ${s.code} ${this.fa(s.costTotal ?? 0)}٪ است` });
    }
    return out;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const i = this.issues;
    if (i.some((x) => x.tone === 'danger')) return 'danger';
    if (i.length) return 'warning';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pe04_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن…';
    const i = this.issues;
    if (i.length) return i.map((x) => x.text).join('؛ ') + '.';
    const withYield = this.scopedStructures.filter((s) => s.hasYieldTable).length;
    return withYield
      ? `موازنه‌ی جرم ${this.fa(withYield)} ساختارِ دارای جدول بازدهی برقرار است و سهم‌بری‌ها ۱۰۰٪ است.`
      : 'برای این ساختار جدول بازدهی ثبت نشده؛ سهم‌بری محصول اصلی ۱۰۰٪ است.';
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  ds(): DataSourceInfo {
    return { key: 'pe04-outputs', label: 'خروجی‌های ساختار', filterVal: this.companyId };
  }
}
