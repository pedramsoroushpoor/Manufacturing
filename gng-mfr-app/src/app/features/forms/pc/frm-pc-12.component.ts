import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import {
  ALERT_CHANNEL, ALERT_SEVERITY, ALERT_STATUS, ANDON, CA_STATUS, OP_STATUS, OUTPUT_TYPE, SHOP_NOW, WO_STATUS, WO_TYPE,
  alertTone, faDateTime, faDay, faDuration, faInt, faNum, faPct, faTime, opStatusTone, woStatusTone,
} from './pc-shared';
import {
  APPROVAL_STATUS, Alert, CHANNEL_ICON, CLOSE_CHECKS, COSTING_STATUS, Cause, CloseCheck, CostingEvent, CostingMaterial, DEVIATION_TYPE, Deviation,
  EVENT_TYPE, LineKpi, Pc12Bundle, RULE_ICON, RULE_TYPE, Readiness, Station, WipRow, faClock,
} from './frm-pc-12.data';
import { FrmPc12Service } from './frm-pc-12.service';

const RING = 2 * Math.PI * 40;
const DAY = 86400000;

interface WipGroup { title: string; rows: WipRow[]; totals: { unit: string; qty: number; eq: number }[] }
interface CauseNode { cause: Cause; children: Cause[] }

/**
 * FRM-PC-12 — «کنسول پایش و بستن دستور».
 *
 * داشبورد لحظه‌ای خطوط (OEE جاری از شروع شیفت ۰۶:۰۰ = A×P×Q، دستورهای فعال با پیش‌بینی تأخیر، توقف‌های باز با
 * شمارنده‌ی زنده)، موتور استثنا (قاعده، اندازه در برابر حد، مسئول، کانال، سن و تشدید)، علت انحراف روی درخت قدیم
 * ProductionPlanDeviation با اقدام اصلاحی، WIP به تفکیک خط/دستور/عملیات، آمادگی بستن دستور با رویدادهای بستن/بازگشایی
 * و پیش‌نمایش رویداد بهای تمام‌شده، و آندون تمام‌صفحه برای مانیتور کارگاه.
 *
 * فاز اول: F-PC-091 تا F-PC-100 (نمایش زنده). تأیید/ارجاع هشدار، تعریف قاعده، ثبت علت انحراف، بستن و بازگشایی دستور،
 * اجرای بستن خودکار و ارسال رویداد به بهای تمام‌شده با فاز ایجاد/ویرایش می‌آید.
 */
@Component({
  selector: 'gng-frm-pc-12',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, CheckboxModule, DropdownModule, InputTextModule, SelectButtonModule, TabViewModule, TableModule, TagModule,
    TooltipModule, OperationalFormLayoutComponent, DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pc-12.component.html',
  styles: [`
    .pc12-line { border: 1px solid var(--gng-border); border-radius: var(--gng-radius-sm); padding: 0.55rem 0.65rem; cursor: pointer; margin-bottom: 0.45rem; background: var(--gng-surface); }
    .pc12-line--on { border-color: var(--gng-primary); box-shadow: inset -3px 0 0 var(--gng-primary); }
    .pc12-lines { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 0.9rem; }
    .pc12-lc { display: grid; grid-template-columns: 120px 1fr; gap: 1rem; align-items: center; }
    .pc12-donut text { font-weight: 800; }
    .pc12-apq { display: grid; grid-template-columns: 5.5rem 1fr 3.5rem; gap: 0.4rem; align-items: center; font-size: 0.76rem; margin-bottom: 0.3rem; }
    .pc12-counts { display: flex; gap: 0.6rem; flex-wrap: wrap; font-size: 0.74rem; margin-top: 0.4rem; }
    .pc12-tick { font-family: monospace; font-size: 1.05rem; font-weight: 700; color: var(--gng-danger); }
    .pc12-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .pc12-chip { border: 1px solid var(--gng-border); border-radius: 99px; padding: 0.2rem 0.65rem; font-size: 0.74rem; cursor: pointer; background: var(--gng-surface); }
    .pc12-chip--on { background: var(--gng-primary); color: #fff; border-color: var(--gng-primary); }
    .pc12-chip b { margin-right: 0.25rem; }
    .pc12-gauge { height: 6px; border-radius: 99px; background: var(--gng-bg); border: 1px solid var(--gng-border); position: relative; overflow: hidden; margin-top: 0.2rem; }
    .pc12-gauge__fill { position: absolute; top: 0; bottom: 0; right: 0; background: var(--gng-danger); }
    .pc12-gauge__lim { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--gng-text); }
    .pc12-row-esc { background: rgba(235, 87, 87, 0.07); }
    .pc12-tree { font-size: 0.8rem; }
    .pc12-tree__node { padding: 0.3rem 0.5rem; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; gap: 0.4rem; }
    .pc12-tree__node:hover { background: var(--gng-bg); }
    .pc12-tree__node--on { background: rgba(31, 59, 99, 0.1); font-weight: 700; }
    .pc12-tree__kids { margin-right: 1rem; border-right: 1px dashed var(--gng-border); padding-right: 0.4rem; }
    .pc12-dev { border: 1px solid var(--gng-border); border-radius: var(--gng-radius-sm); padding: 0.75rem 0.9rem; margin-bottom: 0.7rem; background: var(--gng-surface); }
    .pc12-dev--overdue { border-color: var(--gng-danger); box-shadow: inset -4px 0 0 var(--gng-danger); }
    .pc12-pva { display: flex; gap: 0.6rem; align-items: center; font-size: 0.8rem; margin: 0.35rem 0; flex-wrap: wrap; }
    .pc12-pva span { border-radius: 6px; padding: 0.1rem 0.5rem; background: var(--gng-bg); }
    .pc12-heat { height: 16px; border-radius: 4px; background: var(--gng-bg); position: relative; overflow: hidden; }
    .pc12-heat__fill { position: absolute; top: 0; bottom: 0; right: 0; }
    .pc12-wipgrp { margin-bottom: 1rem; }
    .pc12-wipgrp__head { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; border-bottom: 2px solid var(--gng-border); padding-bottom: 0.25rem; margin-bottom: 0.3rem; flex-wrap: wrap; }
    .pc12-wiprow { display: grid; grid-template-columns: 9rem 1fr 7rem 10rem 7rem; gap: 0.6rem; align-items: center; font-size: 0.78rem; padding: 0.3rem 0; border-bottom: 1px solid var(--gng-border); }
    .pc12-close { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 0.9rem; }
    .pc12-cc { border: 2px solid var(--gng-border); border-radius: var(--gng-radius-sm); padding: 0.8rem 0.9rem; cursor: pointer; background: var(--gng-surface); }
    .pc12-cc--ok { border-color: var(--gng-success); } .pc12-cc--blocked { border-color: var(--gng-danger); } .pc12-cc--closed { border-color: var(--gng-border); opacity: 0.9; }
    .pc12-cc--on { box-shadow: 0 0 0 3px rgba(31, 59, 99, 0.25); }
    .pc12-check { display: grid; grid-template-columns: 1.3rem 1fr auto; gap: 0.3rem; font-size: 0.78rem; padding: 0.15rem 0; }
    .pc12-cost { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 1100px) { .pc12-cost { grid-template-columns: 1fr; } }
    .pc12-json { max-height: 340px; overflow: auto; direction: ltr; text-align: left; white-space: pre; font-size: 0.72rem; }
    .pc12-andon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.7rem; }
    .pc12-andon-tile { min-height: 7.5rem; }
    .pc12-andon--overlap { background: #3a1238 !important; border: 2px solid #e056fd !important; animation: pc12pulse 1.4s infinite; }
    @keyframes pc12pulse { 50% { box-shadow: 0 0 0 6px rgba(224, 86, 253, 0.25); } }
    .pc12-andon-tile .gng-andon-card__status { font-size: 1.05rem; }
    .pc12-andon-bar { height: 6px; background: rgba(255,255,255,0.15); border-radius: 99px; margin-top: 0.4rem; overflow: hidden; }
    .pc12-andon-bar > div { height: 100%; background: #6fcf97; }
    .pc12-full { position: fixed; inset: 0; z-index: 3000; background: #0b0e14; color: #eef1f6; padding: 1.2rem 1.6rem; overflow: auto; display: flex; flex-direction: column; gap: 1rem; }
    .pc12-full__head { display: flex; justify-content: space-between; align-items: center; }
    .pc12-full__clock { font-family: monospace; font-size: 2.2rem; font-weight: 800; }
    .pc12-full .pc12-andon-grid { grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 1rem; }
    .pc12-full .pc12-andon-tile { min-height: 11rem; padding: 1.2rem 1.3rem; }
    .pc12-full .gng-andon-card__status { font-size: 1.7rem; }
    .pc12-full .gng-andon-card__line { font-size: 1.05rem; }
    .pc12-full .gng-andon-card__meta { font-size: 0.95rem; }
    .pc12-full__line { font-size: 1.2rem; font-weight: 800; margin: 0.3rem 0; display: flex; gap: 1rem; align-items: baseline; }
    .pc12-ticker { background: #331414; border: 1px solid rgba(235,87,87,.55); border-radius: 8px; padding: 0.6rem 1rem; font-size: 1rem; }
  `],
})
export class FrmPc12Component implements OnInit, OnDestroy {
  data: Pc12Bundle | null = null;
  loading = false;
  loadFailed = false;
  readonly companyId = DEMO_COMPANY_ID;
  activeTab = 0;
  lineFilter = 0;

  /* ساعت زنده: ساعت سناریو + زمان سپری‌شده از باز شدن فرم */
  clock = SHOP_NOW;
  private openedAt = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;

  /* استثناها */
  ruleFilter = 0;
  sevFilter = 0;
  onlyEscalated = false;
  onlyOpen = false;
  alertSearch = '';
  readonly sevOptions = [{ label: 'همه', value: 0 }, { label: 'بحرانی', value: 3 }, { label: 'هشدار', value: 2 }, { label: 'اطلاع', value: 1 }];

  /* انحراف */
  causeFilter: number | null = null;
  causeTree: CauseNode[] = [];

  /* WIP */
  wipGroupBy: 'line' | 'order' | 'op' = 'line';
  readonly wipOptions = [{ label: 'خط', value: 'line' }, { label: 'دستور', value: 'order' }, { label: 'عملیات', value: 'op' }];

  /* بستن و بهای تمام‌شده */
  costWo: number | null = null;
  costing: CostingEvent | null = null;
  costingLoading = false;
  costOptions: { label: string; value: number }[] = [];
  showJson = false;

  andonFull = false;

  readonly checks = CLOSE_CHECKS;
  readonly ring = RING;
  readonly ruleType = RULE_TYPE;
  readonly ruleIcon = RULE_ICON;
  readonly channelIcon = CHANNEL_ICON;
  readonly channel = ALERT_CHANNEL;
  readonly severity = ALERT_SEVERITY;
  readonly alertStatus = ALERT_STATUS;
  readonly alertTone = alertTone;
  readonly andon = ANDON;
  readonly caStatus = CA_STATUS;
  readonly devType = DEVIATION_TYPE;
  readonly eventType = EVENT_TYPE;
  readonly costingStatus = COSTING_STATUS;
  readonly approval = APPROVAL_STATUS;
  readonly woStatus = WO_STATUS;
  readonly woType = WO_TYPE;
  readonly woStatusTone = woStatusTone;
  readonly opStatus = OP_STATUS;
  readonly opStatusTone = opStatusTone;
  readonly outputType = OUTPUT_TYPE;
  readonly faNum = faNum;
  readonly faInt = faInt;
  readonly faPct = faPct;
  readonly faDay = faDay;
  readonly faTime = faTime;
  readonly faDateTime = faDateTime;
  readonly faDuration = faDuration;
  readonly faClock = faClock;

  constructor(private pc12: FrmPc12Service) {}

  ngOnInit(): void {
    this.timer = setInterval(() => (this.clock = new Date(SHOP_NOW.getTime() + (Date.now() - this.openedAt))), 1000);
    this.loading = true;
    this.pc12.bundle(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.loading = false;
        this.causeTree = b.causes
          .filter((c) => c.parentId === null)
          .sort((x, y) => x.sort - y.sort)
          .map((c) => ({ cause: c, children: b.causes.filter((k) => k.parentId === c.id).sort((x, y) => x.sort - y.sort) }));
        const opts = new Map<number, string>();
        for (const r of b.readiness) opts.set(r.woId, `${r.wo} — ${WO_STATUS[r.statusCode]}`);
        for (const o of b.orders) if (!opts.has(o.id)) opts.set(o.id, `${o.wo} — ${WO_STATUS[o.statusCode]}`);
        this.costOptions = [...opts.entries()].map(([value, label]) => ({ label, value }));
        const first = b.readiness.find((r) => r.statusCode === 5) ?? b.readiness[0];
        if (first) this.pickClose(first);
      },
      error: (err) => {
        console.warn('[FRM-PC-12] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.andonFull = false;
  }

  /** دقیقه‌ی سپری‌شده از ساعت سناریو تا ساعت زنده */
  get elapsedMin(): number {
    return (this.clock.getTime() - SHOP_NOW.getTime()) / 60000;
  }

  // ───────── فیلتر خط (پنل کناری) ─────────

  get lineTitle(): string {
    return this.data?.lines.find((l) => l.id === this.lineFilter)?.title ?? '';
  }

  inLine(title: string): boolean {
    return !this.lineFilter || title === this.lineTitle;
  }

  get lines(): LineKpi[] {
    return (this.data?.lines ?? []).filter((l) => !this.lineFilter || l.id === this.lineFilter);
  }

  get orders() {
    return (this.data?.orders ?? []).filter((o) => this.inLine(o.line)).sort((a, b) => b.delayMin - a.delayMin);
  }

  get stops() {
    return (this.data?.stops ?? []).filter((s) => this.inLine(s.line));
  }

  oeeDash(v: number): string {
    return `${(Math.max(0, Math.min(1, v)) * RING).toFixed(1)} ${RING.toFixed(1)}`;
  }

  oeeColor(v: number): string {
    return v >= 0.65 ? 'var(--gng-success)' : v >= 0.4 ? 'var(--gng-warning)' : 'var(--gng-danger)';
  }

  /** بزرگ‌ترین عامل افت OEE خط */
  weakest(l: LineKpi): string {
    const f = [
      { k: 'دسترس‌پذیری', v: l.a },
      { k: 'عملکرد', v: l.p },
      { k: 'کیفیت', v: l.q },
    ].sort((x, y) => x.v - y.v)[0];
    return `${f.k} ${faPct(f.v * 100, 0)}`;
  }

  // ───────── موتور استثنا (F-PC-092، 093) ─────────

  get ruleChips(): { type: number; label: string; count: number }[] {
    const all = (this.data?.alerts ?? []).filter((a) => this.inLine(a.line));
    const types = [...new Set(all.map((a) => a.ruleType))].sort((a, b) => a - b);
    return types.map((t) => ({ type: t, label: RULE_TYPE[t] ?? `نوع ${t}`, count: all.filter((a) => a.ruleType === t).length }));
  }

  liveAge(a: Alert): number {
    return a.ageMin + this.elapsedMin;
  }

  isEscalated(a: Alert): boolean {
    return a.escalated || (a.status === 1 && this.liveAge(a) > a.escMin);
  }

  isFuture(a: Alert): boolean {
    return a.ageMin < 0;
  }

  get shownAlerts(): Alert[] {
    const q = this.alertSearch.trim();
    return (this.data?.alerts ?? [])
      .filter((a) => this.inLine(a.line))
      .filter((a) => !this.ruleFilter || a.ruleType === this.ruleFilter)
      .filter((a) => !this.sevFilter || a.severity === this.sevFilter)
      .filter((a) => !this.onlyEscalated || this.isEscalated(a))
      .filter((a) => !this.onlyOpen || a.status === 1)
      .filter((a) => !q || `${a.subject} ${a.detail} ${a.wo} ${a.owner} ${a.ruleTitle}`.includes(q))
      .sort((x, y) => Number(this.isEscalated(y)) - Number(this.isEscalated(x)) || y.severity - x.severity || y.ageMin - x.ageMin);
  }

  get escalatedCount(): number {
    return (this.data?.alerts ?? []).filter((a) => this.isEscalated(a)).length;
  }

  get openCount(): number {
    return (this.data?.alerts ?? []).filter((a) => a.status === 1).length;
  }

  /** پر شدن نوار اندازه نسبت به بزرگ‌ترِ اندازه و حد؛ خط عمودی = حد */
  gauge(a: Alert): { fill: number; lim: number; over: boolean } {
    const m = Math.abs(a.measured ?? 0);
    const l = Math.abs(a.limit ?? 0);
    const max = Math.max(m, l) || 1;
    return { fill: (m / max) * 100, lim: (l / max) * 100, over: m > l };
  }

  escalationText(a: Alert): string {
    if (this.isFuture(a)) return 'زمان ایجاد در آینده — خطای داده';
    if (this.isEscalated(a)) return `تشدید شد ← ${a.escOwner}`;
    if (a.status !== 1) return 'پاسخ داده شد';
    return `تشدید به ${a.escOwner} تا ${faDuration(a.escMin - this.liveAge(a))}`;
  }

  alertCount(ruleId: number): number {
    return (this.data?.alerts ?? []).filter((a) => a.ruleId === ruleId).length;
  }

  // ───────── علت انحراف (F-PC-094) ─────────

  get deviations(): Deviation[] {
    const d = this.data?.deviations ?? [];
    if (this.causeFilter === null) return d;
    const kids = this.causeTree.find((n) => n.cause.id === this.causeFilter)?.children.map((c) => c.id) ?? [];
    return d.filter((x) => x.causeId === this.causeFilter || kids.includes(x.causeId));
  }

  nodeUsage(n: CauseNode): number {
    return n.cause.usage + n.children.reduce((s, c) => s + c.usage, 0);
  }

  isOverdue(d: Deviation): boolean {
    return !!d.caDue && d.caStatus !== 3 && new Date(d.caDue).getTime() < SHOP_NOW.getTime();
  }

  overdueDays(d: Deviation): number {
    return d.caDue ? Math.floor((SHOP_NOW.getTime() - new Date(d.caDue).getTime()) / DAY) : 0;
  }

  isRootCause(d: Deviation): boolean {
    return this.causeTree.some((n) => n.cause.id === d.causeId);
  }

  // ───────── کار در جریان (F-PC-098) ─────────

  get wipRows(): WipRow[] {
    return (this.data?.wip ?? []).filter((w) => !this.lineFilter || w.lineId === this.lineFilter);
  }

  get wipGroups(): WipGroup[] {
    const key = (w: WipRow) => (this.wipGroupBy === 'line' ? w.line : this.wipGroupBy === 'order' ? `${w.wo} — ${WO_TYPE[w.typeCode]}` : w.opTitle);
    const m = new Map<string, WipRow[]>();
    for (const w of this.wipRows) m.set(key(w), [...(m.get(key(w)) ?? []), w]);
    return [...m.entries()].map(([title, rows]) => ({ title, rows, totals: this.unitTotals(rows) }));
  }

  get wipTotals(): { unit: string; qty: number; eq: number }[] {
    return this.unitTotals(this.wipRows);
  }

  get outsourcedWip(): WipRow[] {
    return this.wipRows.filter((w) => w.outsourced);
  }

  private unitTotals(rows: WipRow[]): { unit: string; qty: number; eq: number }[] {
    const m = new Map<string, { qty: number; eq: number }>();
    for (const r of rows) {
      const x = m.get(r.unit) ?? { qty: 0, eq: 0 };
      x.qty += r.inProcess;
      x.eq += r.inProcess * r.stageFraction;
      m.set(r.unit, x);
    }
    return [...m.entries()].map(([unit, v]) => ({ unit, ...v }));
  }

  heatColor(pct: number): string {
    return pct >= 50 ? 'var(--gng-danger)' : pct >= 25 ? 'var(--gng-warning)' : 'var(--gng-info)';
  }

  // ───────── بستن دستور و بهای تمام‌شده (F-PC-096، 097، 099، 100) ─────────

  pickClose(r: Readiness): void {
    this.costWo = r.woId;
    this.loadCosting();
  }

  loadCosting(): void {
    if (!this.costWo) return;
    const id = this.costWo;
    this.costingLoading = true;
    this.pc12.costing(id, this.companyId).subscribe({
      next: (c) => {
        if (this.costWo !== id) return;
        this.costing = c;
        this.costingLoading = false;
      },
      error: () => {
        this.costing = null;
        this.costingLoading = false;
      },
    });
  }

  blockers(r: Readiness): CloseCheck[] {
    return this.checks.filter((c) => (r[c.key] as number) > 0);
  }

  checkVal(r: Readiness, c: CloseCheck): number {
    return r[c.key] as number;
  }

  closeClass(r: Readiness): string {
    return r.statusCode === 5 ? 'pc12-cc--closed' : r.canClose ? 'pc12-cc--ok' : 'pc12-cc--blocked';
  }

  eventsOf(woId: number) {
    return (this.data?.events ?? []).filter((e) => e.woId === woId);
  }

  get pendingReopens() {
    return (this.data?.events ?? []).filter((e) => e.typeCode === 3 && e.approvalCode === 1);
  }

  variancePct(m: CostingMaterial): number | null {
    return m.standard ? ((m.actual - m.standard) / m.standard) * 100 : null;
  }

  get costingJson(): string {
    return this.costing ? JSON.stringify(this.costing.raw, null, 2) : '';
  }

  get costingEventNumber(): string {
    const e = this.costing?.header ? this.eventsOf(this.costing.header.woId).find((x) => x.costingNumber) : undefined;
    return e ? `${e.costingNumber} — ${COSTING_STATUS[e.costingStatus ?? 1]}` : 'هنوز ارسال نشده (پیش‌نمایش)';
  }

  // ───────── آندون (F-PC-095) ─────────

  stationsOf(lineId: number, groups: boolean): Station[] {
    return (this.data?.stations ?? []).filter((s) => s.lineId === lineId && s.isGroup === groups).sort((a, b) => a.seqNo - b.seqNo);
  }

  andonClass(s: Station): string {
    return s.andon === 2 ? 'gng-andon-card--run' : s.andon === 4 ? 'gng-andon-card--stop' : s.andon === 3 ? 'gng-andon-card--warn' : s.andon === 5 ? 'pc12-andon--overlap' : 'gng-andon-card--idle';
  }

  stationPct(s: Station): number {
    return s.toComplete ? ((s.completed ?? 0) / s.toComplete) * 100 : 0;
  }

  stopLive(since: string | null, openMin = 0): number {
    return since ? (SHOP_NOW.getTime() - new Date(since).getTime()) / 60000 + this.elapsedMin : openMin + this.elapsedMin;
  }

  get criticalTicker(): string {
    return (this.data?.alerts ?? [])
      .filter((a) => a.severity === 3 && a.status === 1)
      .map((a) => `${a.ruleTitle}: ${a.subject}${a.wo ? ' (' + a.wo + ')' : ''}`)
      .join('  •  ');
  }

  // ───────── بنر ─────────

  get problems(): { tone: 'danger' | 'warning'; text: string }[] {
    const d = this.data;
    const out: { tone: 'danger' | 'warning'; text: string }[] = [];
    if (!d) return out;
    for (const s of d.stops) out.push({ tone: 'danger', text: `${s.wo}/${faInt(s.opSeq)} ${s.opTitle} (${s.line}) ${faDuration(s.openMin)} متوقف: ${s.description}` });
    for (const s of d.stations.filter((x) => x.andon === 5))
      out.push({ tone: 'danger', text: `هم‌پوشانی ایستگاه ${s.title} خط ${faInt(s.lineId)}: ${s.runningOrders.join(' و ')}` });
    const esc = d.alerts.filter((a) => this.isEscalated(a));
    if (esc.length) out.push({ tone: 'danger', text: `${faInt(esc.length)} هشدار بی‌پاسخ تشدید شد (${esc.map((a) => a.ruleCode).join('، ')})` });
    for (const x of d.deviations.filter((v) => this.isOverdue(v)))
      out.push({ tone: 'danger', text: `اقدام اصلاحی ${x.caRef || x.caTitle} ${faInt(this.overdueDays(x))} روز از موعد گذشته` });
    for (const r of d.readiness.filter((x) => x.statusCode !== 5 && !x.canClose))
      out.push({ tone: 'warning', text: `${r.wo} قابل بستن نیست: ${this.blockers(r).map((c) => c.label).join('، ')}` });
    for (const e of this.pendingReopens) out.push({ tone: 'warning', text: `درخواست بازگشایی ${e.wo} منتظر تأیید ${e.approver}` });
    for (const l of d.lines.filter((x) => x.oee < 0.4)) out.push({ tone: 'warning', text: `OEE ${l.title} ${faPct(l.oee * 100, 0)} (${this.weakest(l)})` });
    return out;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const p = this.problems;
    return p.some((x) => x.tone === 'danger') ? 'danger' : p.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc12_setup.sql را بررسی کنید.';
    if (this.loading || !this.data) return 'در حال خواندن…';
    const p = this.problems;
    return p.length ? p.map((x) => x.text).join('؛ ') + '.' : 'همه‌ی خطوط بدون توقف و استثنای باز.';
  }

  get contextLabel(): string {
    return `${this.lineFilter ? this.lineTitle : 'همه‌ی خطوط'} · ${faTime(this.clock.toISOString())}`;
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
