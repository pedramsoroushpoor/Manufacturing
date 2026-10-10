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
  ConcurrencyRow,
  PersonnelRow,
  RequirementRow,
  SKILL_LEVEL_LABEL,
  SkillMatrix,
  SkillRow,
  VALIDITY_LABEL,
  ValidityIssueRow,
  ValidityStatus,
  WorkingGroupRow,
} from './frm-rm-03.data';
import { FrmRm03Service } from './frm-rm-03.service';
import { DEMO_COMPANY_ID, RmScopeService, RmSelection } from './rm-scope';

/**
 * FRM-RM-03 — «نیروی کار و ماتریس مهارت».
 *
 * مثل FRM-RM-01 و 02، درخت «سلسله‌مراتب سازمانی و مکانی» (سمت راست) انتخابگر
 * مشترک فرم است: با انتخاب هر گره‌ی سازمانی، خط یا ایستگاه، همه‌ی تب‌ها به
 * نیروی همان دامنه محدود می‌شوند.
 *
 * فاز اول: فیچرهای الزامی (F-RM-020، 021، 022، 023، 029). تب «نرخ و محرک
 * هزینه» (F-RM-028، فاز ۳) هنوز داده ندارد.
 */
@Component({
  selector: 'gng-frm-rm-03',
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
  templateUrl: './frm-rm-03.component.html',
})
export class FrmRm03Component implements OnInit, OnDestroy {
  orgTree: TreeNode<RmSelection>[] = [];
  personnel: PersonnelRow[] = [];
  skills: SkillRow[] = [];
  requirements: RequirementRow[] = [];
  matrix: SkillMatrix = { skills: [], rows: [], coverage: [] };
  validityIssues: ValidityIssueRow[] = [];
  workingGroups: WorkingGroupRow[] = [];
  concurrency: ConcurrencyRow[] = [];

  selectedTreeNode: TreeNode<RmSelection> | null = null;
  selection: RmSelection | null = null;

  readonly companyId = DEMO_COMPANY_ID;
  readonly levels = [1, 2, 3, 4];
  scopeLoading = false;
  loadFailed = false;

  private readonly selection$ = new Subject<RmSelection>();
  private readonly sub = new Subscription();

  constructor(
    private scope: RmScopeService,
    private rm03: FrmRm03Service
  ) {}

  ngOnInit(): void {
    // switchMap: اگر کاربر پشت‌سرهم چند گره را انتخاب کند فقط پاسخ آخرین انتخاب اعمال می‌شود.
    this.sub.add(
      this.selection$
        .pipe(
          tap(() => (this.scopeLoading = true)),
          switchMap((sel) =>
            this.rm03.loadScope(sel).pipe(
              catchError((err) => {
                console.warn('[FRM-RM-03] خواندن دامنه‌ی انتخاب ناموفق بود:', err?.message || err);
                this.scopeLoading = false;
                this.loadFailed = true;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((b) => {
          this.personnel = b.personnel;
          this.skills = b.skills;
          this.requirements = b.requirements;
          this.matrix = b.matrix;
          this.validityIssues = b.validityIssues;
          this.workingGroups = b.workingGroups;
          this.concurrency = b.concurrency;
          this.loadFailed = false;
          this.scopeLoading = false;
        })
    );

    this.scope.loadFullTree(this.companyId).subscribe({
      next: (tree) => {
        if (!tree.length) return;
        this.orgTree = tree;
        // انتخاب پیش‌فرض: ریشه‌ی درخت، یعنی نیروی کل مجموعه.
        this.selectedTreeNode = tree[0];
        this.select(tree[0].data!);
      },
      error: (err) => {
        console.warn('[FRM-RM-03] خواندن درخت سازمانی ناموفق بود:', err?.message || err);
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
    this.selection$.next(sel);
  }

  // ---- متن‌ها و کمک‌تابع‌های قالب ----

  get contextLabel(): string {
    return this.selection?.title ?? 'بدون انتخاب';
  }

  private get violations(): ConcurrencyRow[] {
    return this.concurrency.filter((c) => c.violation);
  }

  private get overdue(): ValidityIssueRow[] {
    return this.validityIssues.filter((v) => v.status === 'expired' || v.status === 'retraining');
  }

  /** بنر از روی وضعیت واقعی دامنه: اول نقض هم‌زمانی، بعد مهارت منقضی/بازآموزی گذشته، بعد موعد نزدیک. */
  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (!this.personnel.length) return 'info';
    if (this.violations.length) return 'danger';
    if (this.overdue.length) return 'warning';
    if (this.validityIssues.length) return 'info';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) {
      return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_rm03_setup.sql را بررسی کنید.';
    }
    if (!this.personnel.length) return `در «${this.contextLabel}» نیروی تولیدی تعریف یا تخصیص داده نشده است.`;
    const parts: string[] = [];
    if (this.violations.length) {
      parts.push('محدودیت هم‌زمانی نقض شده: ' + this.violations.map((c) => `${c.person} — ${c.reason}`).join('؛ ') + '.');
    }
    if (this.overdue.length) {
      parts.push(
        'اعتبار مهارت: ' +
          this.overdue.map((v) => `${v.person} / ${v.skill} (${this.validityLabel(v.status)})`).join('، ') +
          '.'
      );
    }
    if (parts.length) return parts.join(' ');
    if (this.validityIssues.length) {
      return (
        'موعد بازآموزی یا اعتبار تا ۳۰ روز دیگر: ' +
        this.validityIssues.map((v) => `${v.person} / ${v.skill} (${v.date})`).join('، ') +
        '.'
      );
    }
    return 'در این دامنه همه‌ی مهارت‌ها معتبرند و تخصیص نفرات در سقف هم‌زمانی است.';
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  levelLabel(level: number): string {
    return SKILL_LEVEL_LABEL[level] ?? '';
  }

  validityLabel(status: ValidityStatus): string {
    return VALIDITY_LABEL[status];
  }

  validitySeverity(status: ValidityStatus): 'success' | 'info' | 'warning' | 'danger' {
    return status === 'expired' ? 'danger' : status === 'retraining' ? 'warning' : status === 'expiring' ? 'info' : 'success';
  }

  validityIcon(status: ValidityStatus): string {
    return status === 'expired' ? 'pi pi-times-circle' : status === 'retraining' ? 'pi pi-refresh' : 'pi pi-clock';
  }

  trackPerson(_: number, row: { person: PersonnelRow }): number {
    return row.person.id;
  }

  // ---- منبع داده‌ی زنده‌ی هر گرید (دکمه‌ی سه‌نقطه‌ی گوشه) ----

  personnelSource(): DataSourceInfo {
    return { key: 'rm03-personnel', label: 'پرسنل تولید', filterVal: this.companyId };
  }
  skillsSource(): DataSourceInfo {
    return { key: 'rm03-skills', label: 'مهارت‌ها', filterVal: this.companyId };
  }
  requirementsSource(): DataSourceInfo {
    return { key: 'rm03-requirements', label: 'الزام مهارت عملیات', filterVal: this.companyId };
  }
  matrixSource(): DataSourceInfo {
    return { key: 'rm03-matrix', label: 'ماتریس مهارت', filterVal: this.companyId };
  }
  workingGroupsSource(): DataSourceInfo {
    return { key: 'rm03-working-groups', label: 'گروه کاری', filterVal: this.companyId };
  }
  stationLaborSource(): DataSourceInfo {
    return { key: 'rm03-station-labor', label: 'تخصیص نفر به ایستگاه', filterVal: this.companyId };
  }
  orgTreeSource(): DataSourceInfo {
    return { key: 'rm01-org-tree', label: 'درخت سازمانی', filterVal: this.companyId };
  }
}
