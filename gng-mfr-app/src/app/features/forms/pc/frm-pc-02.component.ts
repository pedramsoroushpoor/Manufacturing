import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  MATERIAL_STATUS, OP_STATUS, OUTPUT_TYPE, PRIORITY, SHOP_NOW, Tone, WO_STATUS, WO_TYPE, code39Bars,
  faDateTime, faDay, faDuration, faInt, faNum, faPct, faTime, minutesAgo, opStatusTone, priorityTone, woStatusTone,
} from './pc-shared';
import {
  CHANGE_STATUS, HOUR_MS, MATERIAL_DISPOSITION, OP_NATURE, Pc02Bundle, WORK_DISPOSITION, WO_BASIS, WO_TYPE_ICON,
  WoCancellation, WoChange, WoMaterial, WoOperation, WoProduct, WorkOrder,
} from './frm-pc-02.data';
import { FrmPc02Service } from './frm-pc-02.service';

interface OrderView {
  o: WorkOrder;
  pct: number;
  flags: { icon: string; text: string; tone: Tone }[];
}

interface MatRow {
  m: WoMaterial;
  need: number;
  toKit: number;
  free: number;
  others: number;
  short: number;
  state: 'ok' | 'transit' | 'short' | 'customer' | 'settled' | 'qs';
  availPct: number;
  transitPct: number;
}

interface GanttRow {
  op: WoOperation;
  planRight: number;
  planWidth: number;
  actRight: number;
  actWidth: number;
  pauseRight: number;
  pauseWidth: number;
  cls: string;
  delay: number | null;
  pct: number;
}

interface FamilyNode {
  o: WorkOrder;
  depth: number;
  relation: string;
  warn: string;
}

/**
 * FRM-PC-02 — «دستور کار»: کابین دستورهای کار با فیلتر نوع/وضعیت و جست‌وجو.
 *
 * برای دستور انتخابی: اطلاعات کلی (نوع، مبنا، اولویت، نسخه‌ی انتخاب‌شده با دلیل و بازنویسی، زمان‌بندی معکوس از تاریخ تحویل)،
 * گانت برنامه/واقعی عملیات حول «اکنونِ کارگاه» (برون‌سپاری و توقف متمایز)، نیاز مواد با تفکیک موجود/رزرو/در راه/کسری و
 * شبیه‌ساز تغییر مقدار، خروجی‌ها (اصلی/هم‌زاد/جانبی/ضایعات/بازیابی)، بچ با بارکد، نوار دستورهای شیفتی با تحویل WIP،
 * درخت والد-فرزند (نیمه‌ساخته، دوباره‌کاری، بازیافت) و تاریخچه‌ی تغییر و ابطال.
 *
 * فاز اول: F-PC-007، 008، 009، 011، 012، 013، 014، 016، 017، 018، 019 (فقط نمایش). صدور (تکی/گروهی/خودکار نیمه‌ساخته، 010 و 011)،
 * تغییر و تأیید آن، ابطال، تقسیم/ادغام (015) و بازنویسی نسخه با فاز ایجاد/ویرایش می‌آیند.
 */
@Component({
  selector: 'gng-frm-pc-02',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, InputTextModule, SliderModule, TabViewModule, TableModule, TagModule, TooltipModule,
    OperationalFormLayoutComponent, DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pc-02.component.html',
  styles: [`
    .pc2-chip { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; padding: 0.05rem 0.45rem; border-radius: 999px;
      background: var(--gng-bg); border: 1px solid var(--gng-border); margin: 0.15rem 0 0 0.25rem; cursor: default; }
    .pc2-chip--on { background: var(--gng-primary); color: #fff; border-color: var(--gng-primary); }
    .pc2-chip--danger { color: var(--gng-danger); border-color: var(--gng-danger); }
    .pc2-chip--warning { color: var(--gng-warning); border-color: var(--gng-warning); }
    .pc2-chip--info { color: var(--gng-info); border-color: var(--gng-info); }
    .pc2-chip--success { color: var(--gng-success); border-color: var(--gng-success); }
    .pc2-chip--contrast, .pc2-chip--secondary { color: var(--gng-text-muted); }
    .pc2-filter { display: flex; flex-wrap: wrap; margin: 0.35rem 0; }
    .pc2-filter .pc2-chip { cursor: pointer; }
    .pc2-item { padding: 0.45rem 0.5rem; border-radius: 8px; cursor: pointer; border: 1px solid transparent; font-size: 0.79rem; border-inline-start: 3px solid transparent; }
    .pc2-item:hover { background: var(--gng-bg); }
    .pc2-item--sel { border-color: var(--gng-primary); background: var(--gng-bg); }
    .pc2-item--p3 { border-inline-start-color: var(--gng-danger); } .pc2-item--p2 { border-inline-start-color: var(--gng-warning); }
    .pc2-mini { height: 5px; background: var(--gng-border); border-radius: 3px; overflow: hidden; margin-top: 0.25rem; }
    .pc2-mini div { height: 100%; background: var(--gng-info); margin-inline-start: auto; }
    .pc2-bar { position: relative; height: 12px; background: var(--gng-bg); border: 1px solid var(--gng-border); border-radius: 6px; overflow: hidden; }
    .pc2-bar__seg { position: absolute; top: 0; bottom: 0; }
    .pc2-ok { background: var(--gng-success); } .pc2-transit { background: repeating-linear-gradient(45deg, var(--gng-info), var(--gng-info) 4px, transparent 4px, transparent 7px); }
    .pc2-gantt { position: relative; border: 1px solid var(--gng-border); border-radius: var(--gng-radius); padding: 0.4rem 0; }
    .pc2-grow { display: grid; grid-template-columns: 13rem 1fr; align-items: center; min-height: 34px; border-bottom: 1px dashed var(--gng-border); }
    .pc2-grow__label { font-size: 0.76rem; padding: 0 0.5rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .pc2-track { position: relative; height: 26px; }
    .pc2-plan { position: absolute; top: 2px; height: 8px; border: 1.5px dashed var(--gng-text-muted); border-radius: 3px; }
    .pc2-act { position: absolute; top: 12px; height: 12px; border-radius: 3px; background: var(--gng-info); }
    .pc2-act--done { background: var(--gng-success); } .pc2-act--paused { background: var(--gng-danger); }
    .pc2-act--out { background: repeating-linear-gradient(45deg, var(--gng-purple), var(--gng-purple) 5px, rgba(139,92,246,.45) 5px, rgba(139,92,246,.45) 10px); }
    .pc2-pause { position: absolute; top: 12px; height: 12px; background: repeating-linear-gradient(45deg, var(--gng-danger), var(--gng-danger) 3px, transparent 3px, transparent 6px); opacity: .7; }
    .pc2-now { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--gng-danger); z-index: 2; }
    .pc2-now span { position: absolute; top: -1.1rem; transform: translateX(50%); font-size: 0.68rem; color: var(--gng-danger); white-space: nowrap; }
    .pc2-ticks { position: relative; height: 1.2rem; font-size: 0.66rem; color: var(--gng-text-muted); }
    .pc2-ticks span { position: absolute; transform: translateX(50%); white-space: nowrap; }
    .pc2-types { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .pc2-type { font-size: 0.74rem; padding: 0.25rem 0.55rem; border-radius: 8px; border: 1px solid var(--gng-border); color: var(--gng-text-muted); }
    .pc2-type--on { border-color: var(--gng-primary); color: var(--gng-primary); font-weight: 700; background: rgba(59,130,246,.07); }
    .pc2-shifts { display: grid; grid-template-columns: repeat(3, 1fr) ; gap: 0; align-items: stretch; }
    .pc2-shift { border: 1px solid var(--gng-border); padding: 0.6rem; background: var(--gng-surface); position: relative; cursor: pointer; }
    .pc2-shift--sel { outline: 2px solid var(--gng-primary); z-index: 1; }
    .pc2-shift__wip { font-size: 0.72rem; color: var(--gng-purple); margin-top: 0.35rem; }
    .pc2-tree-row { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.4rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
    .pc2-tree-row:hover { background: var(--gng-bg); }
    .pc2-tree-row--sel { background: rgba(59,130,246,.1); }
    .pc2-tree-indent { border-inline-start: 2px solid var(--gng-border); height: 1.4rem; }
    .pc2-barcode { background: #fff; padding: 0.4rem; border: 1px solid var(--gng-border); border-radius: 6px; display: inline-block; }
    .pc2-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; margin-bottom: 0.6rem; }
    .pc2-stamp { font-size: 0.72rem; color: var(--gng-text-muted); }
    @media (max-width: 1100px) { .pc2-kpis { grid-template-columns: repeat(2, 1fr); } .pc2-shifts { grid-template-columns: 1fr; } }
  `],
})
export class FrmPc02Component implements OnInit {
  data: Pc02Bundle = { orders: [], operations: [], materials: [], products: [], changes: [], cancellations: [] };
  views: OrderView[] = [];
  filtered: OrderView[] = [];
  selected: OrderView | null = null;
  search = '';
  typeFilter: number | null = null;
  statusFilter: number | null = null;
  typesPresent: number[] = [];
  statusesPresent: number[] = [];
  activeTab = 0;

  /* نمای دستور انتخابی */
  ops: WoOperation[] = [];
  gantt: GanttRow[] = [];
  ticks: { pos: number; label: string }[] = [];
  nowPos = -1;
  qtyFactor = 100;
  matRows: MatRow[] = [];
  outputs: { code: number; title: string; rows: WoProduct[] }[] = [];
  changes: WoChange[] = [];
  cancellation: WoCancellation | null = null;
  family: FamilyNode[] = [];
  shiftOrders: { o: WorkOrder; wip: number; produced: number; timePct: number; qtyPct: number; inWip: string }[] = [];
  barcode = { bars: [] as { x: number; w: number }[], total: 1 };
  inputBatches: { product: string; batch: string; potency: number | null; customer: boolean; recovered: boolean; substitute: string }[] = [];
  schedule = { remainingStd: 0, latestStart: null as string | null, slackMin: null as number | null };

  readonly companyId = DEMO_COMPANY_ID;
  readonly WO_TYPE = WO_TYPE;
  readonly WO_STATUS = WO_STATUS;
  readonly WO_BASIS = WO_BASIS;
  readonly WO_TYPE_ICON = WO_TYPE_ICON;
  readonly PRIORITY = PRIORITY;
  readonly OP_STATUS = OP_STATUS;
  readonly OP_NATURE = OP_NATURE;
  readonly MATERIAL_STATUS = MATERIAL_STATUS;
  readonly CHANGE_STATUS = CHANGE_STATUS;
  readonly MATERIAL_DISPOSITION = MATERIAL_DISPOSITION;
  readonly WORK_DISPOSITION = WORK_DISPOSITION;
  readonly allTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  readonly faNum = faNum;
  readonly faInt = faInt;
  readonly faPct = faPct;
  readonly faDay = faDay;
  readonly faTime = faTime;
  readonly faDateTime = faDateTime;
  readonly faDuration = faDuration;
  readonly woStatusTone = woStatusTone;
  readonly opStatusTone = opStatusTone;
  readonly priorityTone = priorityTone;
  loading = false;
  loadFailed = false;

  constructor(private pc02: FrmPc02Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.pc02.bundle(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.views = b.orders.map((o) => this.buildView(o)).sort((a, b2) => b2.o.number.localeCompare(a.o.number));
        this.typesPresent = [...new Set(b.orders.map((o) => o.typeCode))].sort((a, c) => a - c);
        this.statusesPresent = [...new Set(b.orders.map((o) => o.statusCode))].sort((a, c) => a - c);
        this.applyFilter();
        this.loading = false;
        this.select(this.views.find((v) => v.o.number === 'WO-1405-0506') ?? this.views.find((v) => v.flags.length) ?? this.views[0] ?? null);
      },
      error: (err) => {
        console.warn('[FRM-PC-02] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  // ───────── فهرست و پرچم‌ها ─────────

  private opsOf(id: number): WoOperation[] {
    return this.data.operations.filter((x) => x.workOrderId === id).sort((a, b) => a.sequence - b.sequence);
  }

  private orderPct(o: WorkOrder): number {
    const ops = this.opsOf(o.id);
    if (o.statusCode >= 4 && o.statusCode !== 6 && o.statusCode !== 7) return 100;
    return ops.length ? ops.reduce((s, x) => s + (x.toComplete ? Math.min(1, x.completed / x.toComplete) : 0), 0) * (100 / ops.length) : 0;
  }

  private buildView(o: WorkOrder): OrderView {
    const flags: OrderView['flags'] = [];
    for (const op of this.opsOf(o.id).filter((x) => x.statusCode === 4))
      flags.push({ icon: 'pi pi-pause-circle', tone: 'danger', text: `عملیات ${faInt(op.sequence)} ${op.title} متوقف${op.end ? ' از ' + faDateTime(op.end) + ' (' + faDuration(minutesAgo(op.end)) + ')' : ''}${op.description ? ' — ' + op.description : ''}` });
    if (o.statusCode <= 3) {
      const short = this.materialRows(o, 1).filter((r) => r.state === 'short' || r.state === 'transit');
      if (short.length)
        flags.push({ icon: 'pi pi-box', tone: short.some((r) => r.state === 'short') ? 'danger' : 'warning', text: `کسری ${short.map((r) => `${r.m.productTitle} ${faNum(r.short)} ${r.m.unit}`).join('، ')}` });
    }
    if (o.versionOverridden) flags.push({ icon: 'pi pi-user-edit', tone: 'warning', text: `نسخه‌ی ${o.versionCode} دستی بازنویسی شد: ${o.overrideReason}` });
    for (const c of this.data.changes.filter((x) => x.workOrderId === o.id && x.statusCode === 1))
      flags.push({ icon: 'pi pi-clock', tone: 'warning', text: `تغییر ${c.field} ${c.oldValue} ← ${c.newValue} منتظر تأیید` });
    if (o.statusCode < 4 && o.dueDate && o.plannedComplete && o.plannedComplete > o.dueDate)
      flags.push({ icon: 'pi pi-calendar-times', tone: 'danger', text: `تکمیل برنامه‌ای ${faDateTime(o.plannedComplete)} بعد از موعد ${faDateTime(o.dueDate)}` });
    if (o.statusCode < 4 && o.dueDate && o.dueDate < SHOP_NOW.toISOString()) flags.push({ icon: 'pi pi-exclamation-circle', tone: 'danger', text: 'موعد تحویل گذشته' });
    if (o.statusCode === 6) flags.push({ icon: 'pi pi-ban', tone: 'secondary', text: 'باطل‌شده' });
    if (o.statusCode <= 2 && o.description.includes('ظرفیت')) flags.push({ icon: 'pi pi-gauge', tone: 'warning', text: o.description });
    return { o, pct: this.orderPct(o), flags };
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = this.views.filter(
      (v) =>
        (this.typeFilter === null || v.o.typeCode === this.typeFilter) &&
        (this.statusFilter === null || v.o.statusCode === this.statusFilter) &&
        (!q || [v.o.number, v.o.name, v.o.productCode, v.o.productTitle, v.o.batchNumber, v.o.customer, v.o.requests, v.o.line].join(' ').toLowerCase().includes(q))
    );
  }

  setType(c: number | null): void {
    this.typeFilter = this.typeFilter === c ? null : c;
    this.applyFilter();
  }

  setStatus(c: number | null): void {
    this.statusFilter = this.statusFilter === c ? null : c;
    this.applyFilter();
  }

  countType(c: number): number {
    return this.views.filter((v) => v.o.typeCode === c).length;
  }

  countStatus(c: number): number {
    return this.views.filter((v) => v.o.statusCode === c).length;
  }

  select(v: OrderView | null): void {
    this.selected = v;
    if (!v) return;
    const o = v.o;
    this.ops = this.opsOf(o.id);
    this.qtyFactor = 100;
    this.matRows = this.materialRows(o, 1);
    this.buildGantt();
    this.outputs = [1, 2, 3, 4, 5]
      .map((code) => ({ code, title: OUTPUT_TYPE[code], rows: this.data.products.filter((p) => p.workOrderId === o.id && p.typeCode === code) }))
      .filter((g) => g.rows.length);
    this.changes = this.data.changes.filter((c) => c.workOrderId === o.id);
    this.cancellation = this.data.cancellations.find((c) => c.workOrderId === o.id) ?? null;
    this.buildFamily(o);
    this.buildShifts(o);
    this.barcode = code39Bars(o.batchNumber || o.number);
    this.inputBatches = this.data.materials
      .filter((m) => m.workOrderId === o.id && (m.batch || m.customer || m.substitutedTitle))
      .map((m) => ({ product: `${m.productCode} — ${m.productTitle}`, batch: m.batch, potency: m.potency, customer: m.customer, recovered: m.recovered, substitute: m.substitutedTitle }));
    /* زمان‌بندی معکوس از موعد تحویل (F-PC-013) */
    const remaining = this.ops.filter((x) => x.statusCode !== 5).reduce((s, x) => s + x.stdMinutes * (x.toComplete ? 1 - Math.min(1, x.completed / x.toComplete) : 1), 0);
    const latest = o.dueDate ? new Date(new Date(o.dueDate).getTime() - remaining * 60000) : null;
    const from = Math.max(SHOP_NOW.getTime(), o.plannedRelease ? new Date(o.plannedRelease).getTime() : 0);
    this.schedule = {
      remainingStd: remaining,
      latestStart: latest ? latest.toISOString() : null,
      slackMin: latest && o.statusCode < 4 ? Math.round((latest.getTime() - from) / 60000) : null,
    };
  }

  selectById(id: number | null): void {
    const v = this.views.find((x) => x.o.id === id);
    if (v) this.select(v);
  }

  // ───────── مواد (F-PC-014) ─────────

  /** کسری با منطق mes.GetReleaseChecks: رزرو فقط برای دستور برنامه‌ای کم می‌شود */
  private materialRows(o: WorkOrder, factor: number): MatRow[] {
    const open = new Set(this.data.orders.filter((x) => x.statusCode <= 3 && x.id !== o.id).map((x) => x.id));
    return this.data.materials
      .filter((m) => m.workOrderId === o.id)
      .sort((a, b) => a.operationSeq - b.operationSeq || a.productCode.localeCompare(b.productCode))
      .map((m) => {
        const need = m.plannedKit * factor;
        const toKit = Math.max(0, need - (m.actualKit ?? 0));
        const free = Math.max(0, m.stockAvailable + (o.statusCode >= 2 ? m.stockReserved : 0));
        const others = this.data.materials
          .filter((x) => x.productId === m.productId && open.has(x.workOrderId))
          .reduce((s, x) => s + Math.max(0, x.plannedKit - (x.actualKit ?? 0)), 0);
        const short = Math.max(0, toKit - free);
        let state: MatRow['state'] = 'ok';
        if (o.statusCode >= 4) state = 'settled';
        else if (m.quantumSatis || (m.plannedKit === 0 && !m.actualKit)) state = 'qs';
        else if (m.customer && toKit > 0) state = 'customer';
        else if (short > 0) {
          /* در راه فقط وقتی کافی است که پیش از پایان برنامه‌ای دستور برسد */
          const deadline = o.plannedComplete ?? o.dueDate;
          state = short <= m.stockInTransit && (!m.nextArrival || !deadline || m.nextArrival <= deadline) ? 'transit' : 'short';
        }
        const scale = Math.max(toKit, free + m.stockInTransit, 1e-9);
        return { m, need, toKit, free, others, short: state === 'short' || state === 'transit' ? short : 0, state,
          availPct: (100 * Math.min(free, scale)) / scale, transitPct: (100 * m.stockInTransit) / scale };
      });
  }

  onFactor(): void {
    if (this.selected) this.matRows = this.materialRows(this.selected.o, this.qtyFactor / 100);
  }

  get factorQty(): number {
    return this.selected ? (this.selected.o.quantity * this.qtyFactor) / 100 : 0;
  }

  get matSummary(): { ok: number; transit: number; short: number; total: number } {
    const rows = this.matRows.filter((r) => r.state !== 'qs' && r.state !== 'settled');
    return {
      ok: rows.filter((r) => r.state === 'ok' || r.state === 'customer').length,
      transit: rows.filter((r) => r.state === 'transit').length,
      short: rows.filter((r) => r.state === 'short').length,
      total: rows.length || 1,
    };
  }

  matState(r: MatRow): { label: string; tone: Tone } {
    switch (r.state) {
      case 'ok': return { label: r.toKit > 0 ? 'قابل تأمین' : 'کیت‌شده', tone: 'success' };
      case 'transit': return { label: 'منتظر محموله', tone: 'warning' };
      case 'short': return { label: 'کسری', tone: 'danger' };
      case 'customer': return { label: 'امانی مشتری', tone: 'info' };
      case 'qs': return { label: 'به مقدار لازم', tone: 'secondary' };
      default: return { label: MATERIAL_STATUS[r.m.statusCode] ?? 'تسویه', tone: 'secondary' };
    }
  }

  /** پیش‌نمایش اثر تغییر مقدارِ منتظر تأیید (F-PC-016) */
  previewChange(c: WoChange): void {
    const from = this.parseFa(c.oldValue);
    const to = this.parseFa(c.newValue);
    if (!from || !to) return;
    this.qtyFactor = Math.round((100 * to) / from);
    this.onFactor();
    this.activeTab = 1;
  }

  private parseFa(s: string): number | null {
    const latin = s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٬,\s]/g, '');
    const v = Number(latin);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  // ───────── گانت عملیات ─────────

  private buildGantt(): void {
    const ms = (s: string | null) => (s ? new Date(s).getTime() : null);
    const now = SHOP_NOW.getTime();
    const times: number[] = [];
    for (const op of this.ops) for (const t of [op.planStart, op.planEnd, op.start, op.end]) { const v = ms(t); if (v !== null) times.push(v); }
    const running = this.ops.some((x) => x.start && !x.end) || this.ops.some((x) => x.statusCode === 4);
    if (running || !times.length) times.push(now);
    let lo = Math.min(...times);
    let hi = Math.max(...times);
    const pad = Math.max((hi - lo) * 0.04, HOUR_MS / 2);
    lo -= pad;
    hi += pad;
    const pos = (t: number) => (100 * (t - lo)) / (hi - lo);
    this.nowPos = now >= lo && now <= hi ? pos(now) : -1;
    this.gantt = this.ops.map((op) => {
      const ps = ms(op.planStart);
      const pe = ms(op.planEnd);
      const as = ms(op.start);
      const ae = ms(op.end) ?? (as !== null && op.statusCode !== 5 ? now : null);
      const pausedTail = op.statusCode === 4 && op.end ? now : null;
      const cls = op.outsourced || op.statusCode === 6 ? 'pc2-act--out' : op.statusCode === 4 ? 'pc2-act--paused' : op.statusCode === 5 ? 'pc2-act--done' : '';
      return {
        op,
        planRight: ps !== null ? pos(ps) : 0,
        planWidth: ps !== null && pe !== null ? Math.max(0.6, pos(pe) - pos(ps)) : 0,
        actRight: as !== null ? pos(as) : 0,
        actWidth: as !== null && ae !== null ? Math.max(0.6, pos(ae) - pos(as)) : 0,
        pauseRight: pausedTail !== null && ae !== null ? pos(ae) : 0,
        pauseWidth: pausedTail !== null && ae !== null ? Math.max(0, pos(pausedTail) - pos(ae)) : 0,
        cls,
        delay: as !== null && ps !== null ? Math.round((as - ps) / 60000) : null,
        pct: op.toComplete ? Math.min(100, (100 * op.completed) / op.toComplete) : 0,
      };
    });
    const span = hi - lo;
    const step = span > 6 * 24 * HOUR_MS ? 24 * HOUR_MS : span > 2 * 24 * HOUR_MS ? 12 * HOUR_MS : span > 16 * HOUR_MS ? 6 * HOUR_MS : 2 * HOUR_MS;
    this.ticks = [];
    if (!(lo > 0) || span > 120 * 24 * HOUR_MS) return;
    for (let t = Math.ceil(lo / step) * step; t < hi; t += step)
      this.ticks.push({ pos: pos(t), label: step >= 24 * HOUR_MS ? faDay(new Date(t).toISOString()) : faDateTime(new Date(t).toISOString()) });
  }

  // ───────── خانواده‌ی والد-فرزند (F-PC-011) ─────────

  private buildFamily(o: WorkOrder): void {
    const byId = new Map(this.data.orders.map((x) => [x.id, x]));
    let root = o;
    const seen = new Set<number>();
    while (root.refId && byId.has(root.refId) && !seen.has(root.id)) { seen.add(root.id); root = byId.get(root.refId)!; }
    const out: FamilyNode[] = [];
    const walk = (x: WorkOrder, depth: number, parent: WorkOrder | null) => {
      let relation = 'ریشه';
      let warn = '';
      if (parent) {
        relation = x.typeCode === 3 ? `دوباره‌کاری بچ ${parent.batchNumber}` : x.typeCode === 4 ? 'بازیافت ضایعات' : `نیمه‌ساخته‌ی ${x.productTitle} برای والد`;
        const childEnd = x.actualComplete ?? x.plannedComplete;
        const parentStart = parent.actualRelease ?? parent.plannedRelease;
        if ((x.typeCode === 1 || x.typeCode === 2) && childEnd && parentStart && childEnd > parentStart)
          warn = `تکمیل فرزند ${faDateTime(childEnd)} بعد از شروع والد ${faDateTime(parentStart)} — تاریخ‌ها همگام نیستند`;
      }
      out.push({ o: x, depth, relation, warn });
      for (const c of this.data.orders.filter((y) => y.refId === x.id)) walk(c, depth + 1, x);
    };
    walk(root, 0, null);
    this.family = out;
  }

  get familyRoots(): number {
    return this.data.orders.filter((x) => !x.refId && this.data.orders.some((y) => y.refId === x.id)).length;
  }

  get allLinks(): { child: WorkOrder; parent: WorkOrder | undefined }[] {
    return this.data.orders.filter((x) => x.refId).map((x) => ({ child: x, parent: this.data.orders.find((p) => p.id === x.refId) }));
  }

  // ───────── دستور شیفتی (F-PC-018) ─────────

  private buildShifts(o: WorkOrder): void {
    const day = o.shiftDate ?? this.data.orders.find((x) => x.typeCode === 2)?.shiftDate ?? null;
    const list = this.data.orders.filter((x) => x.typeCode === 2 && x.shiftDate === day).sort((a, b) => (a.shiftId ?? 0) - (b.shiftId ?? 0));
    let prevWip = '';
    this.shiftOrders = list.map((x, i) => {
      const ops = this.opsOf(x.id);
      const wip = ops.reduce((s, op) => s + op.inProcess, 0);
      const ps = x.actualRelease ?? x.plannedRelease;
      const pe = x.plannedComplete;
      const t0 = ps ? new Date(ps).getTime() : 0;
      const t1 = pe ? new Date(pe).getTime() : 0;
      const timePct = t1 > t0 ? Math.max(0, Math.min(100, (100 * (SHOP_NOW.getTime() - t0)) / (t1 - t0))) : 0;
      const inWip = i === 0 ? (x.description.match(/[۰-۹0-9]+\s*کیلو[^،]*/)?.[0] ?? '') : prevWip;
      prevWip = wip ? `${faNum(wip)} ${x.unit} از ${x.shiftTitle || x.number}` : '';
      return { o: x, wip, produced: x.lastOpCompleted, timePct, qtyPct: x.quantity ? (100 * x.lastOpCompleted) / x.quantity : 0, inWip };
    });
  }

  // ───────── نمایش ─────────

  get kpis(): { label: string; value: string; meta: string; cls: string }[] {
    const o = this.selected?.o;
    if (!o) return [];
    const due = o.dueDate ? Math.round((new Date(o.dueDate).getTime() - SHOP_NOW.getTime()) / 60000) : null;
    const paused = this.ops.filter((x) => x.statusCode === 4).length;
    return [
      { label: 'وضعیت', value: WO_STATUS[o.statusCode], meta: o.currentOperation ? `در ${o.currentOperation}` : WO_TYPE[o.typeCode], cls: o.statusCode === 6 ? 'gng-stat-card--danger' : '' },
      { label: 'پیشرفت عملیات', value: faPct(this.selected?.pct ?? 0, 0), meta: `${faInt(o.operationsDone)} از ${faInt(o.operationCount)} عملیات تکمیل`, cls: '' },
      { label: 'تا موعد تحویل', value: due === null ? '—' : due >= 0 ? faDuration(due) : 'گذشته', meta: faDateTime(o.dueDate), cls: due !== null && due < 0 && o.statusCode < 4 ? 'gng-stat-card--danger' : '' },
      { label: 'عملیات متوقف', value: faInt(paused), meta: paused ? this.ops.filter((x) => x.statusCode === 4).map((x) => x.title).join('، ') : 'بدون توقف', cls: paused ? 'gng-stat-card--danger' : 'gng-stat-card--success' },
      { label: 'ضایعات تا اکنون', value: faNum(o.wastedTotal), meta: o.unit, cls: o.wastedTotal ? 'gng-stat-card--warning' : '' },
    ];
  }

  get contextLabel(): string {
    return this.selected ? `${this.selected.o.number} — ${this.selected.o.name}` : 'دستور کار';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const f = this.views.flatMap((v) => v.flags);
    return f.some((x) => x.tone === 'danger') ? 'danger' : f.some((x) => x.tone === 'warning') ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc02_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن دستورهای کار…';
    const parts = this.views
      .filter((v) => v.o.statusCode !== 6)
      .flatMap((v) => v.flags.filter((f) => f.tone === 'danger' || f.tone === 'warning').map((f) => `${v.o.number}: ${f.text}`));
    return parts.length ? parts.join(' · ') : `${faInt(this.views.length)} دستور کار؛ مشکلی دیده نشد.`;
  }

  readonly nowIso = SHOP_NOW.toISOString();

  get shiftDay(): string | null {
    return this.shiftOrders.length ? this.shiftOrders[0].o.shiftDate : null;
  }

  get slackNegative(): boolean {
    return (this.schedule.slackMin ?? 0) < 0;
  }

  orderNumber(id: number): string {
    return this.data.orders.find((x) => x.id === id)?.number ?? `#${id}`;
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
