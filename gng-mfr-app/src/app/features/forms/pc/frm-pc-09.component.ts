import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SliderModule } from 'primeng/slider';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import {
  CONTRACTOR_DISPOSITION, DECISION_STATUS, NC_SOURCE, NC_TYPE, SHOP_NOW, STOCK_QC, Tone, WO_STATUS, WO_TYPE, faDateTime, faDay, faInt, faNum, faPct, faTime,
} from './pc-shared';
import { COPQ_GROUPS, ChainRow, CopqRow, Disposition, NC_TYPE_COLOR, NcOperation, NcOrder, NcReport, RecoveredStock } from './frm-pc-09.data';
import { FrmPc09Service } from './frm-pc-09.service';

interface WoItem { id: number; wo: string; line: string; pending: number; total: number }
interface Lane { code: number; label: string; items: Disposition[]; qtyText: string; cost: number; pending: number }
interface OrderView { o: NcOrder; ops: NcOperation[]; keptOps: number; warnings: string[]; feeds: Disposition[] }
interface StockView { s: RecoveredStock; reasons: string[]; ok: boolean; last: boolean }
interface ParetoBar { key: string; value: number; recovered: number; penalty: number; cases: number; pct: number; cum: number; width: number }

/**
 * FRM-PC-09 — «ضایعات، دوباره‌کاری و بازیافت».
 *
 * تابلوی تعیین تکلیف خروجی نامنطبق در چهار مسیر (اسقاط، قابل بازیافت، قابل دوباره‌کاری، درجه‌دو) با برجسته‌سازی
 * موارد منتظر تصمیم و نیازمند موافقت مشتری، دستور دوباره‌کاری با مقایسه‌ی عملیات مبدا/نگه‌داشته، دستور بازیافت با
 * پیوند صریح به دستور مبدا و شرایط بازگشت به فرمول (خلوص، چرخه، QC، درصد اختلاط) و ماشین‌حساب اختلاط، گزارش
 * اجرای دوباره‌کاری، درجه‌بندی مجدد با اثر ارزش، ضایعات پیمانکار با شبیه‌سازی حد مجاز و جریمه، زنجیره‌ی
 * دوباره‌کاری چندباره و پارتوی COPQ با گروه‌بندی قابل تغییر.
 *
 * فاز اول (فقط‌خواندنی): F-PC-069، 072 تا 079. ثبت تصمیم، صدور دستور دوباره‌کاری/بازیافت، سند انبار درجه‌بندی
 * و ثبت جریمه‌ی پیمانکار با مرحله‌ی ایجاد/ویرایش می‌آید.
 */
@Component({
  selector: 'gng-frm-pc-09',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, DropdownModule, InputNumberModule, InputTextModule, SelectButtonModule, SliderModule, TabViewModule, TableModule, TagModule,
    TooltipModule, OperationalFormLayoutComponent, DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pc-09.component.html',
  styles: [`
    .wo-list { display: flex; flex-direction: column; gap: .3rem; }
    .wo-item { padding: .45rem .6rem; border: 1px solid var(--gng-border); border-radius: var(--gng-radius); cursor: pointer; font-size: .8rem; background: var(--gng-surface); }
    .wo-item--on { border-color: var(--gng-primary); box-shadow: inset -3px 0 0 var(--gng-primary); }
    .wo-item small { display: block; color: var(--gng-text-muted); }
    .chips { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; }
    .chip { padding: .2rem .65rem; border-radius: 999px; border: 1px solid var(--gng-border); font-size: .76rem; cursor: pointer; background: var(--gng-surface); }
    .chip--on { background: var(--gng-primary); color: #fff; border-color: var(--gng-primary); }
    .board { display: grid; grid-template-columns: repeat(4, minmax(210px, 1fr)); gap: .6rem; overflow-x: auto; }
    .lane { background: var(--gng-bg); border-radius: var(--gng-radius); padding: .5rem; border-top: 4px solid var(--gng-border); min-width: 210px; }
    .lane h4 { margin: 0 0 .2rem; font-size: .85rem; }
    .ncard { background: var(--gng-surface); border: 1px solid var(--gng-border); border-radius: var(--gng-radius); padding: .45rem .55rem; margin-top: .4rem; font-size: .74rem; }
    .ncard--pending { border-color: var(--gng-warning); box-shadow: inset -4px 0 0 var(--gng-warning); }
    .ncard--consent { border-color: var(--gng-purple); box-shadow: inset -4px 0 0 var(--gng-purple); }
    .mono { font-family: monospace; direction: ltr; display: inline-block; }
    .ops { display: flex; flex-direction: column; gap: .25rem; }
    .op { display: flex; gap: .5rem; align-items: center; padding: .3rem .5rem; border: 1px solid var(--gng-border); border-radius: 4px; font-size: .8rem; }
    .op--off { opacity: .5; text-decoration: line-through; background: var(--gng-bg); }
    .op--kept { border-color: var(--gng-success); background: rgba(39, 174, 96, .07); }
    .bar { height: 18px; border-radius: 3px; display: flex; overflow: hidden; background: var(--gng-bg); }
    .pareto td { padding: .3rem .4rem; font-size: .78rem; vertical-align: middle; }
    .cum { height: 4px; background: var(--gng-primary); border-radius: 2px; margin-top: 2px; }
    .chain { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; }
    .chain-node { border: 2px solid var(--gng-border); border-radius: var(--gng-radius); padding: .35rem .55rem; font-size: .75rem; background: var(--gng-surface); }
    .chain-node--over { border-color: var(--gng-danger); background: rgba(235, 87, 87, .07); }
    .chain-node--at { border-color: var(--gng-warning); }
    .row-bad td { background: rgba(235, 87, 87, .07); }
  `],
})
export class FrmPc09Component implements OnInit {
  dispositions: Disposition[] = [];
  orders: NcOrder[] = [];
  operations: NcOperation[] = [];
  reports: NcReport[] = [];
  chains: ChainRow[] = [];
  copq: CopqRow[] = [];
  recovered: RecoveredStock[] = [];

  woList: WoItem[] = [];
  selectedWoId: number | null = null;

  decisionFilter = 0;
  readonly decisionChips = [{ code: 0, label: 'همه' }, { code: 1, label: 'منتظر تصمیم' }, { code: 2, label: 'تصمیم گرفته شد' }, { code: 3, label: 'اجراشده' }];
  lanes: Lane[] = [];

  reworkViews: OrderView[] = [];
  recycleViews: OrderView[] = [];
  chainGroups: { batch: string; product: string; rows: ChainRow[]; over: boolean }[] = [];
  stock: StockView[] = [];

  // ماشین‌حساب اختلاط
  mixBatch = '';
  mixBatchOptions: { label: string; value: string }[] = [];
  mixFormulaQty = 200;
  mixUseQty = 50;

  // پیمانکار
  contractorRows: Disposition[] = [];
  contractBase = 500000;
  contractTol = 0.5;
  penaltyRate = 120;

  // COPQ
  copqGroup = 'reason';
  copqMeasure = 'net';
  readonly copqGroups = COPQ_GROUPS;
  readonly copqMeasures = [{ label: 'هزینه‌ی خالص', value: 'net' }, { label: 'ناخالص (+ ارزش بازیافتی)', value: 'gross' }, { label: 'پس از جریمه', value: 'afterPenalty' }];
  pareto: ParetoBar[] = [];
  copqTotals = { cost: 0, recovered: 0, penalty: 0, cases: 0 };

  loading = false;
  loadFailed = false;
  readonly companyId = DEMO_COMPANY_ID;
  readonly faNum = faNum; readonly faInt = faInt; readonly faPct = faPct; readonly faDateTime = faDateTime; readonly faDay = faDay; readonly faTime = faTime;
  readonly NC_TYPE = NC_TYPE; readonly NC_SOURCE = NC_SOURCE; readonly DECISION_STATUS = DECISION_STATUS; readonly CONTRACTOR_DISPOSITION = CONTRACTOR_DISPOSITION;
  readonly STOCK_QC = STOCK_QC; readonly WO_STATUS = WO_STATUS; readonly WO_TYPE = WO_TYPE; readonly NC_TYPE_COLOR = NC_TYPE_COLOR;

  constructor(private pc09: FrmPc09Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.pc09.bundle(this.companyId).subscribe({
      next: (b) => {
        Object.assign(this, b);
        const ids = [...new Set(b.dispositions.map((d) => d.woId))];
        this.woList = ids
          .map((id) => {
            const rows = b.dispositions.filter((d) => d.woId === id);
            return { id, wo: rows[0].wo, line: rows[0].line, pending: rows.filter((d) => d.decision === 1).length, total: rows.length };
          })
          .sort((a, c) => c.pending - a.pending || c.wo.localeCompare(a.wo));
        this.stock = b.recovered.map((s) => this.stockView(s));
        this.mixBatchOptions = b.recovered.map((s) => ({ label: `${s.batch} — ${faNum(s.onHand)}`, value: s.batch }));
        this.mixBatch = b.recovered.find((s) => s.code === 'RC-ETH' && s.qc === 1)?.batch ?? b.recovered[0]?.batch ?? '';
        this.contractorRows = b.dispositions.filter((d) => d.sourceType === 3);
        const groups = new Map<string, ChainRow[]>();
        for (const c of b.chains) groups.set(c.batch, [...(groups.get(c.batch) ?? []), c]);
        this.chainGroups = [...groups.entries()].map(([batch, rows]) => ({ batch, product: rows[0].product, rows: rows.sort((x, y) => x.cycle - y.cycle), over: rows.some((r) => r.limit === 2) }));
        this.refresh();
        this.buildPareto();
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-PC-09] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  pickWo(id: number | null): void {
    this.selectedWoId = id;
    this.refresh();
  }

  setDecision(c: number): void {
    this.decisionFilter = c;
    this.buildLanes();
  }

  refresh(): void {
    this.buildLanes();
    const view = (o: NcOrder): OrderView => {
      const ops = this.operations.filter((x) => x.woId === o.woId).sort((a, c) => a.seq - c.seq);
      const warnings: string[] = [];
      const kept = ops.filter((x) => x.kept);
      /* دستور بازیافت روش ساخت خودش را دارد (آسیاب و گرانولاسیون)، پس نگه‌نداشتن عملیات مبدا عادی است */
      if (!kept.length && o.woType !== 4) warnings.push('هیچ عملیاتی از مسیر مبدا نگه داشته نشده — دستور مسیر اجرایی ندارد.');
      for (const k of kept.filter((x) => x.sourceMaterials > 0 && x.keptMaterials === 0))
        warnings.push(`عملیات ${faInt(k.seq)} «${k.title}» نگه داشته شده ولی هیچ‌یک از ${faInt(k.sourceMaterials)} قلم مواد آن نه — بدون مواد اجرا نمی‌شود.`);
      if (o.woType === 4 && o.maxMix === null) warnings.push(`حداکثر درصد اختلاط برای ${o.recoveredCode || 'ماده‌ی بازیافتی'} تعریف نشده.`);
      return { o, ops, keptOps: kept.length, warnings, feeds: this.dispositions.filter((d) => d.targetWo === o.number) };
    };
    const inWo = (o: NcOrder) => this.selectedWoId === null || o.woId === this.selectedWoId || o.sourceWoId === this.selectedWoId;
    this.reworkViews = this.orders.filter((o) => o.woType === 3 && inWo(o)).map(view);
    this.recycleViews = this.orders.filter((o) => o.woType === 4 && inWo(o)).map(view);
  }

  private inWo(rows: Disposition[]): Disposition[] {
    return this.selectedWoId === null ? rows : rows.filter((r) => r.woId === this.selectedWoId);
  }

  // ───────── تعیین تکلیف (069) ─────────

  private buildLanes(): void {
    const base = this.inWo(this.dispositions).filter((d) => !this.decisionFilter || d.decision === this.decisionFilter);
    this.lanes = [1, 2, 3, 4].map((c) => {
      const items = base.filter((d) => d.ncType === c).sort((a, b) => a.decision - b.decision || (b.reportedAt ?? '').localeCompare(a.reportedAt ?? ''));
      const units = new Map<string, number>();
      for (const d of items) units.set(d.unit, (units.get(d.unit) ?? 0) + d.qty);
      return {
        code: c, label: NC_TYPE[c], items, cost: items.reduce((s, d) => s + d.cost, 0), pending: items.filter((d) => d.decision === 1).length,
        qtyText: [...units.entries()].map(([u, q]) => `${faNum(q)} ${u}`).join(' · ') || '—',
      };
    });
  }

  decisionTone(c: number): Tone {
    return c === 1 ? 'warning' : c === 2 ? 'info' : 'success';
  }

  needsConsent(d: Disposition): boolean {
    return d.customerOwned && d.decision === 1;
  }

  get pendingCount(): number {
    return this.dispositions.filter((d) => d.decision === 1).length;
  }

  // ───────── بازیافت (073، 074) ─────────

  private stockView(s: RecoveredStock): StockView {
    const reasons: string[] = [];
    if (s.purity === null && s.minPurity !== null) reasons.push('خلوص اندازه‌گیری نشده');
    if (s.purity !== null && s.minPurity !== null && s.purity < s.minPurity) reasons.push(`خلوص ${faPct(s.purity)} < ${faPct(s.minPurity)}`);
    if (s.cycle !== null && s.maxCycles !== null && s.cycle > s.maxCycles) reasons.push('بیش از سقف چرخه');
    if (s.requiresQc && s.qc !== 1) reasons.push('منتظر آزادسازی QC');
    if (s.expire && s.expire < SHOP_NOW.toISOString()) reasons.push('منقضی');
    return { s, reasons, ok: !reasons.length, last: s.cycle !== null && s.maxCycles !== null && s.cycle === s.maxCycles };
  }

  get mixStock(): StockView | undefined {
    return this.stock.find((v) => v.s.batch === this.mixBatch);
  }

  get mixPct(): number {
    return this.mixFormulaQty ? (this.mixUseQty * 100) / this.mixFormulaQty : 0;
  }

  get mixVerdict(): { tone: 'success' | 'warning' | 'danger'; text: string } {
    const v = this.mixStock;
    if (!v) return { tone: 'warning', text: 'بچی انتخاب نشده.' };
    if (!v.ok) return { tone: 'danger', text: `${v.s.batch} قابل بازگشت به فرمول نیست: ${v.reasons.join('، ')}.` };
    if (this.mixUseQty > v.s.onHand) return { tone: 'danger', text: `موجودی ${faNum(v.s.onHand)} کمتر از مقدار درخواستی است.` };
    if (v.s.maxMix === null) return { tone: 'warning', text: 'حد اختلاط برای این ماده تعریف نشده؛ کنترل درصد ممکن نیست.' };
    if (this.mixPct > v.s.maxMix) return { tone: 'danger', text: `اختلاط ${faPct(this.mixPct)} بیش از حد مجاز ${faPct(v.s.maxMix)} است؛ حداکثر ${faNum((v.s.maxMix * this.mixFormulaQty) / 100)} قابل مصرف است.` };
    return { tone: 'success', text: `مجاز: ${faPct(this.mixPct)} از حد ${faPct(v.s.maxMix)}${v.last ? ' — آخرین چرخه‌ی این ماده' : ''}.` };
  }

  stockTone(v: StockView): Tone {
    return v.ok ? (v.last ? 'warning' : 'success') : 'danger';
  }

  // ───────── گزارش اجرا (075) ─────────

  orderOf(r: NcReport): NcOrder | undefined {
    return this.orders.find((o) => o.woId === r.woId);
  }

  // ───────── درجه‌بندی مجدد (076) ─────────

  get regrades(): Disposition[] {
    return this.inWo(this.dispositions).filter((d) => d.ncType === 4);
  }

  // ───────── ضایعات پیمانکار (077) ─────────

  get contractorSim(): { allowance: number; scrap: number; accepted: number; excess: number; penalty: number; returned: number; recordedPenalty: number } {
    const unitCost = this.contractorRows[0]?.unitCost ?? 0;
    const scrap = this.contractorRows.filter((d) => d.ncType === 1).reduce((s, d) => s + d.qty, 0);
    const allowance = (this.contractBase * this.contractTol) / 100;
    const accepted = Math.min(scrap, allowance);
    const excess = Math.max(scrap - allowance, 0);
    return {
      allowance, scrap, accepted, excess, penalty: (excess * unitCost * this.penaltyRate) / 100,
      returned: this.contractorRows.filter((d) => d.ncType !== 1).reduce((s, d) => s + d.qty, 0),
      recordedPenalty: this.contractorRows.reduce((s, d) => s + d.penalty, 0),
    };
  }

  contractorTone(c: number | null): Tone {
    return c === 3 ? 'success' : c === 2 ? 'danger' : c === 1 ? 'info' : 'secondary';
  }

  // ───────── COPQ (079) ─────────

  buildPareto(): void {
    const key = (r: CopqRow): string =>
      this.copqGroup === 'line' ? r.line : this.copqGroup === 'type' ? NC_TYPE[r.ncType] : this.copqGroup === 'wo' ? r.wo : this.copqGroup === 'source' ? NC_SOURCE[r.sourceType] ?? '—' : r.reason;
    const m = new Map<string, ParetoBar>();
    for (const r of this.copq) {
      const k = key(r);
      const b = m.get(k) ?? { key: k, value: 0, recovered: 0, penalty: 0, cases: 0, pct: 0, cum: 0, width: 0 };
      b.recovered += r.recovered;
      b.penalty += r.penalty;
      b.cases += r.cases;
      b.value += this.copqMeasure === 'gross' ? r.cost + r.recovered : this.copqMeasure === 'afterPenalty' ? r.cost - r.penalty : r.cost;
      m.set(k, b);
    }
    const bars = [...m.values()].sort((a, b) => b.value - a.value);
    const total = bars.reduce((s, b) => s + Math.max(b.value, 0), 0);
    const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
    let cum = 0;
    for (const b of bars) {
      b.pct = total ? (Math.max(b.value, 0) * 100) / total : 0;
      cum += b.pct;
      b.cum = Math.min(cum, 100);
      b.width = (Math.abs(b.value) * 100) / max;
    }
    this.pareto = bars;
    this.copqTotals = {
      cost: this.copq.reduce((s, r) => s + r.cost, 0), recovered: this.copq.reduce((s, r) => s + r.recovered, 0),
      penalty: this.copq.reduce((s, r) => s + r.penalty, 0), cases: this.copq.reduce((s, r) => s + r.cases, 0),
    };
  }

  get paretoVital(): number {
    return this.pareto.filter((b) => b.cum - b.pct < 80).length;
  }

  // ───────── سرآیند ─────────

  private get issues(): { tone: 'danger' | 'warning'; text: string }[] {
    const out: { tone: 'danger' | 'warning'; text: string }[] = [];
    const pend = this.dispositions.filter((d) => d.decision === 1);
    if (pend.length) out.push({ tone: 'warning', text: `${faInt(pend.length)} خروجی نامنطبق منتظر تصمیم (${[...new Set(pend.map((d) => d.wo))].join('، ')})` });
    const blist = pend.filter((d) => d.wasteReason.indexOf('بلیستر') >= 0);
    if (blist.length) out.push({ tone: 'warning', text: `بلیستر ناقص ${blist.map((d) => d.number).join('، ')}: بازبسته‌بندی یا اسقاط؟` });
    const consent = pend.filter((d) => d.customerOwned);
    if (consent.length) out.push({ tone: 'danger', text: `${faInt(consent.length)} مورد امانی ${consent[0].customer} بدون موافقت مشتری قابل بازیافت نیست` });
    for (const g of this.chainGroups.filter((x) => x.over)) out.push({ tone: 'danger', text: `بچ ${g.batch}: دوباره‌کاری چرخه‌ی ${faInt(Math.max(...g.rows.map((r) => r.cycle)))} پیشنهاد شده ولی سقف ${faInt(g.rows[0].maxCycles)} است` });
    for (const v of [...this.reworkViews, ...this.recycleViews]) for (const w of v.warnings) out.push({ tone: 'warning', text: `${v.o.number}: ${w}` });
    const reg = this.dispositions.filter((d) => d.ncType === 4 && d.note.indexOf('صادر نشده') >= 0);
    if (reg.length) out.push({ tone: 'warning', text: `سند انبار درجه‌بندی ${reg.map((d) => d.number).join('، ')} صادر نشده` });
    return out;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const i = this.issues;
    return i.some((x) => x.tone === 'danger') ? 'danger' : i.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc09_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن…';
    const i = this.issues;
    return i.length ? i.map((x) => x.text).join('؛ ') + '.' : 'همه‌ی خروجی‌های نامنطبق تعیین تکلیف شده‌اند.';
  }

  get contextLabel(): string {
    return this.woList.find((w) => w.id === this.selectedWoId)?.wo ?? 'همه‌ی دستورها';
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
