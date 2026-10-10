import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EMPTY, Subject, Subscription, catchError, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { DerivedMatrix, MatrixItem, MatrixStructure } from './frm-pe-06.data';
import { FrmPe06Service } from './frm-pe-06.service';

/**
 * FRM-PE-06 — «ساختار ماتریسی و اقلام ابعادی».
 *
 * ساختار در سطح مدل پایه تعریف می‌شود؛ هر ردیف یا به یک بُعد وابسته است (جدول
 * مصرف ابعادی) یا مستقل از ابعاد. ساختار هر ترکیب (از FRM-PE-01) خودکار مشتق و
 * به‌صورت ماتریس «ترکیب × ردیف» نمایش داده می‌شود. پنل کناری فهرست مدل‌های پایه است.
 *
 * فاز اول: F-PE-052، 053، 055؛ 056 فقط خروجی ماتریس. مارکر برش (054) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-pe-06',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-pe-06.component.html',
})
export class FrmPe06Component implements OnInit, OnDestroy {
  structures: MatrixStructure[] = [];
  items: MatrixItem[] = [];
  derived: DerivedMatrix = { items: [], variants: [] };
  structureId: number | null = null;
  pickTree: TreeNode<{ id: number }>[] = [];
  selectedPick: TreeNode<{ id: number }> | null = null;

  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;
  private firstLoad = true;

  private readonly load$ = new Subject<void>();
  private readonly sub = new Subscription();

  constructor(private pe06: FrmPe06Service) {}

  ngOnInit(): void {
    this.sub.add(
      this.load$
        .pipe(
          tap(() => (this.loading = true)),
          switchMap(() =>
            this.pe06.load(this.structureId, this.companyId).pipe(
              catchError((err) => {
                console.warn('[FRM-PE-06] خواندن داده ناموفق بود:', err?.message || err);
                this.loading = false;
                this.loadFailed = true;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((b) => {
          this.structures = b.structures;
          this.items = b.items;
          this.derived = b.derived;
          this.structureId = b.structureId;
          if (!this.pickTree.length) {
            /* بار اول: مدل پایه‌ای با بیشترین ترکیب پیش‌فرض است (کپسول ۳×۳ به‌جای کارتن ۲×۲) */
            const richest = [...b.structures].sort((x, y) => y.variantCount - x.variantCount)[0];
            if (this.firstLoad && richest && richest.id !== b.structureId) {
              this.firstLoad = false;
              this.structureId = richest.id;
              this.load$.next();
              return;
            }
            this.pickTree = b.structures.map((s) => ({ key: `s-${s.id}`, label: `${s.code} — ${s.title}`, icon: 'pi pi-th-large', data: { id: s.id } }));
            this.selectedPick = this.pickTree.find((n) => n.data?.id === b.structureId) ?? null;
          }
          this.loading = false;
          this.loadFailed = false;
        })
    );
    this.load$.next();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onPick(event: { node: TreeNode<{ id: number }> }): void {
    if (!event.node?.data) return;
    this.structureId = event.node.data.id;
    this.load$.next();
  }

  onUnpick(event: { node: TreeNode<{ id: number }> }): void {
    setTimeout(() => (this.selectedPick = event.node));
  }

  get selected(): MatrixStructure | null {
    return this.structures.find((s) => s.id === this.structureId) ?? null;
  }

  get dependent(): MatrixItem[] {
    return this.items.filter((i) => i.dimension);
  }

  get independent(): MatrixItem[] {
    return this.items.filter((i) => !i.dimension);
  }

  get missing(): string[] {
    return this.dependent.flatMap((i) => i.values.filter((v) => v.quantity === null).map((v) => `${i.product.split(' — ')[1]} برای «${v.title}»`));
  }

  exportMatrix(): void {
    if (this.selected) this.pe06.exportMatrix(this.selected.code, this.derived);
  }

  get contextLabel(): string {
    return this.selected ? `${this.selected.code} — ${this.selected.title}` : 'بدون مدل پایه';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (!this.selected) return 'info';
    return this.missing.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pe06_setup.sql را بررسی کنید.';
    if (!this.selected) return 'ساختار مدل پایه‌ای تعریف نشده است؛ محصول اصلی ساختار باید در FRM-PE-01 ابعادی باشد.';
    const incomplete = this.derived.variants.filter((v) => !v.complete).length;
    if (this.missing.length) {
      return `جدول مصرف ابعادی کامل نیست: ${this.missing.join('؛ ')} مقدار ندارد — ساختار ${this.fa(incomplete)} ترکیب ناقص مشتق می‌شود.`;
    }
    return `ساختار هر ${this.fa(this.derived.variants.length)} ترکیب از مدل پایه کامل مشتق می‌شود.`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  q(n: number | null): string {
    return n === null ? '—' : n.toLocaleString('fa-IR', { maximumFractionDigits: 4 });
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
