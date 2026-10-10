import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Subject, Subscription, catchError, debounceTime, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SliderModule } from 'primeng/slider';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import {
  OP_STATUS, PRIORITY, REQUEST_ORIGIN, REQUEST_STATUS, SHOP_NOW, Tone, WO_STATUS, WO_TYPE,
  faDateTime, faDay, faDuration, faInt, faNum, faPct, minutesAgo, opStatusTone, priorityTone, woStatusTone,
} from './pc-shared';
import {
  ApprovalRow, ApprovalRule, BOARD_COLUMNS, DAY_MS, DECISION, FeasMaterial, Feasibility, LinkedOrder, ORIGIN_ICON, RequestRow,
} from './frm-pc-01.data';
import { FrmPc01Service } from './frm-pc-01.service';

/** نمای محاسبه‌شده‌ی هر درخواست */
interface RequestView {
  r: RequestRow;
  daysToNeed: number | null;
  needLabel: string;
  needTone: Tone;
  orders: { o: LinkedOrder; allotted: number; producedShare: number }[];
  produced: number;
  inProgress: number;
  remaining: number;
  producedPct: number;
  inProgressPct: number;
  issues: string[];
  pendingRole: string;
}

interface RouteStep {
  rule: ApprovalRule | null;
  why: string;
  approval: ApprovalRow | null;
  waiting: string;
  state: 'done' | 'rejected' | 'pending' | 'missing';
}

interface MatView {
  m: FeasMaterial;
  byDate: number;
  short: number;
  coverIso: string | null;
  state: 'ok' | 'covered' | 'transit' | 'short';
  availPct: number;
  transitPct: number;
  reqPct: number;
}

/**
 * FRM-PC-01 — «درخواست تولید»: صف درخواست‌ها از فروش، انبار، MRP، واحدهای داخلی و مشتری کارمزدی تا دستور کار.
 *
 * تابلوی وضعیت (پیش‌نویس ← تکمیل) با شمارش معکوس تاریخ نیاز، گردش تأیید با قاعده‌ی فعال‌شده و تصمیم‌گیرنده،
 * امکان‌سنجی زنده‌ی ATP/CTP با «تاریخ مبنا»ی لغزنده (تاریخ رفع کسری و تاریخ تحقق پیشنهادی)، گراف تجمیع/تفکیک
 * درخواست ↔ دستور در دو جهت، و پیشرفت هر درخواست برای واحد درخواست‌کننده.
 *
 * فاز اول: F-PC-001 تا 005 (و 006 به‌صورت اقدام فقط‌خواندنی). ثبت، ویرایش، تأیید/رد، تجمیع و تفکیک واقعی
 * با فاز ایجاد/ویرایش می‌آیند.
 */
@Component({
  selector: 'gng-frm-pc-01',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, InputTextModule, SliderModule, TabViewModule, TableModule, TagModule, TooltipModule,
    OperationalFormLayoutComponent, DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pc-01.component.html',
  styles: [`
    .pc1-kanban { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 0.6rem; }
    .pc1-col { background: var(--gng-bg); border: 1px solid var(--gng-border); border-radius: var(--gng-radius); padding: 0.45rem; min-height: 9rem; }
    .pc1-col h4 { margin: 0 0 0.45rem; font-size: 0.82rem; display: flex; justify-content: space-between; }
    .pc1-card { background: var(--gng-surface); border: 1px solid var(--gng-border); border-inline-start: 4px solid var(--gng-text-muted);
      border-radius: 8px; padding: 0.45rem 0.55rem; margin-bottom: 0.45rem; cursor: pointer; font-size: 0.78rem; }
    .pc1-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .pc1-card--sel { outline: 2px solid var(--gng-primary); }
    .pc1-card--p2 { border-inline-start-color: var(--gng-warning); }
    .pc1-card--p3 { border-inline-start-color: var(--gng-danger); }
    .pc1-card__top { display: flex; justify-content: space-between; align-items: center; font-weight: 700; }
    .pc1-card__meta { color: var(--gng-text-muted); margin-top: 0.2rem; }
    .pc1-chip { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; padding: 0.05rem 0.45rem; border-radius: 999px;
      background: var(--gng-bg); border: 1px solid var(--gng-border); margin-inline-end: 0.25rem; margin-top: 0.25rem; }
    .pc1-chip--danger { color: var(--gng-danger); border-color: var(--gng-danger); }
    .pc1-chip--warning { color: var(--gng-warning); border-color: var(--gng-warning); }
    .pc1-chip--success { color: var(--gng-success); border-color: var(--gng-success); }
    .pc1-chip--info { color: var(--gng-info); border-color: var(--gng-info); }
    .pc1-chip--on { background: var(--gng-primary); color: #fff; border-color: var(--gng-primary); }
    .pc1-filter { display: flex; flex-wrap: wrap; gap: 0.2rem; margin: 0.4rem 0; }
    .pc1-filter .pc1-chip { cursor: pointer; }
    .pc1-list-item { padding: 0.45rem 0.5rem; border-radius: 8px; cursor: pointer; border: 1px solid transparent; font-size: 0.8rem; }
    .pc1-list-item:hover { background: var(--gng-bg); }
    .pc1-list-item--sel { border-color: var(--gng-primary); background: var(--gng-bg); }
    .pc1-issue { color: var(--gng-danger); font-size: 0.72rem; margin-top: 0.15rem; }
    .pc1-bar { position: relative; height: 14px; background: var(--gng-bg); border-radius: 7px; overflow: hidden; border: 1px solid var(--gng-border); }
    .pc1-bar__seg { position: absolute; top: 0; bottom: 0; }
    .pc1-bar__avail { background: var(--gng-success); }
    .pc1-bar__transit { background: repeating-linear-gradient(45deg, var(--gng-info), var(--gng-info) 4px, transparent 4px, transparent 7px); opacity: .75; }
    .pc1-bar__prog { background: var(--gng-info); }
    .pc1-bar__req { position: absolute; top: -2px; bottom: -2px; width: 3px; background: var(--gng-danger); }
    .pc1-axis { position: relative; height: 54px; margin: 0.5rem 0 1.2rem; border-bottom: 2px solid var(--gng-border); }
    .pc1-axis__mark { position: absolute; bottom: -6px; transform: translateX(50%); text-align: center; font-size: 0.7rem; white-space: nowrap; }
    .pc1-axis__mark i { display: block; font-size: 0.85rem; }
    .pc1-axis__mark--now { color: var(--gng-primary); } .pc1-axis__mark--need { color: var(--gng-warning); }
    .pc1-axis__mark--arr { color: var(--gng-info); } .pc1-axis__mark--prop { color: var(--gng-success); font-weight: 700; }
    .pc1-axis__mark--late { color: var(--gng-danger); font-weight: 700; } .pc1-axis__mark--asof { color: var(--gng-purple); }
    .pc1-graph { position: relative; }
    .pc1-graph svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .pc1-node { position: absolute; width: 36%; height: 30px; display: flex; align-items: center; gap: 0.35rem; padding: 0 0.5rem; font-size: 0.76rem;
      border: 1px solid var(--gng-border); border-radius: 8px; background: var(--gng-surface); cursor: pointer; overflow: hidden; white-space: nowrap; }
    .pc1-node--req { right: 0; } .pc1-node--wo { left: 0; }
    .pc1-node--hi { border-color: var(--gng-primary); box-shadow: 0 0 0 2px rgba(59,130,246,.18); }
    .pc1-node--dim { opacity: .45; }
    .pc1-big { font-size: 1.35rem; font-weight: 700; }
    .pc1-pipe { display: flex; gap: 2px; margin-top: 0.3rem; }
    .pc1-pipe span { flex: 1; height: 8px; border-radius: 2px; background: var(--gng-border); }
    .pc1-pipe .s5 { background: var(--gng-success); } .pc1-pipe .s3 { background: var(--gng-info); } .pc1-pipe .s4 { background: var(--gng-danger); }
    .pc1-pipe .s2 { background: var(--gng-warning); } .pc1-pipe .s6 { background: var(--gng-purple); }
    .pc1-rule--on { background: rgba(34,197,94,.08); }
    .pc1-dist { display: grid; grid-template-columns: 9rem 1fr 2.5rem; gap: 0.3rem 0.5rem; align-items: center; font-size: 0.8rem; }
    .pc1-dist .pc1-bar { cursor: pointer; }
    @media (max-width: 1100px) { .pc1-kanban { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class FrmPc01Component implements OnInit, OnDestroy {
  requests: RequestRow[] = [];
  approvals: ApprovalRow[] = [];
  rules: ApprovalRule[] = [];
  orders: LinkedOrder[] = [];
  views: RequestView[] = [];
  private viewById = new Map<number, RequestView>();
  /** امکان‌سنجی امروز برای درخواست‌های باز (مبنای بنر) */
  private feasToday = new Map<number, Feasibility>();

  selected: RequestView | null = null;
  search = '';
  statusFilter: number | null = null;
  originFilter: number | null = null;
  filtered: RequestView[] = [];
  board: { code: number; title: string; items: RequestView[] }[] = [];

  route: RouteStep[] = [];
  firedRules = new Set<number>();

  /* امکان‌سنجی */
  asOfDays = 0;
  feas: Feasibility | null = null;
  feasLoading = false;
  matViews: MatView[] = [];
  axisMarks: { pos: number; cls: string; icon: string; label: string }[] = [];
  feasVerdict = '';
  feasTone: 'success' | 'warning' | 'danger' = 'success';
  proposedIso: string | null = null;
  readyIso: string | null = null;
  private feas$ = new Subject<void>();
  private sub?: Subscription;

  /* گراف تجمیع/تفکیک */
  graphReqs: { v: RequestView; y: number; hi: boolean }[] = [];
  graphOrders: { o: LinkedOrder; y: number; hi: boolean; kind: string }[] = [];
  graphLinks: { d: string; hi: boolean }[] = [];
  graphHeight = 0;
  linkSentences: string[] = [];

  originDist: { code: number; title: string; count: number; pct: number }[] = [];
  priorityDist: { code: number; title: string; count: number; pct: number }[] = [];

  readonly companyId = DEMO_COMPANY_ID;
  readonly REQUEST_STATUS = REQUEST_STATUS;
  readonly REQUEST_ORIGIN = REQUEST_ORIGIN;
  readonly PRIORITY = PRIORITY;
  readonly WO_STATUS = WO_STATUS;
  readonly WO_TYPE = WO_TYPE;
  readonly OP_STATUS = OP_STATUS;
  readonly DECISION = DECISION;
  readonly ORIGIN_ICON = ORIGIN_ICON;
  readonly faNum = faNum;
  readonly faInt = faInt;
  readonly faPct = faPct;
  readonly faDay = faDay;
  readonly faDateTime = faDateTime;
  readonly priorityTone = priorityTone;
  readonly woStatusTone = woStatusTone;
  readonly opStatusTone = opStatusTone;
  loading = false;
  loadFailed = false;

  constructor(private pc01: FrmPc01Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.sub = this.feas$
      .pipe(
        debounceTime(200),
        switchMap(() => {
          if (!this.selected) return of(null);
          this.feasLoading = true;
          return this.pc01.feasibility(this.selected.r.id, this.asOfIso).pipe(catchError(() => of(null)));
        })
      )
      .subscribe((f) => {
        this.feasLoading = false;
        this.feas = f;
        this.analyseFeasibility();
      });

    forkJoin({ b: this.pc01.bundle(this.companyId), o: this.pc01.orders(this.companyId).pipe(catchError(() => of([] as LinkedOrder[]))) }).subscribe({
      next: ({ b, o }) => {
        this.requests = b.requests;
        this.approvals = b.approvals;
        this.rules = b.rules;
        this.orders = o;
        const open = b.requests.filter((r) => r.statusCode <= 3);
        const today = this.isoDate(SHOP_NOW);
        forkJoin(open.map((r) => this.pc01.feasibility(r.id, today).pipe(catchError(() => of(null))))).subscribe((fs) => {
          fs.forEach((f, i) => f && this.feasToday.set(open[i].id, f));
          this.buildViews();
          this.loading = false;
          const first = this.views.find((v) => v.issues.length && v.r.statusCode === 3) ?? this.views[0] ?? null;
          if (first) this.select(first);
        });
        if (!open.length) {
          this.buildViews();
          this.loading = false;
          if (this.views[0]) this.select(this.views[0]);
        }
      },
      error: (err) => {
        console.warn('[FRM-PC-01] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ───────── ساخت نماها ─────────

  private buildViews(): void {
    this.views = this.requests.map((r) => this.buildView(r));
    this.viewById = new Map(this.views.map((v) => [v.r.id, v]));
    const dist = (codes: number[], titles: Record<number, string>, pick: (r: RequestRow) => number) =>
      codes.map((code) => {
        const count = this.requests.filter((r) => pick(r) === code).length;
        return { code, title: titles[code], count, pct: this.requests.length ? (100 * count) / this.requests.length : 0 };
      });
    this.originDist = dist([1, 2, 3, 4, 5], REQUEST_ORIGIN, (r) => r.originCode);
    this.priorityDist = dist([3, 2, 1], PRIORITY, (r) => r.priorityCode);
    this.applyFilter();
    this.buildGraph();
  }

  private buildView(r: RequestRow): RequestView {
    const days = r.needDate ? Math.round((new Date(r.needDate).getTime() - SHOP_NOW.getTime()) / DAY_MS) : null;
    const done = r.statusCode >= 5;
    const needLabel = days === null ? 'بدون تاریخ نیاز' : done ? `نیاز ${faDay(r.needDate)}` : days > 0 ? `${faInt(days)} روز مانده` : days === 0 ? 'امروز' : `${faInt(-days)} روز گذشته`;
    const needTone: Tone = done ? 'secondary' : days === null ? 'secondary' : days < 0 ? 'danger' : days <= 2 ? 'warning' : 'success';

    /* سهم هر دستور از این درخواست = مقدار دستور × سهم درخواست از جمع درخواست‌های همان دستور */
    const orders = this.orders
      .filter((o) => o.requestNumbers.includes(r.number) && o.statusCode !== 6)
      .map((o) => {
        const total = o.requestNumbers.reduce((s, n) => s + (this.requests.find((x) => x.number === n)?.quantity ?? 0), 0) || r.quantity;
        const share = r.quantity / total;
        return { o, allotted: o.quantity * share, producedShare: Math.min(o.produced, o.quantity) * share };
      });
    let produced = 0;
    let inProgress = 0;
    for (const x of orders) {
      produced += x.producedShare;
      if (x.o.statusCode <= 3) inProgress += Math.max(0, x.allotted - x.producedShare);
    }
    if (r.statusCode === 5) produced = Math.max(produced, r.quantity);
    const remaining = Math.max(0, r.quantity - produced - inProgress);

    const issues: string[] = [];
    let pendingRole = '';
    const pend = this.approvals.find((a) => a.requestId === r.id && a.decisionCode === null);
    if (r.statusCode === 2 && pend) {
      pendingRole = pend.role;
      const prev = this.approvals.filter((a) => a.requestId === r.id && a.sequence < pend.sequence && a.decisionDate).map((a) => a.decisionDate as string).sort().pop();
      issues.push(`منتظر «${pend.role}» از ${faDuration(minutesAgo(prev ?? r.requestDate))} پیش`);
    }
    const f = this.feasToday.get(r.id);
    if (r.statusCode <= 3 && f && !f.summary?.versionId) issues.push('نسخه‌ی تولید/ساختار فعال ندارد — امکان‌پذیر نیست');
    if (r.statusCode === 3 && r.orderedQuantity < r.quantity) issues.push('تأییدشده ولی دستور کار ندارد');
    if (r.statusCode <= 3 && f?.summary?.versionId) {
      const short = f.materials.filter((m) => m.required > Math.max(0, m.available));
      for (const m of short) {
        const gap = m.required - Math.max(0, m.available);
        issues.push(`کسری ${m.productTitle} ${faNum(gap)} ${m.unit}` + (m.inTransit >= gap && m.lastArrival ? ` (در راه تا ${faDay(m.lastArrival)})` : ''));
      }
    }
    if (!done && days !== null && days < 0) issues.push('تاریخ نیاز گذشته');
    const lastFinish = orders.map((x) => x.o.actualComplete ?? x.o.plannedComplete).filter((d): d is string => !!d).sort().pop();
    if (r.statusCode === 4 && r.needDate && lastFinish && lastFinish > r.needDate) issues.push(`تکمیل برنامه‌ای ${faDay(lastFinish)} بعد از تاریخ نیاز`);

    return {
      r, daysToNeed: days, needLabel, needTone, orders, produced, inProgress, remaining,
      producedPct: r.quantity ? (100 * produced) / r.quantity : 0,
      inProgressPct: r.quantity ? (100 * inProgress) / r.quantity : 0,
      issues, pendingRole,
    };
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = this.views.filter(
      (v) =>
        (this.statusFilter === null || v.r.statusCode === this.statusFilter) &&
        (this.originFilter === null || v.r.originCode === this.originFilter) &&
        (!q || [v.r.number, v.r.productTitle, v.r.productCode, v.r.requester, v.r.customer, v.r.salesOrder, v.r.generalRequisition].join(' ').toLowerCase().includes(q))
    );
    const cols = [...BOARD_COLUMNS];
    if (this.views.some((v) => v.r.statusCode === 6)) cols.push(6);
    this.board = cols.map((code) => ({ code, title: REQUEST_STATUS[code], items: this.filtered.filter((v) => v.r.statusCode === code) }));
  }

  toggleStatus(code: number): void {
    this.statusFilter = this.statusFilter === code ? null : code;
    this.applyFilter();
  }

  toggleOrigin(code: number): void {
    this.originFilter = this.originFilter === code ? null : code;
    this.applyFilter();
  }

  countByStatus(code: number): number {
    return this.views.filter((v) => v.r.statusCode === code).length;
  }

  select(v: RequestView): void {
    this.selected = v;
    this.buildRoute(v.r);
    this.asOfDays = 0;
    this.feas = this.feasToday.get(v.r.id) ?? null;
    this.analyseFeasibility();
    this.feas$.next();
    this.markGraph();
  }

  selectById(id: number): void {
    const v = this.viewById.get(id);
    if (v) this.select(v);
  }

  selectByOrder(o: LinkedOrder): void {
    const v = this.views.find((x) => o.requestNumbers.includes(x.r.number));
    if (v) this.select(v);
  }

  // ───────── گردش تأیید (F-PC-003) ─────────

  private ruleWhy(rule: ApprovalRule, r: RequestRow): string | null {
    const parts: string[] = [];
    if (rule.originCode !== null) {
      if (rule.originCode !== r.originCode) return null;
      parts.push(`منشأ = ${REQUEST_ORIGIN[rule.originCode]}`);
    }
    if (rule.minQuantity !== null) {
      if (r.quantity < rule.minQuantity) return null;
      parts.push(`مقدار ${faInt(r.quantity)} ≥ ${faInt(rule.minQuantity)}`);
    }
    if (rule.productGroup) {
      if (rule.productGroup !== r.productGroup) return null;
      parts.push(`گروه = ${rule.productGroup}`);
    }
    if (rule.requesterUnit) {
      if (rule.requesterUnit !== r.requesterUnit) return null;
      parts.push(`واحد = ${rule.requesterUnit}`);
    }
    return parts.length ? parts.join(' و ') : 'همه‌ی درخواست‌ها';
  }

  private buildRoute(r: RequestRow): void {
    const rows = this.approvals.filter((a) => a.requestId === r.id).sort((a, b) => a.sequence - b.sequence);
    const used = new Set<ApprovalRow>();
    this.firedRules = new Set<number>();
    const steps: RouteStep[] = [];
    let prevDate: string | null = r.requestDate;
    for (const rule of this.rules) {
      const why = this.ruleWhy(rule, r);
      if (why === null) continue;
      this.firedRules.add(rule.sequence);
      const a = rows.find((x) => x.role === rule.role && !used.has(x)) ?? null;
      if (a) used.add(a);
      const state: RouteStep['state'] = !a ? 'missing' : a.decisionCode === 1 ? 'done' : a.decisionCode === 2 ? 'rejected' : 'pending';
      const waiting = a?.decisionDate
        ? `پاسخ پس از ${faDuration(Math.round((new Date(a.decisionDate).getTime() - new Date(prevDate ?? a.decisionDate).getTime()) / 60000))}`
        : state === 'pending' ? `در انتظار از ${faDuration(minutesAgo(prevDate))} پیش` : '';
      if (a?.decisionDate) prevDate = a.decisionDate;
      steps.push({ rule, why, approval: a, waiting, state });
    }
    for (const a of rows.filter((x) => !used.has(x)))
      steps.push({ rule: null, why: 'بدون قاعده‌ی متناظر', approval: a, waiting: '', state: a.decisionCode === 1 ? 'done' : a.decisionCode === 2 ? 'rejected' : 'pending' });
    /* پیش‌نویس هنوز به گردش نرفته؛ مراحل «انجام‌نشده» را منتظر نشان نده */
    this.route = steps;
  }

  get routeHasPending(): boolean {
    return this.route.some((s) => s.state === 'pending' || s.state === 'missing');
  }

  get routeNote(): string {
    const r = this.selected?.r;
    if (!r) return '';
    if (r.statusCode === 1) return 'پیش‌نویس هنوز برای تأیید ارسال نشده؛ مسیر زیر با ارسال فعال می‌شود.';
    const missing = this.route.filter((s) => s.state === 'missing' && r.statusCode >= 3);
    if (missing.length) return `قاعده‌ی ${missing.map((s) => s.rule?.role).join('، ')} فعال شده ولی مرحله‌ی تأییدش ثبت نشده.`;
    const pend = this.route.find((s) => s.state === 'pending');
    if (pend) return `منتظر «${pend.rule?.role ?? pend.approval?.role}»${pend.approval?.approver ? ' — ' + pend.approval.approver : ''}؛ ${pend.waiting}.`;
    return 'همه‌ی مراحل لازم طبق قاعده‌ها تأیید شده‌اند.';
  }

  // ───────── امکان‌سنجی (F-PC-006) ─────────

  get asOfDate(): Date {
    return new Date(SHOP_NOW.getTime() + this.asOfDays * DAY_MS);
  }

  get asOfIso(): string {
    return this.isoDate(this.asOfDate);
  }

  onAsOf(): void {
    this.analyseFeasibility();
    this.feas$.next();
  }

  jumpToReady(): void {
    if (!this.readyIso) return;
    const d = Math.ceil((new Date(this.readyIso).getTime() - SHOP_NOW.getTime()) / DAY_MS);
    this.asOfDays = Math.max(0, Math.min(30, d));
    this.onAsOf();
  }

  private analyseFeasibility(): void {
    const f = this.feas;
    const v = this.selected;
    this.matViews = [];
    this.axisMarks = [];
    this.proposedIso = null;
    this.readyIso = null;
    if (!v || !f) {
      this.feasVerdict = this.feasLoading ? 'در حال محاسبه…' : 'امکان‌سنجی در دسترس نیست.';
      this.feasTone = 'warning';
      return;
    }
    if (!f.summary?.versionId) {
      this.feasVerdict = `برای ${v.r.productCode} — ${v.r.productTitle} نسخه‌ی تولید فعال (ساختار + روش) وجود ندارد؛ نیاز مواد و ظرفیت قابل محاسبه نیست. پیش از تأیید، مهندسی تولید باید ساختار و نسخه را تعریف کند (FRM-PE-02، FRM-ME-08).`;
      this.feasTone = 'danger';
      return;
    }
    const asOf = this.asOfDate.getTime();
    let ready = SHOP_NOW.getTime();
    let never = false;
    this.matViews = f.materials.map((m) => {
      const avail = Math.max(0, m.available);
      const arrives = m.lastArrival ? new Date(m.lastArrival).getTime() : null;
      const byDate = avail + (arrives !== null && arrives <= asOf ? m.inTransit : 0);
      const short = Math.max(0, m.required - byDate);
      let state: MatView['state'] = 'ok';
      let coverIso: string | null = null;
      if (m.required > avail) {
        if (avail + m.inTransit >= m.required && m.lastArrival) {
          coverIso = m.lastArrival;
          ready = Math.max(ready, arrives as number);
          state = short > 0 ? 'transit' : 'covered';
        } else {
          state = 'short';
          never = true;
        }
      }
      const scale = Math.max(m.required, avail + m.inTransit, 1e-9);
      return { m, byDate, short, coverIso, state, availPct: (100 * avail) / scale, transitPct: (100 * m.inTransit) / scale, reqPct: Math.min(99, (100 * m.required) / scale) };
    });
    const leadMs = (f.summary.leadTimeHours ?? 24) * 3600000;
    const start = Math.max(asOf, ready);
    const proposed = start + leadMs;
    this.readyIso = ready > SHOP_NOW.getTime() ? new Date(ready).toISOString() : null;
    this.proposedIso = never ? null : new Date(proposed).toISOString();
    const need = v.r.needDate ? new Date(v.r.needDate).getTime() : null;

    const shortNow = this.matViews.filter((x) => x.short > 0);
    if (never) {
      this.feasVerdict = `حتی با محموله‌های در راه، ${this.matViews.filter((x) => x.state === 'short').map((x) => x.m.productTitle).join('، ')} کافی نیست — تأمین خرید لازم است.`;
      this.feasTone = 'danger';
    } else if (shortNow.length) {
      this.feasVerdict = `در ${faDay(this.asOfIso)}: کسری ${shortNow.map((x) => `${x.m.productTitle} ${faNum(x.short)} ${x.m.unit}`).join('، ')}. با رسیدن محموله در ${faDay(this.readyIso)} رفع می‌شود؛ تاریخ تحقق پیشنهادی ${faDateTime(this.proposedIso)}` +
        (need !== null && proposed > need ? ` — ${faInt(Math.ceil((proposed - need) / DAY_MS))} روز دیرتر از تاریخ نیاز.` : '.');
      this.feasTone = need !== null && proposed > need ? 'danger' : 'warning';
    } else {
      this.feasVerdict = `همه‌ی مواد در ${faDay(this.asOfIso)} کافی است؛ با ${faInt(f.summary.batchCount ?? 1)} بچ و زمان مبنای ${faNum(f.summary.leadTimeHours)} ساعت، تحقق ${faDateTime(this.proposedIso)}` +
        (need !== null && proposed > need ? ` — دیرتر از تاریخ نیاز (${faDay(v.r.needDate)}).` : need !== null ? ` — ${faInt(Math.floor((need - proposed) / DAY_MS))} روز پیش از تاریخ نیاز.` : '.');
      this.feasTone = need !== null && proposed > need ? 'danger' : 'success';
    }

    /* محور زمانی: اکنون، تاریخ مبنا، رسیدن محموله‌ها، نیاز، تحقق پیشنهادی */
    const pts: { t: number; cls: string; icon: string; label: string }[] = [
      { t: SHOP_NOW.getTime(), cls: 'now', icon: 'pi pi-clock', label: 'اکنون' },
    ];
    if (this.asOfDays > 0) pts.push({ t: asOf, cls: 'asof', icon: 'pi pi-calendar', label: `مبنا ${faDay(this.asOfIso)}` });
    for (const x of this.matViews.filter((m) => m.coverIso)) pts.push({ t: new Date(x.coverIso as string).getTime(), cls: 'arr', icon: 'pi pi-truck', label: `${x.m.productTitle} ${faDay(x.coverIso)}` });
    if (need !== null) pts.push({ t: need, cls: 'need', icon: 'pi pi-flag', label: `نیاز ${faDay(v.r.needDate)}` });
    if (!never) pts.push({ t: proposed, cls: need !== null && proposed > need ? 'late' : 'prop', icon: 'pi pi-check-circle', label: `تحقق ${faDay(this.proposedIso)}` });
    const lo = Math.min(...pts.map((p) => p.t));
    const hi = Math.max(...pts.map((p) => p.t)) + DAY_MS / 2;
    this.axisMarks = pts.map((p) => ({ pos: 3 + (94 * (p.t - lo)) / (hi - lo), cls: 'pc1-axis__mark--' + p.cls, icon: p.icon, label: p.label }));
  }

  matStateLabel(s: MatView['state']): string {
    return s === 'ok' ? 'کافی' : s === 'covered' ? 'با محموله‌ی رسیده' : s === 'transit' ? 'در راه' : 'کسری';
  }

  matStateTone(s: MatView['state']): Tone {
    return s === 'ok' ? 'success' : s === 'covered' ? 'info' : s === 'transit' ? 'warning' : 'danger';
  }

  // ───────── تجمیع و تفکیک (F-PC-004) ─────────

  private buildGraph(): void {
    const rowH = 38;
    const linkedOrders = this.orders.filter((o) => o.requestNumbers.length);
    const reqs = this.views.filter((v) => v.orders.length || v.r.statusCode >= 3);
    this.graphReqs = reqs.map((v, i) => ({ v, y: i * rowH + 4, hi: false }));
    this.graphOrders = linkedOrders.map((o, i) => ({
      o, y: i * rowH + 4, hi: false,
      kind: o.requestNumbers.length > 1 ? 'تجمیعی' : (this.orders.filter((x) => x.requestNumbers.includes(o.requestNumbers[0])).length > 1 ? 'تفکیکی' : ''),
    }));
    this.graphHeight = Math.max(this.graphReqs.length, this.graphOrders.length) * rowH + 4;
    this.linkSentences = [];
    for (const g of this.graphOrders.filter((x) => x.o.requestNumbers.length > 1))
      this.linkSentences.push(`تجمیع: ${g.o.requestNumbers.join(' + ')} ← ${g.o.number} (${faNum(g.o.quantity)} ${g.o.unit})`);
    for (const v of this.views.filter((x) => x.orders.length > 1))
      this.linkSentences.push(`تفکیک: ${v.r.number} → ${v.orders.map((x) => `${x.o.number} (${faNum(x.o.quantity)})`).join('، ')}`);
    this.markGraph();
  }

  private markGraph(): void {
    const sel = this.selected?.r.number;
    for (const g of this.graphReqs) g.hi = g.v.r.number === sel;
    for (const g of this.graphOrders) g.hi = !!sel && g.o.requestNumbers.includes(sel);
    this.graphLinks = [];
    const h = this.graphHeight || 1;
    for (const g of this.graphOrders) {
      for (const n of g.o.requestNumbers) {
        const rq = this.graphReqs.find((x) => x.v.r.number === n);
        if (!rq) continue;
        const y1 = ((rq.y + 15) / h) * 100;
        const y2 = ((g.y + 15) / h) * 100;
        this.graphLinks.push({ d: `M 64 ${y1} C 50 ${y1}, 50 ${y2}, 36 ${y2}`, hi: n === sel });
      }
    }
  }

  get unlinkedApproved(): RequestView[] {
    return this.views.filter((v) => v.r.statusCode === 3 && !v.orders.length);
  }

  // ───────── نمایش ─────────

  statusTone(code: number): Tone {
    return code === 1 ? 'secondary' : code === 2 ? 'warning' : code === 3 ? 'info' : code === 4 ? 'contrast' : code === 5 ? 'success' : 'danger';
  }

  get kpis(): { label: string; value: string; meta: string; cls: string }[] {
    const pend = this.views.filter((v) => v.r.statusCode === 2).length;
    const noWo = this.unlinkedApproved.length;
    const infeasible = this.views.filter((v) => v.issues.some((i) => i.startsWith('نسخه‌ی تولید'))).length;
    const urgent = this.views.filter((v) => v.r.statusCode < 5 && v.daysToNeed !== null && v.daysToNeed <= 2).length;
    return [
      { label: 'درخواست باز', value: faInt(this.views.filter((v) => v.r.statusCode < 5).length), meta: `از ${faInt(this.views.length)} درخواست`, cls: '' },
      { label: 'منتظر تأیید', value: faInt(pend), meta: pend ? this.views.filter((v) => v.r.statusCode === 2).map((v) => v.r.number).join('، ') : 'صف خالی', cls: pend ? 'gng-stat-card--warning' : 'gng-stat-card--success' },
      { label: 'تأییدشده بدون دستور', value: faInt(noWo), meta: noWo ? this.unlinkedApproved.map((v) => v.r.number).join('، ') : '—', cls: noWo ? 'gng-stat-card--danger' : 'gng-stat-card--success' },
      { label: 'غیرقابل اجرا', value: faInt(infeasible), meta: 'بدون نسخه‌ی تولید فعال', cls: infeasible ? 'gng-stat-card--danger' : 'gng-stat-card--success' },
      { label: 'نیاز تا ۲ روز', value: faInt(urgent), meta: 'درخواست باز نزدیک موعد', cls: urgent ? 'gng-stat-card--warning' : '' },
    ];
  }

  get contextLabel(): string {
    return this.selected ? `${this.selected.r.number} — ${this.selected.r.productTitle}` : 'درخواست تولید';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const n = this.views.filter((v) => v.issues.length && v.r.statusCode < 5).length;
    return n ? (this.views.some((v) => v.issues.some((i) => i.startsWith('نسخه') || i.startsWith('تأییدشده'))) ? 'danger' : 'warning') : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc01_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن درخواست‌ها و امکان‌سنجی…';
    const bad = this.views.filter((v) => v.issues.length && v.r.statusCode < 5);
    if (!bad.length) return `${faInt(this.views.length)} درخواست؛ همه در مسیر عادی.`;
    return bad.map((v) => `${v.r.number}: ${v.issues.join('، ')}`).join(' · ');
  }

  orderPct(o: LinkedOrder): number {
    return o.ops.length ? o.ops.reduce((s, x) => s + x.pct, 0) / o.ops.length : 0;
  }

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
