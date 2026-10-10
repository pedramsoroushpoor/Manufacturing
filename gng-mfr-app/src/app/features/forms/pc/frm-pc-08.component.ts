import { Component, OnInit } from '@angular/core';
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
import { STOCK_QC, Tone, WO_TYPE, faDateTime, faInt, faNum, faPct, faTime } from './pc-shared';
import { BALANCE_SOURCE, BalanceRow, RecoveryReceipt, RecoveryStandard, gaugeArc, gaugePoint } from './frm-pc-08.data';
import { FrmPc08Service } from './frm-pc-08.service';

type Level = 'ok' | 'warn' | 'bad';
interface WoItem { id: number; wo: string; type: string; alerts: number }
interface RateView {
  r: RecoveryReceipt; dev: number; level: Level; band: string; valueArc: string; needle: { x: number; y: number }; stdMark: { x: number; y: number };
  needed: number; shortfall: number; std: RecoveryStandard | undefined; why: string; purityOk: boolean | null; cycles: { n: number; state: 'done' | 'now' | 'free' }[];
}
interface BalView { b: BalanceRow; segs: { label: string; pct: number; qty: number; color: string }[]; level: Level; equation: string; tol: number }
interface Bar { x: number; y: number; h: number; w: number; color: string; label: string; lx: number; ly: number }

/**
 * FRM-PC-08 — «بازیابی مواد در اجرا».
 *
 * رسید ماده‌ی بازیابی‌شده (حلال) به‌عنوان خروجی رسمی دستور با بچ جدید و شمارنده‌ی چرخه، مقایسه‌ی نرخ واقعی
 * با استاندارد روی گیج با باند آستانه (و منبع استاندارد: مسیر یا ماده)، موازنه‌ی ماده (ورودی = بازیابی + تلفات +
 * در فرایند + اختلاف) و موازنه‌ی جرم پیوسته‌ی توتالایزر در برابر خروجی و مصرف ثبت‌شده در سامانه.
 *
 * فاز اول (فقط‌خواندنی): F-PC-065، 066، 067 و 068. ثبت رسید بازیابی، ثبت اندازه‌گیری موازنه و اقدام روی
 * هشدارها با مرحله‌ی ایجاد/ویرایش می‌آید.
 */
@Component({
  selector: 'gng-frm-pc-08',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SliderModule, TabViewModule, TableModule, TagModule, TooltipModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-pc-08.component.html',
  styles: [`
    .wo-list { display: flex; flex-direction: column; gap: .3rem; }
    .wo-item { padding: .45rem .6rem; border: 1px solid var(--gng-border); border-radius: var(--gng-radius); cursor: pointer; font-size: .8rem; background: var(--gng-surface); }
    .wo-item--on { border-color: var(--gng-primary); box-shadow: inset -3px 0 0 var(--gng-primary); }
    .wo-item small { display: block; color: var(--gng-text-muted); }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: .8rem; }
    .rcard { border: 1px solid var(--gng-border); border-radius: var(--gng-radius); padding: .75rem .85rem; background: var(--gng-surface); font-size: .8rem; position: relative; }
    .rcard--bad { border-color: var(--gng-danger); box-shadow: inset -4px 0 0 var(--gng-danger); }
    .rcard--warn { border-color: var(--gng-warning); box-shadow: inset -4px 0 0 var(--gng-warning); }
    .batch { font-family: monospace; font-size: 1.25rem; font-weight: 800; direction: ltr; display: inline-block; }
    .mono { font-family: monospace; direction: ltr; display: inline-block; }
    .dots { display: flex; gap: .3rem; align-items: center; }
    .dot { width: 1.5rem; height: 1.5rem; border-radius: 50%; display: grid; place-items: center; font-size: .7rem; border: 2px solid var(--gng-border); }
    .dot--done { background: var(--gng-text-muted); color: #fff; border-color: var(--gng-text-muted); }
    .dot--now { background: var(--gng-primary); color: #fff; border-color: var(--gng-primary); }
    .purity { position: relative; height: 12px; background: var(--gng-bg); border: 1px solid var(--gng-border); border-radius: 6px; margin-top: .25rem; }
    .purity__fill { position: absolute; top: 0; bottom: 0; right: 0; border-radius: 6px; }
    .purity__min { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--gng-text); }
    .gauges { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: .8rem; }
    .stack { display: flex; height: 26px; border-radius: 5px; overflow: hidden; border: 1px solid var(--gng-border); direction: rtl; }
    .stack > div { height: 100%; display: grid; place-items: center; color: #fff; font-size: .68rem; white-space: nowrap; overflow: hidden; }
    .chips { display: flex; flex-wrap: wrap; gap: .35rem; }
    .row-bad td { background: rgba(235, 87, 87, .07); }
  `],
})
export class FrmPc08Component implements OnInit {
  receipts: RecoveryReceipt[] = [];
  balances: BalanceRow[] = [];
  standards: RecoveryStandard[] = [];
  woList: WoItem[] = [];
  selectedWoId: number | null = null;

  /** آستانه‌ی فرضی (واحد درصد)؛ null = همان آستانه‌ی ثبت‌شده */
  thresholdWhatIf: number | null = null;
  toleranceWhatIf: number | null = null;
  massTolWhatIf: number | null = null;

  rates: RateView[] = [];
  bals: BalView[] = [];
  mass: BalanceRow[] = [];
  massBars: Bar[] = [];
  massTolY = 0;
  massTol = 1.5;
  massTotals = { input: 0, output: 0, loss: 0, inProcess: 0, gap: 0, gapPct: 0, posted: 0 };
  readonly chart = { w: 560, h: 220, top: 20, bottom: 40 };

  loading = false;
  loadFailed = false;
  readonly companyId = DEMO_COMPANY_ID;
  readonly faNum = faNum; readonly faInt = faInt; readonly faPct = faPct; readonly faDateTime = faDateTime; readonly faTime = faTime;
  readonly STOCK_QC = STOCK_QC; readonly BALANCE_SOURCE = BALANCE_SOURCE; readonly WO_TYPE = WO_TYPE;
  readonly gaugeTrack = gaugeArc(100, 95, 75, 0, 100);

  constructor(private pc08: FrmPc08Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.pc08.bundle(this.companyId).subscribe({
      next: (b) => {
        this.receipts = b.receipts;
        this.balances = b.balances;
        this.standards = b.standards;
        this.refresh();
        const ids = [...new Set([...b.receipts.map((r) => r.woId), ...b.balances.map((x) => x.woId)])];
        this.woList = ids.map((id) => {
          const wo = b.receipts.find((r) => r.woId === id)?.wo ?? b.balances.find((x) => x.woId === id)?.wo ?? '';
          const type = WO_TYPE[b.receipts.find((r) => r.woId === id)?.woType ?? 0] ?? '';
          const alerts = this.rates.filter((v) => v.r.woId === id && v.level === 'bad').length + this.bals.filter((v) => v.b.woId === id && v.level === 'bad').length
            + this.mass.filter((m) => m.woId === id && Math.abs(m.gapPct) > m.tolerance).length;
          return { id, wo, type, alerts };
        });
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-PC-08] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  pickWo(id: number | null): void {
    this.selectedWoId = id;
    this.refresh();
  }

  refresh(): void {
    const inWo = <T extends { woId: number }>(rows: T[]) => (this.selectedWoId === null ? rows : rows.filter((r) => r.woId === this.selectedWoId));
    this.rates = inWo(this.receipts).map((r) => this.rateView(r));
    this.bals = inWo(this.balances.filter((b) => b.type === 1)).map((b) => this.balView(b));
    this.mass = inWo(this.balances.filter((b) => b.type === 2));
    this.buildMassChart();
  }

  // ───────── نرخ واقعی (066) و رسید (065) ─────────

  private rateView(r: RecoveryReceipt): RateView {
    const th = this.thresholdWhatIf ?? r.threshold;
    const dev = r.actual - r.standard;
    const level: Level = Math.abs(dev) > th ? 'bad' : Math.abs(dev) > th / 2 ? 'warn' : 'ok';
    const std = this.standards.find((s) => s.recovered === r.recovered);
    const needed = (r.standard * r.sourceInput) / 100;
    const why = std
      ? r.standardSource.indexOf('مسیر') >= 0
        ? `استاندارد از عملیات «${std.routingOp}» مسیر (${faPct(std.routingRate)}) آمده که بر استاندارد ماده (${faPct(std.standard)}) مقدم است.`
        : `عملیات «${r.opTitle}» در مسیر نرخ بازیابی ندارد؛ استاندارد ماده‌ی ${std.code} (${faPct(std.standard)}) به کار رفت — نه ${faPct(std.routingRate)} عملیات «${std.routingOp}».`
      : '';
    const max = r.maxCycles ?? 0;
    return {
      r, dev, level, std, why, needed, shortfall: Math.max(needed - r.qty, 0),
      band: gaugeArc(100, 95, 75, r.standard - th, r.standard + th),
      valueArc: gaugeArc(100, 95, 75, 0, r.actual),
      needle: gaugePoint(100, 95, 62, r.actual),
      stdMark: gaugePoint(100, 95, 86, r.standard),
      purityOk: r.purity === null || r.minPurity === null ? null : r.purity >= r.minPurity,
      cycles: Array.from({ length: Math.max(max, r.cycle) }, (_, i) => ({ n: i + 1, state: (i + 1 < r.cycle ? 'done' : i + 1 === r.cycle ? 'now' : 'free') as 'done' | 'now' | 'free' })),
    };
  }

  levelTone(l: Level): Tone {
    return l === 'bad' ? 'danger' : l === 'warn' ? 'warning' : 'success';
  }

  levelColor(l: Level): string {
    return l === 'bad' ? 'var(--gng-danger)' : l === 'warn' ? 'var(--gng-warning)' : 'var(--gng-success)';
  }

  qcTone(c: number | null): Tone {
    return c === 1 ? 'success' : c === 2 ? 'warning' : c === 3 ? 'danger' : 'secondary';
  }

  purityWidth(v: number | null): number {
    return v === null ? 0 : Math.max(Math.min(((v - 85) / 15) * 100, 100), 0);
  }

  setThreshold(v: number | null): void {
    this.thresholdWhatIf = v;
    this.refresh();
  }

  // ───────── موازنه‌ی ماده (067) ─────────

  private balView(b: BalanceRow): BalView {
    const tol = this.toleranceWhatIf ?? b.tolerance;
    const pct = (q: number) => (b.input ? (Math.abs(q) * 100) / b.input : 0);
    const absGap = Math.abs(b.gapPct);
    const level: Level = absGap > tol ? 'bad' : absGap > tol / 2 ? 'warn' : 'ok';
    return {
      b, tol, level,
      segs: [
        { label: 'بازیابی', pct: pct(b.output), qty: b.output, color: 'var(--gng-success)' },
        { label: 'تلفات', pct: pct(b.loss), qty: b.loss, color: 'var(--gng-warning)' },
        { label: 'در فرایند', pct: pct(b.inProcess), qty: b.inProcess, color: 'var(--gng-info)' },
        { label: 'اختلاف', pct: pct(b.gap), qty: b.gap, color: level === 'bad' ? 'var(--gng-danger)' : 'rgba(130,130,130,.6)' },
      ],
      equation: `${faNum(b.input)} = ${faNum(b.output)} + ${faNum(b.loss)} + ${faNum(b.inProcess)} + ${faNum(b.gap)}`,
    };
  }

  setTolerance(v: number | null): void {
    this.toleranceWhatIf = v;
    this.refresh();
  }

  // ───────── موازنه‌ی جرم پیوسته (068) ─────────

  private buildMassChart(): void {
    const m = this.mass;
    this.massTol = this.massTolWhatIf ?? m[0]?.tolerance ?? 1.5;
    const sum = (f: (b: BalanceRow) => number) => m.reduce((s, b) => s + f(b), 0);
    const t = { input: sum((b) => b.input), output: sum((b) => b.output), loss: sum((b) => b.loss), inProcess: sum((b) => b.inProcess), gap: sum((b) => b.gap), gapPct: 0, posted: sum((b) => b.posted ?? 0) };
    t.gapPct = t.input ? (t.gap * 100) / t.input : 0;
    this.massTotals = t;
    const vals = m.flatMap((b) => [Math.abs(b.gapPct), Math.abs(this.postedDiffPct(b))]);
    const max = Math.max(...vals, this.massTol, 0.5) * 1.25;
    const { w, h, top, bottom } = this.chart;
    const plotH = h - top - bottom;
    const y = (v: number) => top + plotH - (Math.abs(v) / max) * plotH;
    const slot = (w - 40) / Math.max(m.length, 1);
    this.massBars = m.flatMap((b, i) => {
      const x0 = w - 20 - slot * (i + 1) + slot * 0.2; // راست‌به‌چپ: گزارش اول در راست
      const bw = slot * 0.28;
      const g = Math.abs(b.gapPct);
      const p = Math.abs(this.postedDiffPct(b));
      return [
        { x: x0 + bw + 4, y: y(g), h: top + plotH - y(g), w: bw, color: g > this.massTol ? 'var(--gng-danger)' : 'var(--gng-success)', label: faPct(b.gapPct, 2), lx: x0 + bw * 1.5 + 4, ly: y(g) - 4 },
        { x: x0, y: y(p), h: top + plotH - y(p), w: bw, color: 'var(--gng-purple)', label: faPct(this.postedDiffPct(b), 2), lx: x0 + bw / 2, ly: y(p) - 4 },
      ];
    });
    this.massTolY = y(this.massTol);
  }

  massLabelX(i: number): number {
    const slot = (this.chart.w - 40) / Math.max(this.mass.length, 1);
    return this.chart.w - 20 - slot * (i + 1) + slot * 0.5;
  }

  /** تفاوت توتالایزر با مصرف ثبت‌شده در سامانه */
  postedDiffPct(b: BalanceRow): number {
    return b.posted === null || !b.input ? 0 : ((b.input - b.posted) * 100) / b.input;
  }

  setMassTol(v: number | null): void {
    this.massTolWhatIf = v;
    this.buildMassChart();
  }

  // ───────── سرآیند ─────────

  private get issues(): { tone: 'danger' | 'warning'; text: string }[] {
    const out: { tone: 'danger' | 'warning'; text: string }[] = [];
    for (const v of this.rates.filter((x) => x.level === 'bad'))
      out.push({ tone: 'danger', text: `${v.r.wo} ${v.r.report}: نرخ بازیابی ${faPct(v.r.actual)} در برابر استاندارد ${faPct(v.r.standard)} (کسری ${faNum(v.shortfall)} ${v.r.unit})` });
    for (const v of this.rates.filter((x) => x.purityOk === false))
      out.push({ tone: 'danger', text: `خلوص بچ ${v.r.batch} ${faPct(v.r.purity)} کمتر از حداقل ${faPct(v.r.minPurity)} — نباید به فرمول برگردد` });
    for (const v of this.bals.filter((x) => x.level === 'bad'))
      out.push({ tone: 'danger', text: `موازنه‌ی ${v.b.report}: اختلاف ${faPct(v.b.gapPct)} بیرون از تلورانس ${faPct(v.tol)}` });
    for (const m of this.mass.filter((x) => Math.abs(x.gapPct) > this.massTol))
      out.push({ tone: 'warning', text: `موازنه‌ی جرم ${m.report}: اختلاف ${faNum(m.gap)} ${m.unit} (${faPct(m.gapPct)}) بیش از ${faPct(this.massTol)}` });
    const posted = this.mass.filter((x) => x.posted !== null && Math.abs(this.postedDiffPct(x)) > this.massTol);
    if (posted.length) out.push({ tone: 'warning', text: `مصرف ثبت‌شده‌ی ${posted.map((p) => p.report).join('، ')} با توتالایزر نمی‌خواند` });
    return out;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const i = this.issues;
    return i.some((x) => x.tone === 'danger') ? 'danger' : i.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc08_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن…';
    const i = this.issues;
    return i.length ? i.map((x) => x.text).join('؛ ') + '.' : 'نرخ‌های بازیابی و موازنه‌ها در تلورانس‌اند.';
  }

  get contextLabel(): string {
    return this.woList.find((w) => w.id === this.selectedWoId)?.wo ?? 'همه‌ی دستورهای دارای بازیابی';
  }

  get badRates(): number {
    return this.rates.filter((r) => r.level === 'bad').length;
  }

  get badBals(): number {
    return this.bals.filter((r) => r.level === 'bad').length;
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
