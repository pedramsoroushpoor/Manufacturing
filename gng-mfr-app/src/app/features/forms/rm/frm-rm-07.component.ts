import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EMPTY, Subject, Subscription, catchError, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { TreeTableModule } from 'primeng/treetable';
import { TreeNode } from 'primeng/api';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  OeeLossRow,
  OeeStatus,
  ReasonCategory,
  ReasonNodeRow,
  ReasonRef,
  RuleRow,
  StationAllowedRow,
} from './frm-rm-07.data';
import { FrmRm07Bundle, FrmRm07Service } from './frm-rm-07.service';
import { DEMO_COMPANY_ID, RmScopeService, RmSelection } from './rm-scope';

const EMPTY_TREES: FrmRm07Bundle['trees'] = { 1: [], 2: [], 3: [], 4: [] };

/**
 * FRM-RM-07 — «طبقه‌بندی علل».
 *
 * یک فرم درختی با تب برای هر دسته (توقف، ضایعات، دوباره‌کاری و انحراف)، نگاشت
 * علل به شش زیان بزرگ OEE، و محدودسازی فهرست علل مجاز به‌ازای خط، ایستگاه یا
 * نوع تجهیز. درخت علل بین همه‌ی منابع مشترک است؛ درخت سازمانی سمت راست فقط
 * قواعد و فهرست مجاز را محدود می‌کند و با انتخاب یک ایستگاه، مجاز بودن هر علت
 * در همه‌ی تب‌ها علامت می‌خورد.
 *
 * فاز اول: F-RM-047 تا 051، 053. ارتباط علت با اقدام اصلاحی (052) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-rm-07',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TabViewModule,
    TableModule,
    TagModule,
    TreeModule,
    TreeTableModule,
    OperationalFormLayoutComponent,
    DataSourceBadgeComponent,
  ],
  templateUrl: './frm-rm-07.component.html',
})
export class FrmRm07Component implements OnInit, OnDestroy {
  orgTree: TreeNode<RmSelection>[] = [];
  trees: FrmRm07Bundle['trees'] = EMPTY_TREES;
  leafTotals: Record<ReasonCategory, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  losses: OeeLossRow[] = [];
  excluded: ReasonRef[] = [];
  unmapped: ReasonRef[] = [];
  rules: RuleRow[] = [];
  stations: StationAllowedRow[] = [];

  selectedTreeNode: TreeNode<RmSelection> | null = null;
  selection: RmSelection | null = null;

  readonly companyId = DEMO_COMPANY_ID;
  readonly categories = CATEGORIES;
  scopeLoading = false;
  loadFailed = false;

  private readonly load$ = new Subject<void>();
  private readonly sub = new Subscription();

  constructor(
    private scope: RmScopeService,
    private rm07: FrmRm07Service
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.load$
        .pipe(
          tap(() => (this.scopeLoading = true)),
          switchMap(() =>
            this.rm07.loadScope(this.selection!).pipe(
              catchError((err) => {
                console.warn('[FRM-RM-07] خواندن داده ناموفق بود:', err?.message || err);
                this.scopeLoading = false;
                this.loadFailed = true;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((b) => {
          this.trees = b.trees;
          this.leafTotals = b.leafTotals;
          this.losses = b.losses;
          this.excluded = b.excluded;
          this.unmapped = b.unmapped;
          this.rules = b.rules;
          this.stations = b.stations;
          this.loadFailed = false;
          this.scopeLoading = false;
        })
    );

    this.scope.loadFullTree(this.companyId).subscribe({
      next: (tree) => {
        if (!tree.length) return;
        this.orgTree = tree;
        this.selectedTreeNode = tree[0];
        this.select(tree[0].data!);
      },
      error: (err) => {
        console.warn('[FRM-RM-07] خواندن درخت سازمانی ناموفق بود:', err?.message || err);
        this.loadFailed = true;
      },
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ---- انتخاب در درخت ----

  onTreeSelect(event: { node: TreeNode<RmSelection> }): void {
    if (!event.node?.data) return;
    this.select(event.node.data);
  }

  /** کلیک دوباره روی گره‌ی انتخاب‌شده نباید فرم را بدون دامنه بگذارد. */
  onTreeUnselect(event: { node: TreeNode<RmSelection> }): void {
    setTimeout(() => (this.selectedTreeNode = event.node));
  }

  private select(sel: RmSelection): void {
    this.selection = sel;
    this.load$.next();
  }

  // ---- متن‌ها و کمک‌تابع‌های قالب ----

  get contextLabel(): string {
    return this.selection?.title ?? 'بدون انتخاب';
  }

  get isStationScope(): boolean {
    return this.selection?.kind === 'station';
  }

  /** ردیف ایستگاه انتخاب‌شده در جدول فهرست مجاز. */
  get selectedStation(): StationAllowedRow | null {
    const sel = this.selection;
    return sel?.kind === 'station' ? this.stations.find((s) => s.stationId === sel.id) ?? null : null;
  }

  get totalReasons(): number {
    return CATEGORIES.reduce((s, c) => s + this.leafTotals[c], 0);
  }

  /** بنر: اول علت نگاشت‌نشده، بعد (با انتخاب ایستگاه) خلاصه‌ی فهرست مجاز، بعد خلاصه‌ی کل. */
  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (!this.totalReasons) return 'info';
    if (this.unmapped.length) return 'warning';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) {
      return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_rm07_setup.sql را بررسی کنید.';
    }
    if (!this.totalReasons) return 'هنوز علتی تعریف نشده است.';
    const parts: string[] = [];
    if (this.unmapped.length) {
      parts.push(
        `${this.fa(this.unmapped.length)} علت به هیچ‌یک از شش زیان OEE نگاشت نشده و در تحلیل OEE گم می‌شود: ` +
          this.unmapped.map((u) => `${u.code} ${u.title}`).join('؛ ') +
          '.'
      );
    } else {
      parts.push(
        `${this.fa(this.totalReasons)} علت فعال در چهار دسته؛ همه‌ی علل توقف و ضایعات محصول به شش زیان OEE نگاشت شده‌اند.`
      );
    }
    const st = this.selectedStation;
    if (st) {
      const stop = st.cells[0];
      parts.push(`در این ایستگاه ${this.fa(stop.allowed)} از ${this.fa(stop.total)} علت توقف مجاز است (${stop.level}).`);
    }
    return parts.join(' ');
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  treeOf(c: ReasonCategory): TreeNode<ReasonNodeRow>[] {
    return this.trees[c];
  }

  categoryLabel(c: ReasonCategory): string {
    return CATEGORY_LABEL[c];
  }

  oeeSeverity(status: OeeStatus): 'success' | 'secondary' | 'danger' | 'info' {
    if (status === 'mapped') return 'info';
    if (status === 'excluded') return 'secondary';
    if (status === 'unmapped') return 'danger';
    return 'secondary';
  }

  /** متن ستون «مجاز در این ایستگاه». */
  allowedText(d: ReasonNodeRow): string {
    if (d.allowedCount === null) return '';
    if (!d.isGroup) return d.allowedCount ? 'مجاز' : 'غیرمجاز';
    return `${this.fa(d.allowedCount)} از ${this.fa(d.leafCount)}`;
  }

  allowedClass(d: ReasonNodeRow): string {
    if (d.allowedCount === null || !d.active) return '';
    if (d.allowedCount === 0) return 'gng-sym--no';
    if (d.allowedCount === d.leafCount) return 'gng-sym--ok';
    return 'gng-sym--warn';
  }

  levelSeverity(levelCode: string): 'info' | 'warning' | 'success' | 'secondary' {
    if (levelCode === 'station') return 'warning';
    if (levelCode === 'equipment-type') return 'info';
    if (levelCode === 'line') return 'success';
    return 'secondary';
  }

  // ---- منبع داده‌ی زنده‌ی هر گرید (دکمه‌ی سه‌نقطه‌ی گوشه) ----

  treeSource(c: ReasonCategory): DataSourceInfo {
    const key = c === 1 ? 'rm07-stoppage' : c === 2 ? 'rm07-waste' : c === 3 ? 'rm07-rework' : 'rm07-deviation';
    return { key, label: `درخت علل ${CATEGORY_LABEL[c]}`, filterVal: this.companyId };
  }
  oeeSource(): DataSourceInfo {
    return { key: 'rm07-oee', label: 'نگاشت شش زیان OEE', filterVal: this.companyId };
  }
  restrictionsSource(): DataSourceInfo {
    return { key: 'rm07-restrictions', label: 'قواعد محدودسازی', filterVal: this.companyId };
  }
  allowedSource(): DataSourceInfo {
    return { key: 'rm07-allowed', label: 'علل مجاز هر ایستگاه', filterVal: this.companyId };
  }
  orgTreeSource(): DataSourceInfo {
    return { key: 'rm01-org-tree', label: 'درخت سازمانی', filterVal: this.companyId };
  }
}
