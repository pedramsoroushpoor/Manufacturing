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
  APPROVAL_LABEL,
  ApprovalStatus,
  BASE_ORIGIN_LABEL,
  BaseOrigin,
  CalendarRuleRow,
  ConflictRow,
  EXCEPTION_LABEL,
  EffectiveGrid,
  ExceptionKind,
  ExceptionRow,
  FreeSlotRow,
  InheritanceRow,
  ShutdownRow,
} from './frm-rm-05.data';
import { FrmRm05Service } from './frm-rm-05.service';
import { DEMO_COMPANY_ID, RmScopeService, RmSelection } from './rm-scope';
import { faHours } from './rm-time';

const WINDOW_DAYS = 14;

/**
 * FRM-RM-05 — «تقویم تولید».
 *
 * تعریف تقویم در هر سطح با ارث‌بری، تقویم مؤثر هر خط با منشأ هر لایه (پایه،
 * شیفت، استثنا، نت، نفر)، استثناها با وضعیت تأیید، و رزرو نت روی همین تقویم.
 * درخت سمت راست دامنه را تعیین می‌کند؛ پنجره‌ی زمانی ۱۴روزه و قابل جابه‌جایی است.
 *
 * فاز اول: F-RM-030، 031، 032، 033، 034، 037. ویرایش روی نما (035) و سناریو
 * (036) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-rm-05',
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
  templateUrl: './frm-rm-05.component.html',
})
export class FrmRm05Component implements OnInit, OnDestroy {
  orgTree: TreeNode<RmSelection>[] = [];
  rules: CalendarRuleRow[] = [];
  inheritance: InheritanceRow[] = [];
  effective: EffectiveGrid = { days: [], lines: [] };
  conflicts: ConflictRow[] = [];
  exceptions: ExceptionRow[] = [];
  shutdowns: ShutdownRow[] = [];
  freeSlots: FreeSlotRow[] = [];
  windowText = '';

  selectedTreeNode: TreeNode<RmSelection> | null = null;
  selection: RmSelection | null = null;
  from: string | null = null;
  private today = '';

  readonly companyId = DEMO_COMPANY_ID;
  scopeLoading = false;
  loadFailed = false;

  private readonly load$ = new Subject<void>();
  private readonly sub = new Subscription();

  constructor(
    private scope: RmScopeService,
    private rm05: FrmRm05Service
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.load$
        .pipe(
          tap(() => (this.scopeLoading = true)),
          switchMap(() =>
            this.rm05.loadScope(this.selection!, this.from, WINDOW_DAYS).pipe(
              catchError((err) => {
                console.warn('[FRM-RM-05] خواندن داده ناموفق بود:', err?.message || err);
                this.scopeLoading = false;
                this.loadFailed = true;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((b) => {
          this.rules = b.rules;
          this.inheritance = b.inheritance;
          this.effective = b.effective;
          this.conflicts = b.conflicts;
          this.exceptions = b.exceptions;
          this.shutdowns = b.shutdowns;
          this.freeSlots = b.freeSlots;
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
        console.warn('[FRM-RM-05] خواندن درخت سازمانی ناموفق بود:', err?.message || err);
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
    this.from = this.rm05.shiftWindow(this.from, direction * WINDOW_DAYS);
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

  private get pending(): ExceptionRow[] {
    return this.exceptions.filter((x) => x.status === 'pending');
  }

  private get hasDays(): boolean {
    return this.effective.lines.some((l) => l.cells.some((c) => c !== null));
  }

  /** بنر: اول شیفتِ برنامه‌ریزی‌شده روی روز تعطیل، بعد استثنای منتظر تأیید، بعد خلاصه‌ی ظرفیت. */
  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (!this.effective.lines.length || !this.hasDays) return 'info';
    if (this.conflicts.length) return 'warning';
    if (this.pending.length) return 'info';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) {
      return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_rm05_setup.sql را بررسی کنید.';
    }
    if (!this.effective.lines.length) return `در «${this.contextLabel}» خط تولیدی نیست.`;
    if (!this.hasDays) return `برای بازه‌ی ${this.windowText} ردیف روز در تقویم ساخته نشده است.`;
    const parts: string[] = [];
    if (this.conflicts.length) {
      parts.push(
        'برای روز تعطیل شیفت برنامه‌ریزی شده: ' +
          this.conflicts.map((c) => `${c.line} — ${c.date} (${c.origin})`).join('؛ ') +
          '.'
      );
    }
    if (this.pending.length) {
      parts.push(`${this.fa(this.pending.length)} استثنا در انتظار تأیید است و تا تأیید نشود اثری بر تقویم ندارد.`);
    }
    if (parts.length) return parts.join(' ');
    return (
      `ظرفیت در دسترس بازه‌ی ${this.windowText}: ` +
      this.effective.lines.map((l) => `${l.line} ${l.totalHours} ساعت`).join('، ') +
      '.'
    );
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  hours(minutes: number): string {
    return faHours(minutes);
  }

  originLabel(origin: BaseOrigin): string {
    return BASE_ORIGIN_LABEL[origin];
  }

  exceptionLabel(kind: ExceptionKind): string {
    return EXCEPTION_LABEL[kind];
  }

  exceptionSeverity(kind: ExceptionKind): 'danger' | 'warning' | 'info' {
    return kind === 'holiday' ? 'danger' : kind === 'closure' ? 'warning' : 'info';
  }

  approvalLabel(status: ApprovalStatus): string {
    return APPROVAL_LABEL[status];
  }

  approvalSeverity(status: ApprovalStatus): 'success' | 'warning' | 'danger' {
    return status === 'approved' ? 'success' : status === 'pending' ? 'warning' : 'danger';
  }

  // ---- منبع داده‌ی زنده‌ی هر گرید (دکمه‌ی سه‌نقطه‌ی گوشه) ----

  rulesSource(): DataSourceInfo {
    return { key: 'rm05-rules', label: 'تعریف تقویم', filterVal: this.companyId };
  }
  inheritanceSource(): DataSourceInfo {
    return { key: 'rm05-inheritance', label: 'ارث‌بری تقویم', filterVal: this.companyId };
  }
  effectiveSource(): DataSourceInfo {
    return { key: 'rm05-effective', label: 'تقویم مؤثر', filterVal: this.companyId };
  }
  exceptionsSource(): DataSourceInfo {
    return { key: 'rm05-exceptions', label: 'استثناها', filterVal: this.companyId };
  }
  shutdownsSource(): DataSourceInfo {
    return { key: 'rm05-shutdowns', label: 'رزرو نت', filterVal: this.companyId };
  }
  orgTreeSource(): DataSourceInfo {
    return { key: 'rm01-org-tree', label: 'درخت سازمانی', filterVal: this.companyId };
  }
}
