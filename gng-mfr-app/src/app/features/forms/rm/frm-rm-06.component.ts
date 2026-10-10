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
import {
  AvailabilityRow,
  CapacityRow,
  CapacityTypeRow,
  HistoryRow,
  LoadGrid,
  LoadRow,
  LoadSeverity,
  ProductRateRow,
  VERSION_LABEL,
  VersionStatus,
} from './frm-rm-06.data';
import { FrmRm06Service, LOAD_WARN_PERCENT } from './frm-rm-06.service';
import { DEMO_COMPANY_ID, RmScopeService, RmSelection } from './rm-scope';

const WINDOW_DAYS = 14;

/**
 * FRM-RM-06 — «کارکرد استاندارد و ظرفیت».
 *
 * انواع کارکرد پویا (به‌جای ماشین‌ساعت/نفرساعتِ ثابت نسخه‌ی قبل)، ظرفیت هر نوع
 * به‌ازای ایستگاه یا گروه منبع با اعتبار زمانی، در دسترس‌بودن، نرخ وابسته به
 * محصول، نمای بار در برابر ظرفیت روی تقویم مؤثر FRM-RM-05، و سابقه‌ی تغییرات.
 * درخت سمت راست دامنه را تعیین می‌کند؛ پنجره‌ی زمانی ۱۴روزه و قابل جابه‌جایی است.
 *
 * فاز اول: F-RM-038 تا 042، 044، 046. محدودیت متقابل منابع (043) و بازخورد
 * واقعی به استاندارد (045) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-rm-06',
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
  templateUrl: './frm-rm-06.component.html',
})
export class FrmRm06Component implements OnInit, OnDestroy {
  orgTree: TreeNode<RmSelection>[] = [];
  types: CapacityTypeRow[] = [];
  capacities: CapacityRow[] = [];
  availability: AvailabilityRow[] = [];
  productRates: ProductRateRow[] = [];
  load: LoadGrid = { days: [], rows: [] };
  history: HistoryRow[] = [];
  windowText = '';
  showIdle = false;

  selectedTreeNode: TreeNode<RmSelection> | null = null;
  selection: RmSelection | null = null;
  from: string | null = null;
  private today = '';

  readonly companyId = DEMO_COMPANY_ID;
  readonly warnPercent = LOAD_WARN_PERCENT;
  scopeLoading = false;
  loadFailed = false;

  private readonly load$ = new Subject<void>();
  private readonly sub = new Subscription();

  constructor(
    private scope: RmScopeService,
    private rm06: FrmRm06Service
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.load$
        .pipe(
          tap(() => (this.scopeLoading = true)),
          switchMap(() =>
            this.rm06.loadScope(this.selection!, this.from, WINDOW_DAYS).pipe(
              catchError((err) => {
                console.warn('[FRM-RM-06] خواندن داده ناموفق بود:', err?.message || err);
                this.scopeLoading = false;
                this.loadFailed = true;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((b) => {
          this.types = b.types;
          this.capacities = b.capacities;
          this.availability = b.availability;
          this.productRates = b.productRates;
          this.load = b.load;
          this.history = b.history;
          this.windowText = b.windowText;
          this.from = b.from;
          this.today = b.today;
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
        console.warn('[FRM-RM-06] خواندن درخت سازمانی ناموفق بود:', err?.message || err);
        this.loadFailed = true;
      },
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ---- انتخاب در درخت و پنجره‌ی زمانی ----

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

  moveWindow(direction: -1 | 1): void {
    if (!this.selection || !this.from) return;
    this.from = this.rm06.shiftWindow(this.from, direction * WINDOW_DAYS);
    this.load$.next();
  }

  goToday(): void {
    if (!this.selection) return;
    this.from = null;
    this.load$.next();
  }

  get isCurrentWindow(): boolean {
    return !!this.from && this.from === this.today;
  }

  // ---- متن‌ها و کمک‌تابع‌های قالب ----

  get contextLabel(): string {
    return this.selection?.title ?? 'بدون انتخاب';
  }

  get isStationScope(): boolean {
    return this.selection?.kind === 'station';
  }

  /** ردیف‌های بی‌بار پیش‌فرض پنهان‌اند تا گلوگاه‌ها گم نشوند. */
  get visibleLoadRows(): LoadRow[] {
    return this.showIdle ? this.load.rows : this.load.rows.filter((r) => r.hasLoad);
  }

  get idleCount(): number {
    return this.load.rows.filter((r) => !r.hasLoad).length;
  }

  private get overloaded(): LoadRow[] {
    return this.load.rows.filter((r) => r.severity === 'over');
  }

  private get noCapacity(): LoadRow[] {
    return this.load.rows.filter((r) => r.severity === 'nocap');
  }

  private get nearLimit(): LoadRow[] {
    return this.load.rows.filter((r) => r.severity === 'warn');
  }

  /** بنر: اول گلوگاه (بالای ۱۰۰٪)، بعد بارِ بدون ظرفیت، بعد نزدیک سقف، بعد خلاصه. */
  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (!this.load.rows.length) return 'info';
    if (this.overloaded.length) return 'danger';
    if (this.noCapacity.length || this.nearLimit.length) return 'warning';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) {
      return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_rm06_setup.sql را بررسی کنید.';
    }
    if (!this.load.rows.length) return `برای «${this.contextLabel}» ظرفیت یا باری در بازه‌ی ${this.windowText} ثبت نشده است.`;
    const name = (r: LoadRow) => `${r.resource} — ${r.type}`;
    const parts: string[] = [];
    if (this.overloaded.length) {
      parts.push(
        'گلوگاه: ' + this.overloaded.map((r) => `${name(r)} ${r.percent === null ? '' : this.fa(r.percent) + '٪'}`.trim()).join('؛ ') +
          ' — نیازمند شیفت اضافه یا انتقال بار.'
      );
    }
    if (this.noCapacity.length) {
      parts.push('بار بدون ظرفیت تعریف‌شده: ' + this.noCapacity.map(name).join('؛ ') + '.');
    }
    if (!parts.length && this.nearLimit.length) {
      parts.push(`نزدیک سقف (${this.fa(this.warnPercent)}٪ به بالا): ` + this.nearLimit.map((r) => `${name(r)} ${this.fa(r.percent!)}٪`).join('؛ ') + '.');
    }
    if (parts.length) return parts.join(' ');
    const peak = this.load.rows.filter((r) => r.percent !== null).sort((a, b) => b.percent! - a.percent!)[0];
    return peak
      ? `بار همه‌ی منابع در بازه‌ی ${this.windowText} زیر ${this.fa(this.warnPercent)}٪ است؛ بیشترین: ${name(peak)} ${this.fa(peak.percent!)}٪.`
      : `در بازه‌ی ${this.windowText} باری روی منابع «${this.contextLabel}» برنامه‌ریزی نشده است.`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  versionLabel(status: VersionStatus): string {
    return VERSION_LABEL[status];
  }

  loadClass(severity: LoadSeverity): string {
    return `gng-load gng-load--${severity}`;
  }

  barClass(severity: LoadSeverity): string {
    if (severity === 'over') return 'gng-kpi__bar-fill--danger';
    if (severity === 'warn') return 'gng-kpi__bar-fill--warning';
    return '';
  }

  barWidth(percent: number | null): number {
    return percent === null ? 0 : Math.min(percent, 100);
  }

  // ---- منبع داده‌ی زنده‌ی هر گرید (دکمه‌ی سه‌نقطه‌ی گوشه) ----

  typesSource(): DataSourceInfo {
    return { key: 'rm06-types', label: 'انواع کارکرد', filterVal: this.companyId };
  }
  capacitiesSource(): DataSourceInfo {
    return { key: 'rm06-capacities', label: 'ظرفیت منبع', filterVal: this.companyId };
  }
  availabilitySource(): DataSourceInfo {
    return { key: 'rm06-availability', label: 'در دسترس‌بودن', filterVal: this.companyId };
  }
  productRatesSource(): DataSourceInfo {
    return { key: 'rm06-product-rates', label: 'ظرفیت وابسته به محصول', filterVal: this.companyId };
  }
  loadSource(): DataSourceInfo {
    return { key: 'rm06-load', label: 'نمای بار/ظرفیت', filterVal: this.companyId };
  }
  historySource(): DataSourceInfo {
    return { key: 'rm06-history', label: 'سابقه‌ی تغییرات', filterVal: this.companyId };
  }
  orgTreeSource(): DataSourceInfo {
    return { key: 'rm01-org-tree', label: 'درخت سازمانی', filterVal: this.companyId };
  }
}
