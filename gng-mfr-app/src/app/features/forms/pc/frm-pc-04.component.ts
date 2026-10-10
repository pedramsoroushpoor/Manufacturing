import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
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
  OP_STATUS, REPORT_SOURCE, SHOP_NOW, Tone, WO_STATUS, WO_TYPE, faDateTime, faDay, faDuration, faInt, faNum, faPct, faTime, opStatusTone, woStatusTone,
} from './pc-shared';
import {
  CapacityRow, LaborRow, OpRow, PLAUSIBLE_PER_HOUR, Pc04Bundle, ReportRow, SOURCE_CLASS, ShiftRow, Tick, TimeBlock, WasteRow, WipRow, WoRow, ms,
} from './frm-pc-04.data';
import { FrmPc04Service } from './frm-pc-04.service';

interface Lane { op: OpRow; blocks: TimeBlock[]; plan: TimeBlock | null; }
interface OpQty { op: OpRow; good: number; waste: number; rework: number; rest: number; yieldPct: number | null; }
interface ParetoRow { reason: string; parent: string; qty: number; pct: number; cum: number; setup: boolean; material: boolean; }
interface ResRow {
  seq: number; opTitle: string; title: string; unit: string; qty: number; std: number | null; variance: number | null;
  barRight: number; barWidth: number; tone: string; sources: string; implausible: string;
}
interface ShiftCard {
  s: ShiftRow; window: string; reports: number; produced: { wo: string; qty: number; unit: string }[]; wip: WipRow[]; open: boolean; remain: string;
}
interface Assignment { labor: LaborRow; report: ReportRow; s: number; e: number; }
interface LoadSeg { right: number; width: number; load: number; from: number; to: number; items: string; }
interface PersonRow { code: string; name: string; rows: number; minutes: number; maxLoad: number; conflicts: number; shared: number; }
interface ForecastRow {
  op: OpRow; wo: WoRow; rate: number | null; basis: string; remaining: number; ownEta: number; eta: number; chained: boolean;
  tone: Tone; verdict: string; stopped: boolean;
}

/**
 * FRM-PC-04 — «گزارش تولید»: گزارش‌های سطح عملیات، مقادیر تولید/ضایعات/دوباره‌کاری، کارکرد منابع،
 * گزارش و تحویل شیفت، تسهیم کارکرد اپراتور چندکاره و پیش‌بینی تکمیل.
 *
 * فاز اول (فقط‌خواندنی): F-PC-031، 032، 033، 034، 041 (M) و 042، 043 (S) — خط زمانی گزارش‌ها به تفکیک
 * منبع ثبت، Pareto ضایعات، انحراف کارکرد از استاندارد با کشف داده‌ی نامعقول، زنجیره‌ی تحویل شیفت، کشف
 * هم‌پوشانی زمانی اپراتور، و پیش‌بینی پایان با شبیه‌ساز نرخ و تأخیر ازسرگیری.
 * هنوز پیاده نشده: ثبت/اصلاح گزارش، ثبت کارکرد و تسهیم، ثبت و تحویل شیفت، تأیید مدیر و سند معکوس.
 */
@Component({
  selector: 'gng-frm-pc-04',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, DropdownModule, InputTextModule, SliderModule, TabViewModule, TableModule, TagModule, TooltipModule,
    OperationalFormLayoutComponent, DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pc-04.component.html',
  styles: [`
    .tl { position: relative; border: 1px solid var(--gng-border); border-radius: var(--gng-radius); background: var(--gng-surface); padding: .4rem .6rem .2rem; }
    .tl-row { display: grid; grid-template-columns: 11rem 1fr; align-items: center; gap: .5rem; min-height: 2.1rem; border-bottom: 1px dashed var(--gng-border); }
    .tl-row:last-child { border-bottom: 0; }
    .tl-label { font-size: .78rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tl-track { position: relative; height: 1.7rem; }
    .tl-block { position: absolute; top: .15rem; height: 1.15rem; border-radius: 4px; font-size: .66rem; color: #fff; overflow: hidden; white-space: nowrap;
      text-align: center; line-height: 1.15rem; cursor: pointer; box-shadow: 0 0 0 1px rgba(0,0,0,.08); }
    .tl-block.sel { outline: 2px solid var(--gng-text); z-index: 2; }
    .tl-plan { position: absolute; bottom: 0; height: .3rem; border-radius: 3px; background: repeating-linear-gradient(45deg, var(--gng-text-muted) 0 3px, transparent 3px 6px); opacity: .55; }
    .tl-now { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--gng-danger); z-index: 3; }
    .tl-axis { position: relative; height: 1.2rem; margin-inline-start: 11.5rem; font-size: .65rem; color: var(--gng-text-muted); }
    .tl-axis span { position: absolute; transform: translateX(50%); white-space: nowrap; }
    .src-office { background: var(--gng-purple); } .src-terminal { background: var(--gng-info); } .src-plc { background: var(--gng-teal); } .src-calc { background: var(--gng-text-muted); }
    .chips { display: flex; gap: .4rem; flex-wrap: wrap; align-items: center; margin: .5rem 0; }
    .chip { border: 1px solid var(--gng-border); border-radius: 999px; padding: .15rem .7rem; font-size: .75rem; cursor: pointer; background: var(--gng-surface); }
    .chip.on { background: var(--gng-primary); color: #fff; border-color: var(--gng-primary); }
    .stack { display: flex; height: .9rem; border-radius: 4px; overflow: hidden; background: var(--gng-bg); border: 1px solid var(--gng-border); min-width: 9rem; }
    .stack > div { height: 100%; }
    .seg-good { background: var(--gng-success); } .seg-waste { background: var(--gng-danger); } .seg-rework { background: var(--gng-warning); }
    .pareto-row { display: grid; grid-template-columns: 14rem 1fr 5rem 4rem; gap: .5rem; align-items: center; font-size: .78rem; margin-bottom: .35rem; }
    .pareto-bar { height: .8rem; border-radius: 3px; background: var(--gng-danger); }
    .pareto-bar.setup { background: var(--gng-warning); } .pareto-bar.material { background: var(--gng-purple); }
    .div-bar { position: relative; height: .8rem; background: var(--gng-bg); border-radius: 3px; min-width: 8rem; }
    .div-bar .mid { position: absolute; right: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--gng-text-muted); }
    .div-bar .fill { position: absolute; top: 0; bottom: 0; border-radius: 3px; }
    .shift-chain { display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: .8rem; }
    .shift-card { border: 1px solid var(--gng-border); border-radius: var(--gng-radius); padding: .8rem 1rem; background: var(--gng-surface); position: relative; }
    .shift-card.open { border-color: var(--gng-warning); box-shadow: 0 0 0 2px rgba(242,177,52,.25); }
    .shift-card h4 { margin: 0 0 .3rem; font-size: .92rem; }
    .handover { font-size: .75rem; color: var(--gng-text-muted); margin-bottom: .4rem; }
    .kv { font-size: .78rem; margin: .25rem 0; } .kv b { color: var(--gng-text-muted); font-weight: 500; margin-inline-end: .3rem; }
    .load { position: relative; height: 4.5rem; border-bottom: 1px solid var(--gng-border); margin-inline-start: 11.5rem; }
    .load div { position: absolute; bottom: 0; background: var(--gng-info); opacity: .8; border-radius: 2px 2px 0 0; }
    .load div.over { background: var(--gng-danger); }
    .load .cap { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed var(--gng-danger); background: none; opacity: 1; }
    .fc-chart { width: 100%; height: 220px; background: var(--gng-surface); border: 1px solid var(--gng-border); border-radius: var(--gng-radius); }
    .whatif { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1rem; margin: .6rem 0; }
    .whatif label { font-size: .78rem; display: block; margin-bottom: .5rem; }
    .clickable { cursor: pointer; }
  `],
})
export class FrmPc04Component implements OnInit {
  data: Pc04Bundle | null = null;
  orders: WoRow[] = [];
  wo: WoRow | null = null;
  ops: OpRow[] = [];
  reports: ReportRow[] = [];

  // گزارش عملیات
  lanes: Lane[] = [];
  ticks: Tick[] = [];
  nowRight: number | null = null;
  sourceFilter = 0;
  search = '';
  selReport: ReportRow | null = null;
  selLabor: LaborRow[] = [];
  selWaste: WasteRow[] = [];
  selCapacity: CapacityRow[] = [];

  // مقادیر
  opQty: OpQty[] = [];
  pareto: ParetoRow[] = [];
  setupWaste = 0;
  processWaste = 0;
  materialWaste = 0;
  fpy: number | null = null;
  reworkCards: { seq: number; toRepair: number; remained: number; reason: string; description: string; link: string; progress: number }[] = [];

  // منابع
  resRows: ResRow[] = [];

  // شیفت
  shiftCards: ShiftCard[] = [];

  // اپراتور
  people: PersonRow[] = [];
  personCode = '';
  personDays: string[] = [];
  personDay = '';
  personLanes: { a: Assignment; block: TimeBlock }[] = [];
  personTicks: Tick[] = [];
  loadSegs: LoadSeg[] = [];
  conflicts: LoadSeg[] = [];
  private assignments: Assignment[] = [];

  // پیش‌بینی
  forecasts: ForecastRow[] = [];
  rateFactor = 100;
  resumeDelay = 60;
  selForecast: ForecastRow | null = null;
  chart = { actual: '', projection: '', plan: '', nowX: 0, etaX: 0, ticks: [] as { x: number; label: string }[], targetY: 0, w: 640, h: 220 };
  orderEta: { wo: WoRow; eta: number; tone: Tone; verdict: string }[] = [];

  readonly WO_STATUS = WO_STATUS;
  readonly WO_TYPE = WO_TYPE;
  readonly OP_STATUS = OP_STATUS;
  readonly REPORT_SOURCE = REPORT_SOURCE;
  readonly SOURCE_CLASS = SOURCE_CLASS;
  readonly woStatusTone = woStatusTone;
  readonly opStatusTone = opStatusTone;
  readonly faNum = faNum;
  readonly faInt = faInt;
  readonly faPct = faPct;
  readonly faTime = faTime;
  readonly faDay = faDay;
  readonly faDateTime = faDateTime;
  readonly faDuration = faDuration;
  readonly companyId = DEMO_COMPANY_ID;
  readonly sourceChips = [{ code: 0, label: 'همه' }, { code: 2, label: 'ترمینال کارگاه' }, { code: 1, label: 'ثبت اداری' }, { code: 3, label: 'PLC/دستگاه' }];
  loading = false;
  loadFailed = false;

  constructor(private pc04: FrmPc04Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.pc04.bundle(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        const withReports = new Set(b.reports.map((r) => r.woId));
        this.orders = b.orders.filter((o) => withReports.has(o.id) || o.statusCode === 3).sort((a, c) => this.woRank(a) - this.woRank(c) || c.number.localeCompare(a.number));
        this.buildShifts();
        this.buildPeople();
        this.buildForecast();
        this.selectWo(this.orders.find((o) => o.number === 'WO-1405-0501') ?? this.orders[0] ?? null);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-PC-04] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  private woRank(o: WoRow): number {
    return o.statusCode === 3 ? 0 : o.statusCode === 7 ? 1 : o.statusCode === 2 ? 2 : 3;
  }

  // ───────── انتخاب دستور ─────────

  selectWo(o: WoRow | null): void {
    this.wo = o;
    if (!o || !this.data) return;
    this.ops = this.data.operations.filter((x) => x.woId === o.id).sort((a, b) => a.seq - b.seq);
    this.reports = this.data.reports.filter((r) => r.woId === o.id).sort((a, b) => ms(a.start) - ms(b.start));
    this.buildTimeline();
    this.buildQuantities();
    this.buildResources();
    const last = [...this.reports].sort((a, b) => ms(b.start) - ms(a.start))[0] ?? null;
    this.pickReport(last);
  }

  pickReport(r: ReportRow | null): void {
    this.selReport = r;
    if (!r || !this.data) return;
    this.selLabor = this.data.labor.filter((l) => l.outputId === r.outputId);
    this.selWaste = this.data.waste.filter((w) => w.outputId === r.outputId);
    this.selCapacity = this.data.capacity.filter((c) => c.outputId === r.outputId);
  }

  get filteredReports(): ReportRow[] {
    const q = this.search.trim().toLowerCase();
    return [...this.reports]
      .filter((r) => !this.sourceFilter || r.sourceCode === this.sourceFilter)
      .filter((r) => !q || `${r.number} ${r.opTitle} ${r.by} ${r.seq}`.toLowerCase().includes(q))
      .sort((a, b) => ms(b.start) - ms(a.start));
  }

  sourceCount(code: number): number {
    return code ? this.reports.filter((r) => r.sourceCode === code).length : this.reports.length;
  }

  // ───────── خط زمانی (F-PC-031، 032) ─────────

  private axisOf(t0: number, t1: number): (t: number) => number {
    const span = Math.max(1, t1 - t0);
    return (t: number) => ((t - t0) / span) * 100;
  }

  private ticksOf(t0: number, t1: number): Tick[] {
    const pos = this.axisOf(t0, t1);
    const spanMin = (t1 - t0) / 60000;
    const step = [15, 30, 60, 120, 180, 360, 720, 1440].find((s) => spanMin / s <= 7) ?? 2880;
    const out: Tick[] = [];
    if (!(t0 > 0) || spanMin <= 0 || spanMin > 60 * 1440) return out;
    const first = Math.ceil(t0 / (step * 60000)) * step * 60000;
    for (let t = first; t <= t1; t += step * 60000) {
      const iso = new Date(t).toISOString();
      out.push({ right: pos(t), label: spanMin > 1200 && new Date(t).getUTCHours() === 0 ? faDay(iso) : spanMin > 1200 ? `${faDay(iso).slice(-2)} ${faTime(iso)}` : faTime(iso) });
    }
    return out;
  }

  private buildTimeline(): void {
    const times: number[] = [];
    for (const r of this.reports) times.push(ms(r.start), ms(r.end ?? r.start));
    for (const o of this.ops) for (const t of [o.start, o.end, o.planStart, o.planEnd]) if (t) times.push(ms(t));
    const running = this.ops.some((o) => o.statusCode === 3 || o.statusCode === 4);
    if (running) times.push(SHOP_NOW.getTime());
    const valid = times.filter((t) => !Number.isNaN(t));
    if (!valid.length) {
      this.lanes = [];
      this.ticks = [];
      this.nowRight = null;
      return;
    }
    const t0 = Math.min(...valid);
    const t1 = Math.max(...valid);
    const pos = this.axisOf(t0, t1);
    const blk = (s: number, e: number) => ({ right: pos(s), width: Math.max(0.5, pos(e) - pos(s)) });
    this.lanes = this.ops.map((op) => ({
      op,
      plan: op.planStart && op.planEnd ? { ...blk(ms(op.planStart), ms(op.planEnd)), label: '', tone: '', key: `p${op.id}`, title: `برنامه: ${faDateTime(op.planStart)} تا ${faDateTime(op.planEnd)}` } : null,
      blocks: this.reports
        .filter((r) => r.opId === op.id)
        .map((r) => {
          const b = blk(ms(r.start), ms(r.end ?? SHOP_NOW.toISOString()));
          return {
            ...b,
            label: b.width > 4 ? faInt(r.completed) : '',
            tone: SOURCE_CLASS[r.sourceCode] ?? 'src-office',
            key: r.number,
            title: `${r.number} · ${faTime(r.start)}–${faTime(r.end)} · سالم ${faNum(r.completed)} · ضایعات ${faNum(r.wasted)} · ${REPORT_SOURCE[r.sourceCode] ?? ''}`,
          };
        }),
    }));
    this.ticks = this.ticksOf(t0, t1);
    this.nowRight = running ? pos(SHOP_NOW.getTime()) : null;
  }

  laneClick(key: string): void {
    this.pickReport(this.reports.find((r) => r.number === key) ?? null);
  }

  // ───────── مقادیر (F-PC-033) ─────────

  private buildQuantities(): void {
    if (!this.data || !this.wo) return;
    this.opQty = this.ops.map((op) => {
      const base = Math.max(op.toComplete, op.completed + op.wasted + op.rework, 1);
      const good = (op.completed / base) * 100;
      const waste = (op.wasted / base) * 100;
      const rework = (op.rework / base) * 100;
      const handled = op.completed + op.wasted + op.rework;
      return { op, good, waste, rework, rest: Math.max(0, 100 - good - waste - rework), yieldPct: handled ? (op.completed / handled) * 100 : null };
    });
    const measured = this.opQty.filter((q) => q.yieldPct !== null);
    this.fpy = measured.length ? measured.reduce((p, q) => p * ((q.yieldPct as number) / 100), 1) * 100 : null;

    const waste = this.data.waste.filter((w) => w.woId === this.wo!.id);
    this.setupWaste = waste.filter((w) => w.isSetup).reduce((s, w) => s + w.qty, 0);
    this.processWaste = waste.filter((w) => !w.isSetup).reduce((s, w) => s + w.qty, 0);
    this.materialWaste = waste.filter((w) => w.typeCode === 1).reduce((s, w) => s + w.qty, 0);
    const byReason = new Map<string, ParetoRow>();
    for (const w of waste) {
      const k = w.reasonCode || w.reason;
      const row = byReason.get(k) ?? { reason: `${w.reasonCode} ${w.reason}`, parent: w.parent, qty: 0, pct: 0, cum: 0, setup: w.isSetup, material: w.typeCode === 1 };
      row.qty += w.qty;
      byReason.set(k, row);
    }
    const total = waste.reduce((s, w) => s + w.qty, 0) || 1;
    let cum = 0;
    this.pareto = [...byReason.values()].sort((a, b) => b.qty - a.qty).map((r) => {
      cum += r.qty;
      return { ...r, pct: (r.qty / total) * 100, cum: (cum / total) * 100 };
    });

    const reworks = this.data.rework.filter((r) => r.woId === this.wo!.id);
    this.reworkCards = reworks.map((r) => {
      const linked = this.data!.orders.find((o) => o.refNumber === this.wo!.number && o.typeCode === 3);
      const lops = linked ? this.data!.operations.filter((x) => x.woId === linked.id) : [];
      const first = lops.sort((a, b) => a.seq - b.seq)[0];
      const done = first ? first.completed + first.wasted : 0;
      return {
        seq: r.seq, toRepair: r.toRepair, remained: r.remained, reason: r.reason, description: r.description,
        link: linked ? `${linked.number} — ${WO_STATUS[linked.statusCode]}` : 'دستور دوباره‌کاری صادر نشده',
        progress: first ? (done / Math.max(1, first.toComplete)) * 100 : 0,
      };
    });
  }

  get reworkSource(): string {
    return this.wo && this.wo.typeCode === 3 && this.wo.refNumber ? this.wo.refNumber : '';
  }

  // ───────── کارکرد منابع (F-PC-034) ─────────

  private buildResources(): void {
    if (!this.data || !this.wo) return;
    const caps = this.data.capacity.filter((c) => c.woId === this.wo!.id);
    const groups = new Map<string, CapacityRow[]>();
    for (const c of caps) groups.set(`${c.seq}|${c.title}`, [...(groups.get(`${c.seq}|${c.title}`) ?? []), c]);
    this.resRows = [...groups.values()].map((rows) => {
      const f = rows[0];
      const qty = rows.reduce((s, r) => s + r.qty, 0);
      const stds = rows.filter((r) => r.std !== null);
      const std = stds.length ? stds.reduce((s, r) => s + (r.std as number), 0) : null;
      const variance = std ? ((qty - std) / std) * 100 : null;
      const w = variance === null ? 0 : Math.min(50, Math.abs(variance) / 2);
      const code = f.title.split(' ')[0];
      const minutes = this.reports.filter((r) => r.seq === f.seq).reduce((s, r) => s + r.duration, 0);
      const cap = PLAUSIBLE_PER_HOUR[code];
      const perHour = minutes ? qty / (minutes / 60) : 0;
      return {
        seq: f.seq,
        opTitle: this.ops.find((o) => o.seq === f.seq)?.title ?? '',
        title: f.title,
        unit: f.unit,
        qty,
        std,
        variance,
        barRight: variance === null ? 50 : variance >= 0 ? 50 - w : 50,
        barWidth: w,
        tone: variance === null ? '' : Math.abs(variance) <= 10 ? 'var(--gng-success)' : variance > 0 ? 'var(--gng-danger)' : 'var(--gng-info)',
        sources: [...new Set(rows.map((r) => REPORT_SOURCE[r.sourceCode] ?? '—'))].join('، '),
        implausible: cap && perHour > cap ? `${faInt(perHour)} ${f.unit} در ساعت — بیش از سقف معقول ${faInt(cap)}` : '',
      };
    }).sort((a, b) => a.seq - b.seq || a.title.localeCompare(b.title));
  }

  /** ردیف‌های کارکردی که نرخ ساعتی‌شان از سقف معقول بیشتر است (در همه‌ی دستورها) */
  get implausibleCount(): number {
    if (!this.data) return 0;
    const dur = new Map(this.data.reports.map((r) => [r.outputId, r.duration]));
    return this.data.capacity.filter((c) => {
      const cap = PLAUSIBLE_PER_HOUR[c.title.split(' ')[0]];
      const m = dur.get(c.outputId) ?? 0;
      return cap && m > 0 && c.qty / (m / 60) > cap;
    }).length;
  }

  // ───────── گزارش شیفت (F-PC-041) ─────────

  private shiftWindow(s: ShiftRow): [number, number] {
    const d = ms(s.date);
    const start = d + s.from * 60000;
    const end = d + (s.to > s.from ? s.to : s.to + 1440) * 60000;
    return [start, end];
  }

  private buildShifts(): void {
    if (!this.data) return;
    const d = this.data;
    this.shiftCards = [...d.shifts]
      .sort((a, b) => this.shiftWindow(a)[0] - this.shiftWindow(b)[0])
      .map((s) => {
        const [st, en] = this.shiftWindow(s);
        const inShift = d.reports.filter((r) => ms(r.start) >= st && ms(r.start) < en);
        const prod = new Map<string, { wo: string; qty: number; unit: string }>();
        for (const r of inShift) {
          const k = `${r.woNumber} · عملیات ${faInt(r.seq)}`;
          const p = prod.get(k) ?? { wo: k, qty: 0, unit: r.unit };
          p.qty += r.completed;
          prod.set(k, p);
        }
        const open = !s.handover;
        return {
          s,
          window: `${faTime(new Date(st).toISOString())} تا ${faTime(new Date(en).toISOString())}`,
          reports: inShift.length,
          produced: [...prod.values()],
          wip: d.wip.filter((w) => w.shiftId === s.id),
          open,
          remain: open ? (en > SHOP_NOW.getTime() ? `${faDuration((en - SHOP_NOW.getTime()) / 60000)} تا پایان شیفت` : 'شیفت تمام شده ولی تحویل نشده') : '',
        };
      });
  }

  // ───────── تسهیم اپراتور (F-PC-042) ─────────

  private buildPeople(): void {
    if (!this.data) return;
    const repById = new Map(this.data.reports.map((r) => [r.outputId, r]));
    this.assignments = this.data.labor
      .filter((l) => repById.has(l.outputId))
      .map((l) => {
        const report = repById.get(l.outputId)!;
        return { labor: l, report, s: ms(report.start), e: ms(report.end ?? SHOP_NOW.toISOString()) };
      });
    const codes = [...new Set(this.assignments.map((a) => a.labor.code))];
    this.people = codes.map((code) => {
      const mine = this.assignments.filter((a) => a.labor.code === code);
      const segs = this.loadOf(mine);
      return {
        code,
        name: mine[0].labor.name,
        rows: mine.length,
        minutes: mine.reduce((s, a) => s + a.labor.duration, 0),
        maxLoad: segs.reduce((m, x) => Math.max(m, x.load), 0),
        conflicts: segs.filter((x) => x.load > 100).length,
        shared: mine.filter((a) => a.labor.share < 100).length,
      };
    }).sort((a, b) => b.maxLoad - a.maxLoad || b.shared - a.shared);
    const pick = this.people.find((p) => p.shared > 0) ?? this.people[0];
    if (pick) this.selectPerson(pick.code);
  }

  /** پروفیل بار هم‌زمان: مجموع سهم تخصیص‌های هم‌پوشان در هر بازه */
  private loadOf(list: Assignment[]): LoadSeg[] {
    const pts = [...new Set(list.flatMap((a) => [a.s, a.e]))].sort((a, b) => a - b);
    const out: LoadSeg[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [f, t] = [pts[i], pts[i + 1]];
      const act = list.filter((a) => a.s <= f && a.e >= t);
      const load = act.reduce((s, a) => s + a.labor.share, 0);
      if (load > 0) out.push({ right: 0, width: 0, load, from: f, to: t, items: act.map((a) => `${a.report.number} (${faInt(a.labor.share)}٪)`).join('، ') });
    }
    return out;
  }

  selectPerson(code: string): void {
    this.personCode = code;
    const mine = this.assignments.filter((a) => a.labor.code === code);
    this.personDays = [...new Set(mine.map((a) => a.report.start.slice(0, 10)))].sort().reverse();
    this.selectDay(this.personDays[0] ?? '');
  }

  selectDay(day: string): void {
    this.personDay = day;
    const list = this.assignments.filter((a) => a.labor.code === this.personCode && a.report.start.startsWith(day)).sort((a, b) => a.s - b.s);
    if (!list.length) {
      this.personLanes = [];
      this.loadSegs = [];
      this.conflicts = [];
      return;
    }
    const t0 = Math.min(...list.map((a) => a.s));
    const t1 = Math.max(...list.map((a) => a.e));
    const pos = this.axisOf(t0, t1);
    this.personLanes = list.map((a) => ({
      a,
      block: {
        right: pos(a.s), width: Math.max(0.5, pos(a.e) - pos(a.s)), key: a.report.number,
        label: a.labor.share < 100 ? `${faInt(a.labor.share)}٪` : '', tone: a.labor.share < 100 ? 'src-plc' : 'src-terminal',
        title: `${a.report.woNumber} · عملیات ${a.report.seq} · ${faTime(a.report.start)}–${faTime(a.report.end)} · سهم ${faInt(a.labor.share)}٪`,
      },
    }));
    this.personTicks = this.ticksOf(t0, t1);
    this.loadSegs = this.loadOf(list).map((s) => ({ ...s, right: pos(s.from), width: Math.max(0.3, pos(s.to) - pos(s.from)) }));
    this.conflicts = this.loadSegs.filter((s) => s.load > 100);
  }

  get person(): PersonRow | undefined {
    return this.people.find((p) => p.code === this.personCode);
  }

  get personOptions(): { label: string; value: string }[] {
    return this.people.map((p) => ({ label: `${p.name} (${p.code})`, value: p.code }));
  }

  loadHeight(load: number): number {
    return Math.min(100, (load / 400) * 100);
  }

  shareCheck(a: Assignment): string {
    const expected = (a.report.duration * a.labor.share) / 100;
    return Math.abs(expected - a.labor.duration) > 2 ? `کارکرد ${faInt(a.labor.duration)} با سهم ${faInt(a.labor.share)}٪ از ${faInt(a.report.duration)} دقیقه نمی‌خواند` : '';
  }

  // ───────── پیش‌بینی تکمیل (F-PC-043) ─────────

  buildForecast(): void {
    if (!this.data) return;
    const d = this.data;
    const now = SHOP_NOW.getTime();
    const factor = this.rateFactor / 100;
    const rows: ForecastRow[] = [];
    for (const op of d.operations.filter((o) => o.statusCode === 3 || o.statusCode === 4)) {
      const wo = d.orders.find((o) => o.id === op.woId);
      if (!wo) continue;
      const reps = d.reports.filter((r) => r.opId === op.id && r.completed > 0);
      const mins = reps.reduce((s, r) => s + r.duration, 0);
      const rate = mins ? reps.reduce((s, r) => s + r.completed, 0) / mins : null;
      const remaining = Math.max(0, op.toComplete - op.completed - op.wasted);
      const stopped = op.statusCode === 4;
      const startAt = now + (stopped ? this.resumeDelay * 60000 : 0);
      let ownEta: number;
      let basis: string;
      if (rate) {
        ownEta = startAt + (remaining / (rate * factor)) * 60000;
        basis = `${faNum(rate * 60, 0)} ${wo.unit} در ساعت (از ${faInt(reps.length)} گزارش)`;
      } else {
        const std = (op.stdMinutes ?? 0) / factor;
        ownEta = Math.max(startAt, ms(op.start) + std * 60000);
        basis = `بدون خروجی میانی — زمان استاندارد ${faInt(op.stdMinutes ?? 0)} دقیقه`;
      }
      rows.push({ op, wo, rate, basis, remaining, ownEta, eta: ownEta, chained: false, tone: 'success', verdict: '', stopped });
    }
    // وابستگی به بالادست: عملیاتی که هنوز همه‌ی ورودی‌اش نرسیده، زودتر از عملیات قبلی تمام نمی‌شود
    for (const r of rows) {
      if (r.op.received >= r.op.toComplete) continue;
      const up = rows.filter((x) => x.wo.id === r.wo.id && x.op.seq < r.op.seq);
      const upEta = up.reduce((m, x) => Math.max(m, x.eta), 0);
      if (upEta > r.ownEta) {
        r.eta = upEta + 10 * 60000;
        r.chained = true;
      }
    }
    for (const r of rows) {
      const late = r.op.planEnd ? (r.eta - ms(r.op.planEnd)) / 60000 : 0;
      const pastStd = !r.rate && ms(r.op.start) + (r.op.stdMinutes ?? 0) * 60000 < now;
      r.tone = r.stopped ? 'danger' : late > 240 ? 'danger' : late > 0 || pastStd ? 'warning' : 'success';
      r.verdict = r.stopped ? 'متوقف' : late > 0 ? `${faDuration(late)} دیرتر از برنامه‌ی عملیات` : 'طبق برنامه';
      if (pastStd) r.verdict = `از زمان استاندارد گذشته (${faDuration((now - ms(r.op.start)) / 60000 - (r.op.stdMinutes ?? 0))})`;
    }
    this.forecasts = rows.sort((a, b) => (a.tone === b.tone ? a.eta - b.eta : a.tone === 'danger' ? -1 : b.tone === 'danger' ? 1 : a.tone === 'warning' ? -1 : 1));

    const byWo = new Map<number, ForecastRow[]>();
    for (const r of rows) byWo.set(r.wo.id, [...(byWo.get(r.wo.id) ?? []), r]);
    this.orderEta = [...byWo.values()].map((list) => {
      const wo = list[0].wo;
      const maxSeq = Math.max(...list.map((x) => x.op.seq));
      const tail = d.operations.filter((o) => o.woId === wo.id && o.seq > maxSeq && o.statusCode <= 2).reduce((s, o) => s + (o.stdMinutes ?? 0), 0);
      const eta = Math.max(...list.map((x) => x.eta)) + tail * 60000;
      const due = ms(wo.due);
      const plan = ms(wo.plannedComplete);
      const tone: Tone = eta > due ? 'danger' : eta > plan ? 'warning' : 'success';
      const verdict = eta > due ? 'بعد از سررسید مشتری' : eta > plan ? `${faDuration((eta - plan) / 60000)} بعد از پایان برنامه‌ای` : `${faDuration((plan - eta) / 60000)} زودتر از برنامه`;
      return { wo, eta, tone, verdict };
    });
    const keep = this.selForecast ? this.forecasts.find((f) => f.op.id === this.selForecast!.op.id) : null;
    this.pickForecast(keep ?? this.forecasts[0] ?? null);
  }

  pickForecast(f: ForecastRow | null): void {
    this.selForecast = f;
    if (!f || !this.data) return;
    const { w, h } = this.chart;
    const pad = 28;
    const reps = this.data.reports.filter((r) => r.opId === f.op.id).sort((a, b) => ms(a.start) - ms(b.start));
    const valid = (xs: number[]) => xs.filter((t) => !Number.isNaN(t));
    const t0 = Math.min(...valid([ms(f.op.start), ms(f.op.planStart), SHOP_NOW.getTime()]));
    const t1 = Math.max(...valid([f.eta, ms(f.op.planEnd), SHOP_NOW.getTime()])) + 30 * 60000;
    const x = (t: number) => w - pad - ((t - t0) / (t1 - t0)) * (w - 2 * pad);
    const yMax = Math.max(f.op.toComplete, 1);
    const y = (v: number) => h - pad - (v / yMax) * (h - 2 * pad);
    let cum = 0;
    const pts = [`${x(ms(f.op.start))},${y(0)}`];
    for (const r of reps) {
      cum += r.completed;
      pts.push(`${x(ms(r.end ?? SHOP_NOW.toISOString()))},${y(cum)}`);
    }
    const nowT = SHOP_NOW.getTime();
    const startProj = nowT + (f.stopped ? this.resumeDelay * 60000 : 0);
    this.chart = {
      ...this.chart,
      actual: pts.join(' '),
      projection: `${x(nowT)},${y(f.op.completed)} ${x(startProj)},${y(f.op.completed)} ${x(f.eta)},${y(f.op.toComplete - f.op.wasted)}`,
      plan: f.op.planStart && f.op.planEnd ? `${x(ms(f.op.planStart))},${y(0)} ${x(ms(f.op.planEnd))},${y(f.op.toComplete)}` : '',
      nowX: x(nowT),
      etaX: x(f.eta),
      targetY: y(f.op.toComplete),
      ticks: this.ticksOf(t0, t1).map((t) => ({ x: w - pad - (t.right / 100) * (w - 2 * pad), label: t.label })),
    };
  }

  iso(t: number): string {
    return new Date(t).toISOString();
  }

  // ───────── سرآیند ─────────

  get contextLabel(): string {
    return this.wo ? `${this.wo.number} — ${this.wo.name}` : 'گزارش تولید';
  }

  private get issues(): { tone: 'danger' | 'warning'; text: string }[] {
    if (!this.data) return [];
    const out: { tone: 'danger' | 'warning'; text: string }[] = [];
    for (const f of this.forecasts.filter((x) => x.stopped)) out.push({ tone: 'danger', text: `${f.wo.number} عملیات ${faInt(f.op.seq)} (${f.op.title}) متوقف است` });
    const over = this.people.filter((p) => p.maxLoad > 100);
    if (over.length) out.push({ tone: 'danger', text: `هم‌پوشانی کارکرد اپراتور: ${over.slice(0, 3).map((p) => `${p.name} تا ${faInt(p.maxLoad)}٪`).join('، ')}` });
    for (const o of this.orderEta.filter((x) => x.tone !== 'success')) out.push({ tone: o.tone === 'danger' ? 'danger' : 'warning', text: `${o.wo.number} پیش‌بینی پایان ${faDateTime(this.iso(o.eta))} — ${o.verdict}` });
    const rw = this.data.rework.filter((r) => r.remained > 0);
    if (rw.length) out.push({ tone: 'warning', text: `${faInt(rw.reduce((s, r) => s + r.remained, 0))} واحد منتظر دوباره‌کاری` });
    if (this.implausibleCount) out.push({ tone: 'warning', text: `${faInt(this.implausibleCount)} ردیف کارکرد بخار نامعقول (به‌جای کیلو، تعداد قرص)` });
    return out;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const i = this.issues;
    return i.some((x) => x.tone === 'danger') ? 'danger' : i.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc04_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن…';
    const i = this.issues;
    return i.length ? i.map((x) => x.text).join('؛ ') + '.' : 'همه‌ی عملیات در جریان طبق برنامه‌اند.';
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
