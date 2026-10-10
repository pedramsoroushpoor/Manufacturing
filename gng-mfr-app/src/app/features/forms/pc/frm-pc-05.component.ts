import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SliderModule } from 'primeng/slider';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { OP_STATUS, PRIORITY, REPORT_SOURCE, SHOP_NOW, faDateTime, faDuration, faInt, faNum, faPct, faTime, opStatusTone, priorityTone } from './pc-shared';
import {
  CheckRow, DeviceRow, MEDIA, OEE_COMPONENT, OpWasteRow, PARAM_ACTION, PLC_ITEM_TYPE, Pc05Bundle, QueueRow, READING_SOURCE, ReadingRow, StopRow, TerminalRow,
} from './frm-pc-05.data';
import { FrmPc05Service } from './frm-pc-05.service';

interface ParamSeries { key: string; opId: number; title: string; unit: string; critical: boolean; action: string; min: number | null; max: number | null; target: number | null; rows: ReadingRow[]; outCount: number; last: ReadingRow; }
interface ChartPoint { x: number; y: number; out: boolean; label: string; tip: string; }
interface StopLane { q: QueueRow; blocks: { right: number; width: number; tone: string; tip: string; active: boolean }[]; availability: number | null; runMin: number; stopMin: number; }
interface DeviceView { d: DeviceRow; threshold: number | null; terminal: string; over: boolean; needsNote: boolean; status: string; tone: 'success' | 'warning' | 'danger' | 'info'; }

const ms = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : NaN);

/**
 * FRM-PC-05 — «ترمینال کف کارگاه»: نمای لمسی اپراتور هر ایستگاه — کارتابل و کارت کار جاری، توقف با
 * زمان‌سنج زنده، ضایعات راه‌اندازی/فرایند، نمودار کنترل پارامترها، دستورالعمل و چک‌لیست، و داده‌ی دستگاه
 * در برابر ورودی کاربر با آستانه‌ی انحراف ترمینال.
 *
 * فاز اول (فقط‌خواندنی): F-PC-035، 036، 037، 038، 040، 070، 071 (M) و 039 (S). زمان‌سنج‌ها از ساعت سناریو
 * (SHOP_NOW) شروع می‌شوند و با گذشت زمان صفحه جلو می‌روند.
 * هنوز پیاده نشده: دکمه‌های شروع/پایان/توقف/ضایعات/پارامتر، تیک چک‌لیست، تأیید داده‌ی دستگاه و صف همگام‌سازی آفلاین.
 */
@Component({
  selector: 'gng-frm-pc-05',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SliderModule, TabViewModule, TableModule, TagModule, TooltipModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-pc-05.component.html',
  styles: [`
    .trm-tile { border: 1px solid var(--gng-border); border-radius: var(--gng-radius); padding: .6rem .75rem; cursor: pointer; background: var(--gng-surface); margin-bottom: .5rem; }
    .trm-tile.sel { border-color: var(--gng-primary); box-shadow: 0 0 0 2px rgba(46,134,222,.25); }
    .trm-tile.off { border-inline-start: 4px solid var(--gng-danger); }
    .dot { display: inline-block; width: .6rem; height: .6rem; border-radius: 50%; margin-inline-end: .35rem; }
    .dot.on { background: var(--gng-success); } .dot.offl { background: var(--gng-danger); animation: blink 1.2s infinite; }
    @keyframes blink { 50% { opacity: .25; } }
    .sync { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; padding: .8rem 1rem; border-radius: var(--gng-radius); margin-bottom: .8rem; color: #fff; }
    .sync.offline { background: linear-gradient(90deg, #b3261e, #d9534f); } .sync.online { background: linear-gradient(90deg, #1f7a4d, #2e9e63); }
    .sync .big { font-size: 1.5rem; font-weight: 700; }
    .sync .pend { background: rgba(255,255,255,.2); border-radius: 999px; padding: .2rem .8rem; font-weight: 700; }
    .q-row { display: grid; grid-template-columns: 4px 1fr auto; gap: .7rem; align-items: center; padding: .75rem .9rem; border-radius: 10px; background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1); margin-bottom: .5rem; cursor: pointer; min-height: 3.6rem; }
    .q-row.sel { border-color: #5aa9ff; background: rgba(90,169,255,.14); }
    .q-row .bar { align-self: stretch; border-radius: 4px; }
    .q-title { font-size: 1rem; font-weight: 700; } .q-meta { font-size: .75rem; color: rgba(255,255,255,.6); }
    .stop-live { background: #2a0f12; border: 2px solid #eb5757; border-radius: var(--gng-radius); padding: 1rem 1.2rem; color: #fff; display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap; }
    .stop-live .clock { font-size: 2.6rem; font-weight: 800; font-variant-numeric: tabular-nums; color: #ff8a80; letter-spacing: .05em; }
    .strip { position: relative; height: 1.6rem; background: var(--gng-success); opacity: .9; border-radius: 4px; }
    .strip div { position: absolute; top: 0; bottom: 0; }
    .lane { display: grid; grid-template-columns: 12rem 1fr 6rem; gap: .6rem; align-items: center; margin-bottom: .5rem; font-size: .78rem; }
    .chips { display: flex; gap: .4rem; flex-wrap: wrap; margin: .4rem 0 .7rem; }
    .chip { border: 1px solid var(--gng-border); border-radius: 999px; padding: .2rem .75rem; font-size: .76rem; cursor: pointer; background: var(--gng-surface); }
    .chip.on { background: var(--gng-primary); color: #fff; border-color: var(--gng-primary); }
    .chip.bad { border-color: var(--gng-danger); color: var(--gng-danger); } .chip.on.bad { background: var(--gng-danger); color: #fff; }
    .cc { width: 100%; height: 250px; background: var(--gng-surface); border: 1px solid var(--gng-border); border-radius: var(--gng-radius); }
    .doc { display: flex; gap: .7rem; align-items: center; border: 1px solid var(--gng-border); border-radius: var(--gng-radius); padding: .6rem .8rem; margin-bottom: .5rem; }
    .doc i.big { font-size: 1.6rem; color: var(--gng-primary); }
    .doc.old { opacity: .55; border-style: dashed; }
    .check { display: flex; gap: .7rem; align-items: center; padding: .75rem .9rem; border-radius: var(--gng-radius); border: 1px solid var(--gng-border); margin-bottom: .45rem; font-size: .9rem; }
    .check.todo { border-color: var(--gng-danger); background: rgba(235,87,87,.07); }
    .check i { font-size: 1.4rem; }
    .dev-bars { display: flex; flex-direction: column; gap: 3px; min-width: 9rem; }
    .dev-bars div { height: .45rem; border-radius: 3px; }
    .ghost-btn { opacity: .75; cursor: not-allowed; min-height: 3.2rem; display: flex; align-items: center; justify-content: center; gap: .4rem; font-size: .95rem; }
  `],
})
export class FrmPc05Component implements OnInit, OnDestroy {
  data: Pc05Bundle | null = null;
  waste: OpWasteRow[] | null = null;
  terminal: TerminalRow | null = null;
  queue: QueueRow[] = [];
  job: QueueRow | null = null;
  overlap = '';

  stopScope: 'terminal' | 'all' = 'terminal';
  stopLanes: StopLane[] = [];
  stopRows: StopRow[] = [];
  lossSummary: { label: string; minutes: number; pct: number; tone: string }[] = [];
  stripFrom = 0;

  terminalWaste: { setup: number; process: number; material: number; rows: { reason: string; parent: string; qty: number; setup: boolean; material: boolean; op: string }[] } = { setup: 0, process: 0, material: 0, rows: [] };

  params: ParamSeries[] = [];
  param: ParamSeries | null = null;
  missingParams: string[] = [];
  cc = { w: 640, h: 250, band: { y: 0, h: 0 }, minY: 0, maxY: 0, targetY: 0, line: '', points: [] as ChartPoint[], yLabels: [] as { y: number; label: string }[], xLabels: [] as { x: number; label: string }[] };

  docs: (CheckRow & { superseded: boolean })[] = [];
  checks: CheckRow[] = [];

  deviceScope: 'terminal' | 'all' = 'terminal';
  devices: DeviceView[] = [];
  whatIfThreshold = 1;

  private offset = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly loadedAt = Date.now();

  readonly OP_STATUS = OP_STATUS;
  readonly PRIORITY = PRIORITY;
  readonly REPORT_SOURCE = REPORT_SOURCE;
  readonly READING_SOURCE = READING_SOURCE;
  readonly OEE_COMPONENT = OEE_COMPONENT;
  readonly PLC_ITEM_TYPE = PLC_ITEM_TYPE;
  readonly MEDIA = MEDIA;
  readonly opStatusTone = opStatusTone;
  readonly priorityTone = priorityTone;
  readonly faNum = faNum;
  readonly faInt = faInt;
  readonly faPct = faPct;
  readonly faTime = faTime;
  readonly faDateTime = faDateTime;
  readonly faDuration = faDuration;
  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private pc05: FrmPc05Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.pc05.bundle(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        const first = b.terminals.find((t) => !t.online) ?? b.terminals.find((t) => this.activeStopsOf(t.id).length) ?? b.terminals[0];
        this.selectTerminal(first ?? null);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-PC-05] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
    this.pc05.waste(this.companyId).subscribe({
      next: (w) => {
        this.waste = w;
        this.buildWaste();
      },
      error: () => (this.waste = []),
    });
    this.timer = setInterval(() => (this.offset = Date.now() - this.loadedAt), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** ساعت سناریو + زمان سپری‌شده از بازشدن صفحه */
  get liveNow(): number {
    return SHOP_NOW.getTime() + this.offset;
  }

  clock(fromIso: string | null): string {
    if (!fromIso) return '—';
    const s = Math.max(0, Math.floor((this.liveNow - ms(fromIso)) / 1000));
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
  }

  // ───────── ترمینال و کارتابل (F-PC-040) ─────────

  private queueOf(id: number): QueueRow[] {
    return (this.data?.queue ?? [])
      .filter((q) => q.terminalId === id)
      .sort((a, b) => this.qRank(a) - this.qRank(b) || b.priority - a.priority || ms(a.planStart) - ms(b.planStart));
  }

  private qRank(q: QueueRow): number {
    return q.statusCode === 3 ? 0 : q.statusCode === 4 ? 1 : q.statusCode === 2 ? 2 : 3;
  }

  activeStopsOf(terminalId: number): StopRow[] {
    const ops = new Set(this.queueOf(terminalId).map((q) => q.opId));
    return (this.data?.stoppages ?? []).filter((s) => s.active && ops.has(s.opId));
  }

  selectTerminal(t: TerminalRow | null): void {
    this.terminal = t;
    if (!t || !this.data) return;
    this.queue = this.queueOf(t.id);
    const running = this.queue.filter((q) => q.statusCode === 3);
    this.overlap = t.workCenterId && running.length > 1
      ? `${faInt(running.length)} عملیات هم‌زمان «در جریان» روی یک ایستگاه (${t.station}): ${running.map((q) => `${q.woNumber} · ${faInt(q.seq)}`).join(' و ')} — ایستگاه منفرد است، نه گروه منبع`
      : '';
    this.whatIfThreshold = t.threshold ?? 1;
    this.selectJob(this.queue[0] ?? null);
    this.buildStops();
    this.buildWaste();
    this.buildDevices();
  }

  selectJob(q: QueueRow | null): void {
    this.job = q;
    this.buildParams();
    this.buildChecklist();
  }

  get jobProgress(): number {
    return this.job ? Math.min(100, (this.job.completed / Math.max(1, this.job.toComplete)) * 100) : 0;
  }

  get jobRemaining(): number {
    return this.job ? Math.max(0, this.job.toComplete - this.job.completed - this.job.wasted) : 0;
  }

  get jobStdMinutes(): number | null {
    return this.job && this.job.stdPerUnit ? this.jobRemaining * this.job.stdPerUnit : null;
  }

  get jobStop(): StopRow | undefined {
    return this.job ? this.data?.stoppages.find((s) => s.active && s.opId === this.job!.opId) : undefined;
  }

  get offlineFor(): string {
    return this.terminal && !this.terminal.online && this.terminal.lastSync ? this.clock(this.terminal.lastSync) : '';
  }

  // ───────── توقفات (F-PC-035) ─────────

  setStopScope(s: 'terminal' | 'all'): void {
    this.stopScope = s;
    this.buildStops();
  }

  private buildStops(): void {
    if (!this.data || !this.terminal) return;
    const lanesQ = this.stopScope === 'terminal' ? this.queue : this.data.queue;
    const ops = new Set(lanesQ.map((q) => q.opId));
    this.stopRows = this.data.stoppages.filter((s) => ops.has(s.opId)).sort((a, b) => ms(b.start) - ms(a.start));
    const now = SHOP_NOW.getTime();
    const day = new Date(SHOP_NOW);
    day.setUTCHours(6, 0, 0, 0);
    const t0 = day.getTime();
    this.stripFrom = t0;
    const span = now - t0;
    const pos = (t: number) => (Math.max(0, Math.min(span, t - t0)) / span) * 100;
    const seen = new Set<number>();
    this.stopLanes = lanesQ
      .filter((q) => q.start && (q.statusCode === 3 || q.statusCode === 4) && !seen.has(q.opId) && seen.add(q.opId))
      .map((q) => {
        const st = this.stopRows.filter((s) => s.opId === q.opId);
        const from = Math.max(ms(q.start), t0);
        const runMin = Math.max(0, (now - from) / 60000);
        const stopMin = st.filter((s) => !s.excluded).reduce((m, s) => m + s.minutes, 0);
        return {
          q,
          runMin,
          stopMin,
          availability: runMin ? Math.max(0, ((runMin - stopMin) / runMin) * 100) : null,
          blocks: [
            ...(ms(q.start) > t0 ? [{ right: 0, width: pos(ms(q.start)), tone: 'var(--gng-border)', tip: 'قبل از شروع عملیات', active: false }] : []),
            ...st.map((s) => {
              const e = s.end ? ms(s.end) : now;
              return {
                right: pos(ms(s.start)),
                width: Math.max(0.6, pos(e) - pos(ms(s.start))),
                tone: s.excluded ? 'var(--gng-text-muted)' : s.oeeComponent === 2 ? 'var(--gng-warning)' : 'var(--gng-danger)',
                tip: `${s.code} ${s.title} · ${faTime(s.start)}–${s.end ? faTime(s.end) : 'باز'} · ${faInt(s.minutes)} دقیقه`,
                active: s.active,
              };
            }),
          ],
        };
      });
    const byLoss = new Map<string, number>();
    for (const s of this.stopRows) {
      const k = s.excluded ? 'خارج از OEE (برنامه‌ای)' : s.oeeLoss || 'بدون نگاشت OEE';
      byLoss.set(k, (byLoss.get(k) ?? 0) + s.minutes);
    }
    const total = [...byLoss.values()].reduce((a, b) => a + b, 0) || 1;
    this.lossSummary = [...byLoss.entries()]
      .map(([label, minutes]) => ({ label, minutes, pct: (minutes / total) * 100, tone: label === 'بدون نگاشت OEE' ? 'danger' : label.startsWith('خارج') ? 'info' : 'warning' }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  get unmappedStops(): StopRow[] {
    return (this.data?.stoppages ?? []).filter((s) => !s.excluded && !s.oeeLossCode);
  }

  get stripTicks(): { right: number; label: string }[] {
    const span = SHOP_NOW.getTime() - this.stripFrom;
    // پیش از رسیدن داده stripFrom صفر است؛ بدون این نگهبان حلقه از ۱۹۷۰ اجرا می‌شود و صفحه قفل می‌شود
    if (!(this.stripFrom > 0) || span <= 0 || span > 3 * 86400000) return [];
    const out = [];
    for (let t = this.stripFrom; t <= SHOP_NOW.getTime(); t += 3600000) out.push({ right: ((t - this.stripFrom) / span) * 100, label: faTime(new Date(t).toISOString()) });
    return out;
  }

  // ───────── ضایعات (F-PC-070، 071) ─────────

  private buildWaste(): void {
    if (!this.waste || !this.terminal) return;
    const keys = new Set(this.queue.map((q) => `${q.woId}|${q.seq}`));
    const rows = this.waste.filter((w) => keys.has(`${w.woId}|${w.seq}`));
    const label = (w: OpWasteRow) => {
      const q = this.queue.find((x) => x.woId === w.woId && x.seq === w.seq);
      return q ? `${q.woNumber} · ${faInt(q.seq)}` : '';
    };
    this.terminalWaste = {
      setup: rows.filter((w) => w.isSetup).reduce((s, w) => s + w.qty, 0),
      process: rows.filter((w) => !w.isSetup).reduce((s, w) => s + w.qty, 0),
      material: rows.filter((w) => w.material).reduce((s, w) => s + w.qty, 0),
      rows: rows.map((w) => ({ reason: w.reason, parent: w.parent, qty: w.qty, setup: w.isSetup, material: w.material, op: label(w) })).sort((a, b) => b.qty - a.qty),
    };
  }

  get setupShare(): number {
    const t = this.terminalWaste.setup + this.terminalWaste.process;
    return t ? (this.terminalWaste.setup / t) * 100 : 0;
  }

  // ───────── پارامترهای فرایندی (F-PC-036) ─────────

  private buildParams(): void {
    if (!this.data || !this.terminal) return;
    const ops = new Set(this.queue.map((q) => q.opId));
    const groups = new Map<string, ReadingRow[]>();
    for (const r of this.data.readings.filter((x) => ops.has(x.opId))) groups.set(`${r.opId}|${r.paramId}`, [...(groups.get(`${r.opId}|${r.paramId}`) ?? []), r]);
    this.params = [...groups.entries()].map(([key, rows]) => {
      const sorted = rows.sort((a, b) => ms(a.at) - ms(b.at));
      const f = sorted[0];
      const q = this.queue.find((x) => x.opId === f.opId);
      return {
        key, opId: f.opId, title: `${f.title}${q ? ` · ${q.woNumber.slice(-4)}/${faInt(q.seq)}` : ''}`, unit: f.unit, critical: f.critical, action: PARAM_ACTION[f.actionCode] ?? '—',
        min: f.min, max: f.max, target: f.target, rows: sorted, outCount: sorted.filter((r) => this.isOut(r)).length, last: sorted[sorted.length - 1],
      };
    }).sort((a, b) => b.outCount - a.outCount || Number(b.critical) - Number(a.critical));
    // پارامترهایی که برای همان عملیات استاندارد روی دستور دیگری خوانده شده‌اند ولی برای کار جاری خوانشی ندارند
    const job = this.job;
    this.missingParams = [];
    if (job && (job.statusCode === 3 || job.statusCode === 4)) {
      const sameOp = new Set(this.data.queue.filter((q) => q.operationId === job.operationId).map((q) => q.opId));
      const defined = new Map<number, ReadingRow>();
      for (const r of this.data.readings.filter((x) => sameOp.has(x.opId))) defined.set(r.paramId, r);
      const mine = new Set(this.data.readings.filter((r) => r.opId === job.opId).map((r) => r.paramId));
      this.missingParams = [...defined.values()].filter((r) => !mine.has(r.paramId)).map((r) => `${r.title}${r.critical ? ' (بحرانی)' : ''}`);
    }
    const keep = this.params.find((p) => p.opId === job?.opId && p.outCount) ?? this.params.find((p) => p.opId === job?.opId) ?? this.params[0] ?? null;
    this.selectParam(keep);
  }

  isOut(r: ReadingRow): boolean {
    return r.out || (r.min !== null && r.value < r.min) || (r.max !== null && r.value > r.max);
  }

  selectParam(p: ParamSeries | null): void {
    this.param = p;
    if (!p) return;
    const { w, h } = this.cc;
    const padL = 16, padR = 52, padT = 18, padB = 26;
    const vals = p.rows.map((r) => r.value).concat([p.min, p.max, p.target].filter((v): v is number => v !== null));
    const span = Math.max(...vals) - Math.min(...vals) || 1;
    const lo = Math.min(...vals) - span * 0.15;
    const hi = Math.max(...vals) + span * 0.15;
    const y = (v: number) => padT + ((hi - v) / (hi - lo)) * (h - padT - padB);
    const t0 = ms(p.rows[0].at);
    const t1 = Math.max(ms(p.rows[p.rows.length - 1].at), t0 + 60000);
    const x = (t: number) => w - padR - ((t - t0) / (t1 - t0)) * (w - padL - padR);
    const pts: ChartPoint[] = p.rows.map((r) => ({
      x: x(ms(r.at)), y: y(r.value), out: this.isOut(r), label: faNum(r.value),
      tip: `${faTime(r.at)} — ${faNum(r.value)} ${p.unit} (${READING_SOURCE[r.sourceCode] ?? ''})${r.comment ? ' · ' + r.comment : ''}`,
    }));
    this.cc = {
      ...this.cc,
      band: p.min !== null && p.max !== null ? { y: y(p.max), h: y(p.min) - y(p.max) } : { y: 0, h: 0 },
      minY: p.min !== null ? y(p.min) : -10,
      maxY: p.max !== null ? y(p.max) : -10,
      targetY: p.target !== null ? y(p.target) : -10,
      line: pts.map((q) => `${q.x},${q.y}`).join(' '),
      points: pts,
      yLabels: [
        ...(p.max !== null ? [{ y: y(p.max), label: `حد بالا ${faNum(p.max)}` }] : []),
        ...(p.target !== null ? [{ y: y(p.target), label: `هدف ${faNum(p.target)}` }] : []),
        ...(p.min !== null ? [{ y: y(p.min), label: `حد پایین ${faNum(p.min)}` }] : []),
      ],
      xLabels: p.rows.map((r) => ({ x: x(ms(r.at)), label: faTime(r.at) })),
    };
  }

  // ───────── دستورالعمل و چک‌لیست (F-PC-037) ─────────

  private buildChecklist(): void {
    const rows = (this.data?.checklist ?? []).filter((c) => this.job && c.opId === this.job.opId).sort((a, b) => a.seq - b.seq);
    const docs = rows.filter((c) => c.doc);
    const latest = new Map<string, number>();
    for (const d of docs) latest.set(d.doc, Math.max(latest.get(d.doc) ?? 0, d.rev ?? 0));
    this.docs = docs.map((d) => ({ ...d, superseded: (d.rev ?? 0) < (latest.get(d.doc) ?? 0) }));
    this.checks = rows.filter((c) => !c.doc);
  }

  get checksDone(): number {
    return this.checks.filter((c) => c.done).length;
  }

  get checkIssues(): string[] {
    const out: string[] = [];
    if (this.job && this.job.statusCode >= 3) for (const c of this.checks.filter((x) => x.isControl && !x.done)) out.push(`کنترل «${c.description}» انجام نشده ولی عملیات شروع شده است`);
    for (const d of this.docs.filter((x) => x.superseded)) out.push(`${d.doc} نسخه‌ی ${faInt(d.rev)} منسوخ است ولی هنوز به عملیات وصل است`);
    for (const d of this.docs.filter((x) => !x.done && x.doneAt)) out.push(`${d.doc}: زمان انجام ثبت شده ولی «انجام‌نشده» است`);
    return out;
  }

  /** همه‌ی کنترل‌های انجام‌نشده روی عملیات در جریان (برای سرآیند) */
  get openControls(): { q: QueueRow; c: CheckRow }[] {
    if (!this.data) return [];
    const out: { q: QueueRow; c: CheckRow }[] = [];
    for (const c of this.data.checklist.filter((x) => x.isControl && !x.done && !x.doc)) {
      const q = this.data.queue.find((x) => x.opId === c.opId && x.statusCode >= 3);
      if (q) out.push({ q, c });
    }
    return out;
  }

  // ───────── داده‌ی دستگاه (F-PC-038، 039) ─────────

  setDeviceScope(s: 'terminal' | 'all'): void {
    this.deviceScope = s;
    this.buildDevices();
  }

  private terminalOfRef(ref: string): TerminalRow | undefined {
    const m = /^RP-(\d+)-(\d+)-/.exec(ref);
    if (!m || !this.data) return undefined;
    const q = this.data.queue.find((x) => x.woNumber.endsWith(`-${m[1]}`) && x.seq === +m[2]);
    return q ? this.data.terminals.find((t) => t.id === q.terminalId) : undefined;
  }

  buildDevices(): void {
    if (!this.data || !this.terminal) return;
    const all = this.data.device.map((d) => {
      const t = this.terminalOfRef(d.refNumber);
      const threshold = this.deviceScope === 'terminal' ? this.whatIfThreshold : t?.threshold ?? null;
      const dev = d.deviation ?? (d.userValue !== null && d.result ? (Math.abs(d.result - d.userValue) / d.result) * 100 : null);
      const over = threshold !== null && dev !== null && dev > threshold;
      const needsNote = over && !d.note;
      const auto = !!t?.autoAccept && !over;
      const status = needsNote ? 'توضیح انحراف الزامی — ثبت نشده' : d.applied ? (auto ? 'پذیرش خودکار' : 'تأییدشده') : 'منتظر تأیید کاربر';
      return { d, threshold, terminal: t?.number ?? '—', over, needsNote, status, tone: needsNote ? 'danger' : !d.applied ? 'warning' : over ? 'info' : 'success' } as DeviceView;
    });
    this.devices = this.deviceScope === 'terminal' ? all.filter((v) => v.terminal === this.terminal!.number) : all;
  }

  devWidth(v: number | null, d: DeviceRow): number {
    const m = Math.max(d.result, d.userValue ?? 0) || 1;
    return ((v ?? 0) / m) * 100;
  }

  get deviceAlerts(): DeviceRow[] {
    if (!this.data) return [];
    return this.data.device.filter((d) => {
      const t = this.terminalOfRef(d.refNumber);
      return t?.threshold !== null && t?.threshold !== undefined && (d.deviation ?? 0) > t.threshold && !d.note;
    });
  }

  // ───────── سرآیند ─────────

  get outReadings(): ReadingRow[] {
    return (this.data?.readings ?? []).filter((r) => this.isOut(r));
  }

  get contextLabel(): string {
    return this.terminal ? `${this.terminal.number} — ${this.terminal.station}` : 'ترمینال';
  }

  private get issues(): { tone: 'danger' | 'warning'; text: string }[] {
    if (!this.data) return [];
    const out: { tone: 'danger' | 'warning'; text: string }[] = [];
    for (const t of this.data.terminals.filter((x) => !x.online)) out.push({ tone: 'danger', text: `${t.number} آفلاین از ${faTime(t.lastSync)} با ${faInt(t.pending)} رکورد همگام‌نشده` });
    for (const s of this.data.stoppages.filter((x) => x.active)) {
      const q = this.data.queue.find((x) => x.opId === s.opId);
      out.push({ tone: 'danger', text: `توقف باز ${s.code} (${s.title}) روی ${q?.woNumber ?? ''} عملیات ${faInt(q?.seq)} از ${faTime(s.start)}` });
    }
    for (const r of this.outReadings) out.push({ tone: r.critical ? 'danger' : 'warning', text: `${r.title} ${faNum(r.value)} ${r.unit} ساعت ${faTime(r.at)} خارج از محدوده` });
    for (const c of this.openControls) out.push({ tone: 'danger', text: `کنترل «${c.c.description}» روی ${c.q.woNumber} عملیات ${faInt(c.q.seq)} انجام نشده` });
    for (const d of this.deviceAlerts) out.push({ tone: 'warning', text: `انحراف ${faPct(d.deviation, 2)} داده‌ی دستگاه در ${d.refNumber} بدون توضیح` });
    const wcs = new Map<number, QueueRow[]>();
    for (const t of this.data.terminals.filter((x) => x.workCenterId)) wcs.set(t.id, this.queueOf(t.id).filter((q) => q.statusCode === 3));
    for (const [id, rows] of wcs) if (rows.length > 1) out.push({ tone: 'warning', text: `هم‌پوشانی ایستگاه ${this.data.terminals.find((t) => t.id === id)?.station}: ${rows.map((q) => q.woNumber).join(' و ')}` });
    if (this.unmappedStops.length) out.push({ tone: 'warning', text: `${faInt(this.unmappedStops.length)} توقف بدون نگاشت به زیان OEE` });
    return out;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const i = this.issues;
    return i.some((x) => x.tone === 'danger') ? 'danger' : i.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc05_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن…';
    const i = this.issues;
    return i.length ? i.map((x) => x.text).join('؛ ') + '.' : 'همه‌ی ترمینال‌ها آنلاین‌اند و هشداری نیست.';
  }

  oeeComp(c: number | null): string {
    return c === null ? '—' : OEE_COMPONENT[c] ?? '—';
  }

  media(c: number | null): { label: string; icon: string } {
    return (c !== null && MEDIA[c]) || { label: 'سند', icon: 'pi pi-file' };
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
