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
import {
  AttributeDefRow,
  DimensionRow,
  ItemAttributeRow,
  ItemDimensionRow,
  ItemIssue,
  ItemRow,
  LotSizeRow,
  PolicyRow,
  ROLE_ICON,
  ROLE_LABEL,
  VariantRow,
} from './frm-pe-01.data';
import { FrmPe01Service } from './frm-pe-01.service';

/** گره‌ی پنل کناری: null یعنی «همه‌ی کالاها». */
type ItemPick = { id: number | null };

/**
 * FRM-PE-01 — «ویژگی‌های تولیدی قلم».
 *
 * افزوده بر کاتالوگ کالای انبار، نه بازتعریف کالا: نقش تولیدی، سیاست تأمین
 * چندگانه، سطح ردیابی، ویژگی‌های تولیدی قابل‌گسترش، فانتوم، اقلام ابعادی با
 * ترکیب‌های ساخته‌شده، و اندازه‌ی بچ به‌ازای قلم و خط. پنل کناری کاتالوگ کالا
 * به تفکیک نقش تولیدی است؛ با انتخاب یک کالا همه‌ی تب‌ها به آن محدود می‌شوند.
 *
 * فاز اول: F-PE-001 تا 006 و 008. قلم پیکربندی‌پذیر (007) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-pe-01',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TabViewModule,
    TableModule,
    TagModule,
    TreeModule,
    OperationalFormLayoutComponent,
    DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pe-01.component.html',
})
export class FrmPe01Component implements OnInit, OnDestroy {
  pickTree: TreeNode<ItemPick>[] = [];
  selectedPick: TreeNode<ItemPick> | null = null;
  productId: number | null = null;

  items: ItemRow[] = [];
  policies: PolicyRow[] = [];
  attributeDefs: AttributeDefRow[] = [];
  itemAttributes: ItemAttributeRow[] = [];
  dimensions: DimensionRow[] = [];
  itemDimensions: ItemDimensionRow[] = [];
  variants: VariantRow[] = [];
  lotSizes: LotSizeRow[] = [];
  issues: ItemIssue[] = [];

  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  private readonly load$ = new Subject<void>();
  private readonly sub = new Subscription();

  constructor(private pe01: FrmPe01Service) {}

  ngOnInit(): void {
    this.sub.add(
      this.load$
        .pipe(
          tap(() => (this.loading = true)),
          switchMap(() =>
            this.pe01.load(this.productId, this.companyId).pipe(
              catchError((err) => {
                console.warn('[FRM-PE-01] خواندن داده ناموفق بود:', err?.message || err);
                this.loading = false;
                this.loadFailed = true;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((b) => {
          this.items = b.items;
          this.policies = b.policies;
          this.attributeDefs = b.attributeDefs;
          this.itemAttributes = b.itemAttributes;
          this.dimensions = b.dimensions;
          this.itemDimensions = b.itemDimensions;
          this.variants = b.variants;
          this.lotSizes = b.lotSizes;
          this.issues = b.issues;
          if (!this.pickTree.length) this.buildPickTree();
          this.loadFailed = false;
          this.loading = false;
        })
    );
    this.load$.next();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** کاتالوگ به تفکیک نقش تولیدی؛ کالاهای بدون نقش در گروه آخر. */
  private buildPickTree(): void {
    const groups = new Map<number, TreeNode<ItemPick>>();
    for (const i of this.items) {
      const role = i.roleCode ?? 0;
      if (!groups.has(role)) {
        groups.set(role, {
          key: `role-${role}`,
          label: role ? ROLE_LABEL[role] : 'بدون نقش تولیدی',
          icon: role ? ROLE_ICON[role] : 'pi pi-question-circle',
          selectable: false,
          expanded: role !== 0,
          children: [],
        });
      }
      groups.get(role)!.children!.push({
        key: `p-${i.productId}`,
        label: `${i.code} — ${i.title}`,
        icon: i.isPhantom ? 'pi pi-eye-slash' : i.isDimensional ? 'pi pi-th-large' : 'pi pi-circle',
        data: { id: i.productId },
      });
    }
    const root: TreeNode<ItemPick> = {
      key: 'all',
      label: 'همه‌ی کالاها',
      icon: 'pi pi-list',
      expanded: true,
      data: { id: null },
      children: [...groups.values()],
    };
    this.pickTree = [root];
    this.selectedPick = root;
  }

  // ---- انتخاب کالا ----

  onPick(event: { node: TreeNode<ItemPick> }): void {
    if (!event.node?.data) return;
    this.productId = event.node.data.id;
    this.load$.next();
  }

  /** کلیک دوباره روی گره‌ی انتخاب‌شده نباید فرم را بدون انتخاب بگذارد. */
  onUnpick(event: { node: TreeNode<ItemPick> }): void {
    setTimeout(() => (this.selectedPick = event.node));
  }

  // ---- متن‌ها و کمک‌تابع‌های قالب ----

  get selected(): ItemRow | null {
    return this.productId === null ? null : this.items.find((i) => i.productId === this.productId) ?? null;
  }

  get contextLabel(): string {
    return this.selected ? `${this.selected.code} — ${this.selected.title}` : 'همه‌ی کالاها';
  }

  get visibleItems(): ItemRow[] {
    return this.selected ? [this.selected] : this.items;
  }

  get phantoms(): ItemRow[] {
    return this.visibleItems.filter((i) => i.isPhantom);
  }

  get withoutRole(): ItemRow[] {
    return this.items.filter((i) => !i.hasRole);
  }

  get withoutRoleText(): string {
    return this.withoutRole.map((i) => `${i.code} ${i.title}`).join('، ');
  }

  issuesOf(productId: number): ItemIssue[] {
    return this.issues.filter((i) => i.productId === productId);
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (!this.items.length) return 'info';
    if (this.selected && !this.selected.hasRole) return 'info';
    if (this.issues.some((i) => i.tone === 'danger')) return 'danger';
    if (this.issues.length) return 'warning';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) {
      return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pe01_setup.sql را بررسی کنید.';
    }
    if (!this.items.length) return 'کاتالوگ کالا خالی است.';
    if (this.selected && !this.selected.hasRole) {
      return `«${this.selected.title}» در کاتالوگ انبار هست ولی هنوز نقش تولیدی ندارد؛ تا نقش تولیدی نگیرد در ساختار و دستور تولید استفاده نمی‌شود.`;
    }
    if (this.issues.length) {
      const ordered = [...this.issues.filter((i) => i.tone === 'danger'), ...this.issues.filter((i) => i.tone === 'warning')];
      return ordered.map((i) => i.text).join('؛ ') + '.';
    }
    if (this.selected) return `«${this.selected.title}»: ویژگی‌های تولیدی سازگارند.`;
    const roles = this.items.filter((i) => i.hasRole).length;
    return `${this.fa(roles)} کالا نقش تولیدی دارند و ناسازگاری‌ای دیده نشد.`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  roleSeverity(code: number | null): 'success' | 'info' | 'warning' | 'secondary' {
    if (code === 1) return 'success';
    if (code === 2) return 'info';
    if (code === null) return 'warning';
    return 'secondary';
  }

  // ---- منبع داده‌ی زنده‌ی هر گرید (دکمه‌ی سه‌نقطه‌ی گوشه) ----

  source(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
