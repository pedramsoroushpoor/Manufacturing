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
import { RoutingRow, buildRoutingTree, defaultRouting, faNum } from './me-routing';
import { ActivityRow, Issue, Me10Bundle, ShareRow } from './frm-me-10.data';
import { FrmMe10Service } from './frm-me-10.service';

/**
 * FRM-ME-10 — «فعالیت و محرک هزینه‌ی عملیات».
 *
 * فعالیت‌های هر عملیات روش (از FRM-RM-09، به ارث از کتابخانه‌ی عملیات)، محرک هزینه‌ی هر فعالیت روی
 * عملیات، سهم خروجی‌ها از هزینه‌ی عملیات تولیدکننده (پل به PE-04) و تفکیک ارزش‌افزا/غیرارزش‌افزا.
 * این فرم فیچر الزامی ندارد و به درخواست صریح کاربر ساخته شد (مثل RM-09).
 */
@Component({
  selector: 'gng-frm-me-10',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-me-10.component.html',
})
export class FrmMe10Component implements OnInit {
  data: Me10Bundle | null = null;
  pickTree: TreeNode<{ id: number }>[] = [];
  selectedPick: TreeNode<{ id: number }> | null = null;
  routing: RoutingRow | null = null;
  activities: ActivityRow[] = [];
  withActivity: ActivityRow[] = [];
  shares: ShareRow[] = [];
  issues: Issue[] = [];

  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private me10: FrmMe10Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.me10.load(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.pickTree = buildRoutingTree(b.routings, (r) => !r.isTemplate && r.statusCode === 3);
        this.select(defaultRouting(b.routings)?.id ?? null);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-ME-10] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  onPick(e: { node: TreeNode<{ id: number }> }): void {
    if (e.node.data) this.select(e.node.data.id);
  }

  onUnpick(e: { node: TreeNode<{ id: number }> }): void {
    setTimeout(() => (this.selectedPick = e.node));
  }

  private select(id: number | null): void {
    const b = this.data!;
    this.routing = b.routings.find((r) => r.id === id) ?? null;
    this.selectedPick = this.pickTree.flatMap((g) => g.children ?? []).find((n) => n.data?.id === id) ?? null;
    this.activities = b.activities.filter((a) => a.routingId === id);
    this.withActivity = this.activities.filter((a) => a.activityId !== null);
    this.shares = b.shares.filter((s) => s.routingId === id);
    this.issues = this.validate();
  }

  private validate(): Issue[] {
    const out: Issue[] = [];
    const ops = new Map<number, ActivityRow[]>();
    for (const a of this.activities) ops.set(a.routingOperationId, [...(ops.get(a.routingOperationId) ?? []), a]);
    for (const [, rows] of ops) {
      const first = rows[0];
      if (!rows.some((r) => r.activityId !== null) && first.natureCode <= 3 && first.libraryActivityCount === 0)
        out.push({ severity: 'warning', text: `${this.fa(first.operationSequence)} «${first.operation}» فعالیت ABC ندارد (نه در روش نه در کتابخانه)` });
    }
    const noDriver = new Set(this.withActivity.filter((a) => !a.driver).map((a) => a.activity));
    for (const a of noDriver) out.push({ severity: 'danger', text: `فعالیت «${a}» محرک هزینه ندارد (FRM-RM-09)` });
    const badCap = new Set(this.withActivity.filter((a) => a.driver && a.capacityAllowed === false).map((a) => `${a.driver} (${a.driverCapacity})`));
    for (const d of badCap) out.push({ severity: 'danger', text: `محرک ${d} روی کارکردی است که به‌عنوان محرک هزینه مجاز نیست` });
    const byOp = new Map<number, ShareRow[]>();
    for (const s of this.shares.filter((x) => x.share !== null)) byOp.set(s.routingOperationId, [...(byOp.get(s.routingOperationId) ?? []), s]);
    for (const [, rows] of byOp) {
      const sum = rows.reduce((t, r) => t + (r.share ?? 0), 0);
      if (Math.abs(sum - 100) > 0.01) out.push({ severity: 'danger', text: `سهم هزینه‌ی خروجی‌های ردیف ${this.fa(rows[0].sequence)} «${rows[0].operation}» جمعاً ${faNum(sum)}٪ است، نه ۱۰۰٪` });
    }
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }

  // ───────── نمایش ─────────

  get vaMinutes(): number {
    return this.withActivity.filter((a) => a.valueAdded).reduce((s, a) => s + (a.minutes ?? 0), 0);
  }

  get nvaMinutes(): number {
    return this.withActivity.filter((a) => a.valueAdded === false).reduce((s, a) => s + (a.minutes ?? 0), 0);
  }

  get vaPercent(): number {
    const t = this.vaMinutes + this.nvaMinutes;
    return t ? (this.vaMinutes / t) * 100 : 0;
  }

  get contextLabel(): string {
    return this.routing ? `${this.routing.code} ${this.routing.version} — ${this.routing.title}` : 'فعالیت عملیات';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.severity === 'danger')) return 'danger';
    return this.issues.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_me10_setup.sql را بررسی کنید.';
    if (this.loading || !this.routing) return 'در حال خواندن…';
    if (this.issues.length) return this.issues.map((i) => i.text).join('؛ ') + '.';
    return `${this.fa(this.withActivity.length)} فعالیت با محرک معتبر؛ ${faNum(this.vaPercent, 1)}٪ زمان استاندارد ارزش‌افزاست.`;
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
