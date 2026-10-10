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
  ABSENCE_LABEL,
  AbsenceRow,
  AbsenceType,
  AssignmentRow,
  RosterGrid,
  RotationRow,
  ShiftRow,
  ShortageRow,
} from './frm-rm-04.data';
import { FrmRm04Service } from './frm-rm-04.service';
import { DEMO_COMPANY_ID, RmScopeService, RmSelection } from './rm-scope';

const WINDOW_DAYS = 14;

/**
 * FRM-RM-04 — «شیفت و برنامه‌ی حضور».
 *
 * الگوی شیفت و چرخه‌ها مشترک‌اند؛ تخصیص چرخه، برنامه‌ی حضور و غیبت‌ها به
 * گروه‌های کاریِ دامنه‌ی انتخاب درخت (سمت راست) محدود می‌شوند. برنامه‌ی حضور
 * یک پنجره‌ی ۱۴روزه است که با دکمه‌های قبل/بعد جابه‌جا می‌شود.
 *
 * فاز اول: فیچرهای الزامی (F-RM-024، 025، 026). مقایسه با حضور و غیاب واقعی
 * HR (F-RM-027، فاز ۳) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-rm-04',
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
  templateUrl: './frm-rm-04.component.html',
})
export class FrmRm04Component implements OnInit, OnDestroy {
  orgTree: TreeNode<RmSelection>[] = [];
  shifts: ShiftRow[] = [];
  rotations: RotationRow[] = [];
  assignments: AssignmentRow[] = [];
  roster: RosterGrid = { days: [], rows: [], totals: [] };
  shortages: ShortageRow[] = [];
  absences: AbsenceRow[] = [];
  windowText = '';

  selectedTreeNode: TreeNode<RmSelection> | null = null;
  selection: RmSelection | null = null;
  /** اولین روز پنجره (YYYY-MM-DD)؛ خالی یعنی «از امروز» به تشخیص سرور. */
  from: string | null = null;
  private today = '';

  readonly companyId = DEMO_COMPANY_ID;
  readonly hours = [0, 3, 6, 9, 12, 15, 18, 21];
  scopeLoading = false;
  loadFailed = false;

  private readonly load$ = new Subject<void>();
  private readonly sub = new Subscription();

  constructor(
    private scope: RmScopeService,
    private rm04: FrmRm04Service
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.load$
        .pipe(
          tap(() => (this.scopeLoading = true)),
          switchMap(() =>
            this.rm04.loadScope(this.selection!, this.from, WINDOW_DAYS).pipe(
              catchError((err) => {
                console.warn('[FRM-RM-04] خواندن داده ناموفق بود:', err?.message || err);
                this.scopeLoading = false;
                this.loadFailed = true;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((b) => {
          this.shifts = b.shifts;
          this.rotations = b.rotations;
          this.assignments = b.assignments;
          this.roster = b.roster;
          this.shortages = b.shortages;
          this.absences = b.absences;
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
        console.warn('[FRM-RM-04] خواندن درخت سازمانی ناموفق بود:', err?.message || err);
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
    this.from = this.rm04.shiftWindow(this.from, direction * WINDOW_DAYS);
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

  get hasRoster(): boolean {
    return this.roster.rows.some((r) => r.cells.some((c) => c !== null));
  }

  /** بنر از روی وضعیت واقعی پنجره: کسری نفر جبران‌نشده، نبودِ تقویم، یا همه‌چیز کامل. */
  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.shortages.length) return 'warning';
    if (!this.hasRoster) return 'info';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) {
      return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_rm04_setup.sql را بررسی کنید.';
    }
    if (this.shortages.length) {
      return (
        'کسری نفر جبران‌نشده در این بازه: ' +
        this.shortages
          .map((s) => `${s.group} — ${s.date}، شیفت ${s.shift}: ${this.fa(s.available)} از ${this.fa(s.planned)} نفر`)
          .join('؛ ') +
        '.'
      );
    }
    if (!this.hasRoster) {
      return `برای گروه‌های کاری «${this.contextLabel}» در بازه‌ی ${this.windowText} برنامه‌ی حضوری تولید نشده است.`;
    }
    return `در بازه‌ی ${this.windowText} همه‌ی شیفت‌های این دامنه با نفر کامل برنامه‌ریزی شده‌اند.`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  hourLabel(h: number): string {
    return h.toLocaleString('fa-IR', { minimumIntegerDigits: 2 }) + ':۰۰';
  }

  absenceLabel(type: AbsenceType): string {
    return ABSENCE_LABEL[type];
  }

  absenceSeverity(type: AbsenceType): 'info' | 'danger' | 'warning' {
    return type === 'absent' ? 'danger' : type === 'leave' ? 'warning' : 'info';
  }

  effectLabel(effect: AbsenceRow['effect']): string {
    return effect === 'covered' ? 'جبران‌شده با جایگزین' : effect === 'shortage' ? 'کسری ظرفیت' : 'روز استراحت گروه';
  }

  effectSeverity(effect: AbsenceRow['effect']): 'success' | 'danger' | 'info' {
    return effect === 'covered' ? 'success' : effect === 'shortage' ? 'danger' : 'info';
  }

  trackRotation(_: number, r: RotationRow): number {
    return r.id;
  }

  // ---- منبع داده‌ی زنده‌ی هر گرید (دکمه‌ی سه‌نقطه‌ی گوشه) ----

  shiftsSource(): DataSourceInfo {
    return { key: 'rm04-shifts', label: 'الگوی شیفت', filterVal: this.companyId };
  }
  rotationsSource(): DataSourceInfo {
    return { key: 'rm04-rotations', label: 'چرخه‌ی شیفت', filterVal: this.companyId };
  }
  assignmentsSource(): DataSourceInfo {
    return { key: 'rm04-assignments', label: 'تخصیص چرخه به گروه', filterVal: this.companyId };
  }
  rosterSource(): DataSourceInfo {
    return { key: 'rm04-roster', label: 'برنامه‌ی حضور', filterVal: this.companyId };
  }
  absencesSource(): DataSourceInfo {
    return { key: 'rm04-absences', label: 'غیبت و جایگزینی', filterVal: this.companyId };
  }
  orgTreeSource(): DataSourceInfo {
    return { key: 'rm01-org-tree', label: 'درخت سازمانی', filterVal: this.companyId };
  }
}
