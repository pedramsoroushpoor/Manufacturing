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
  BATCH_STATUS, GENEALOGY_RELATION, OUTPUT_TYPE, RECEIPT_POLICY, RECEIPT_QC, SERIAL_LEVEL, SERIAL_STATUS, SHOP_NOW, Tone, WO_STATUS, WO_TYPE,
  code39Bars, faDateTime, faDay, faInt, faNum, faPct,
} from './pc-shared';
import {
  ATTR_ACTION, AttrRow, BatchRow, GapRow, GenNode, ITEM_TYPE, LabelSvg, LabelTemplate, PatternRow, PatternSegment, RECON_EXCEPTION, REJECTED_ROUTE, RELATION_COLOR,
  ReceiptRow, ReconOutputRow, ReconReportRow, SerialGroup, SerialInfo, SerialPattern, TraceRow, LinkRow, isPlaceholder, persianYm, reconTone,
} from './frm-pc-07.data';
import { FrmPc07Service } from './frm-pc-07.service';

interface WoItem { id: number; wo: string; product: string; type: string; status: string; statusCode: number; issues: number }
interface CoLine { label: string; type: number; joint: boolean; qty: number; unit: string; share: number | null; rate: number | null; value: number; alloc: number; unitCost: number | null }
interface CoGroup { wo: string; lines: CoLine[]; byValue: number; shareSum: number; missing: ReconOutputRow[] }
interface PartialStep { report: string; at: string; reported: number; received: number; approved: number; state: 'done' | 'active' | 'todo'; receipts: string; hint: string }
interface PartialWo { wo: string; product: string; unit: string; planned: number; reported: number; received: number; approved: number; steps: PartialStep[] }
interface AttrCell { state: 'filled' | 'pending' | 'missing' | 'gate' | 'na'; text: string; tip: string }
interface AttrLine { batch: string; opSeq: number; opTitle: string; opStatus: number; cells: AttrCell[] }
interface AggRow { batch: string; wo: string; cartons: number; shipped: number; aggregated: number; printed: number; generated: number; voided: number; shippers: number; needShippers: number; nextCarton: string; nextShipper: string }

/**
 * FRM-PC-07 — «رسید محصول و هویت‌بخشی».
 *
 * رسید خروجی‌های دستور کار بر اساس سیاست رسید (مستقیم، مجوز ورود، مشروط QC، قرنطینه) و فقط به مقدار تأییدشده،
 * سهم‌بری هم‌زاد و ارزش‌گذاری جانبی با شبیه‌سازی تخصیص هزینه، رسید جزئی چندمرحله‌ای، تابلوی بچ با پیش‌نمایش زنده‌ی
 * شماره‌ی بچ بعدی از الگوی خط، ماتریس تکمیل تدریجی ویژگی‌های بچ، جست‌وجو و تجمیع سریال، کاوشگر شجره‌نامه‌ی
 * دوطرفه (mes.TraceBatch)، پیش‌نمایش برچسب با بارکد Code 39 و مغایرت‌گیری گزارش تولید با رسید انبار.
 *
 * فاز اول (فقط‌خواندنی): F-PC-056 تا F-PC-064. ثبت رسید، تخصیص بچ/سریال، چاپ واقعی برچسب و اجرای
 * دستی مغایرت‌گیری با مرحله‌ی ایجاد/ویرایش می‌آید.
 */
@Component({
  selector: 'gng-frm-pc-07',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, DropdownModule, InputNumberModule, InputTextModule, SelectButtonModule, SliderModule, TabViewModule, TableModule, TagModule,
    TooltipModule, OperationalFormLayoutComponent, DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pc-07.component.html',
  styles: [`
    .wo-list { display: flex; flex-direction: column; gap: .3rem; }
    .wo-item { padding: .45rem .6rem; border: 1px solid var(--gng-border); border-radius: var(--gng-radius); cursor: pointer; font-size: .8rem; background: var(--gng-surface); }
    .wo-item:hover { border-color: var(--gng-primary); }
    .wo-item--on { border-color: var(--gng-primary); box-shadow: inset -3px 0 0 var(--gng-primary); }
    .wo-item b { font-size: .85rem; }
    .wo-item small { display: block; color: var(--gng-text-muted); }
    .chips { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; }
    .chip { padding: .2rem .65rem; border-radius: 999px; border: 1px solid var(--gng-border); font-size: .76rem; cursor: pointer; background: var(--gng-surface); }
    .chip--on { background: var(--gng-primary); color: #fff; border-color: var(--gng-primary); }
    .policy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: .6rem; }
    .policy { border: 1px solid var(--gng-border); border-radius: var(--gng-radius); padding: .6rem .75rem; font-size: .78rem; }
    .policy b { font-size: 1.2rem; display: block; }
    .split { display: flex; height: 18px; border-radius: 4px; overflow: hidden; border: 1px solid var(--gng-border); }
    .split > div { height: 100%; }
    .row-warn td { background: rgba(242, 177, 52, .08); }
    .row-bad td { background: rgba(235, 87, 87, .07); }
    .board { display: flex; gap: .6rem; overflow-x: auto; padding-bottom: .3rem; }
    .lane { flex: 0 0 200px; background: var(--gng-bg); border-radius: var(--gng-radius); padding: .5rem; }
    .lane h4 { margin: 0 0 .4rem; font-size: .8rem; }
    .bcard { background: var(--gng-surface); border: 1px solid var(--gng-border); border-radius: var(--gng-radius); padding: .45rem .55rem; margin-bottom: .4rem; font-size: .74rem; cursor: pointer; }
    .bcard--on { border-color: var(--gng-primary); box-shadow: 0 0 0 2px rgba(47, 128, 237, .2); }
    .bcard--dim { opacity: .45; }
    .bcard b { font-family: monospace; font-size: .82rem; direction: ltr; display: inline-block; }
    .seg-row { display: flex; gap: 2px; direction: ltr; justify-content: flex-start; flex-wrap: wrap; }
    .seg { padding: .35rem .5rem; border-radius: 4px; font-family: monospace; font-size: 1.15rem; font-weight: 700; text-align: center; min-width: 1.6rem; }
    .seg small { display: block; font-family: inherit; font-size: .62rem; font-weight: 400; direction: rtl; }
    .seg--1 { background: rgba(130, 130, 130, .14); } .seg--2 { background: rgba(47, 128, 237, .14); } .seg--3 { background: rgba(155, 81, 224, .14); }
    .seg--4 { background: rgba(39, 174, 96, .14); } .seg--5 { background: rgba(242, 153, 74, .2); }
    .seg--renew { outline: 2px dashed var(--gng-warning); }
    .matrix { border-collapse: collapse; width: 100%; font-size: .76rem; }
    .matrix th, .matrix td { border: 1px solid var(--gng-border); padding: .3rem .4rem; text-align: center; }
    .cell--filled { background: rgba(39, 174, 96, .12); } .cell--pending { background: var(--gng-bg); color: var(--gng-text-muted); }
    .cell--missing { background: rgba(242, 177, 52, .18); } .cell--gate { background: rgba(235, 87, 87, .18); font-weight: 700; } .cell--na { color: var(--gng-border); }
    .tree { overflow-x: auto; padding: .5rem 0; }
    .tnode { display: flex; align-items: center; }
    .tcard { flex: 0 0 auto; width: 205px; border: 2px solid var(--gng-border); border-radius: var(--gng-radius); padding: .4rem .55rem; background: var(--gng-surface); font-size: .72rem; cursor: pointer; }
    .tcard b { font-family: monospace; font-size: .82rem; direction: ltr; display: inline-block; }
    .tcard--est { border-style: dashed; }
    .tcard--root { background: rgba(47, 128, 237, .08); }
    .tkids { display: flex; flex-direction: column; gap: .35rem; border-right: 2px solid var(--gng-border); margin-right: 1.4rem; padding-right: 0; }
    .tkid { display: flex; align-items: center; }
    .tkid::before { content: ''; width: 1.4rem; border-top: 2px solid var(--gng-border); flex: 0 0 auto; }
    .label-box { background: #fff; border: 1px solid var(--gng-border); border-radius: 4px; padding: .5rem; display: inline-block; }
    .mono { font-family: monospace; direction: ltr; display: inline-block; }
    .bigbar { height: 14px; border-radius: 6px; background: var(--gng-bg); border: 1px solid var(--gng-border); position: relative; overflow: hidden; }
    .bigbar > div { position: absolute; top: 0; bottom: 0; right: 0; }
  `],
})
export class FrmPc07Component implements OnInit {
  // داده‌ی خام
  receipts: ReceiptRow[] = [];
  reconReports: ReconReportRow[] = [];
  reconOutputs: ReconOutputRow[] = [];
  batches: BatchRow[] = [];
  patterns: PatternRow[] = [];
  attributes: AttrRow[] = [];
  serials: SerialGroup[] = [];
  serialPatterns: SerialPattern[] = [];
  links: LinkRow[] = [];
  gaps: GapRow[] = [];
  templates: LabelTemplate[] = [];

  // انتخاب دستور (پنل راست)
  woList: WoItem[] = [];
  selectedWoId: number | null = null;

  // رسید
  receiptFilter = 'all';
  receiptSearch = '';
  receiptView: ReceiptRow[] = [];
  readonly receiptChips = [
    { key: 'all', label: 'همه' }, { key: 'pending', label: 'منتظر QC' }, { key: 'rejected', label: 'دارای رد' },
    { key: 'quarantine', label: 'قرنطینه' }, { key: 'side', label: 'غیراصلی' },
  ];
  policyCards: { code: number; label: string; count: number; qty: string; hint: string }[] = [];
  qcSplits: { r: ReceiptRow; approvedPct: number; route: string; target: string }[] = [];

  // هم‌زاد و جانبی
  coGroups: CoGroup[] = [];
  costPool: Record<string, number> = {};

  // رسید جزئی
  partials: PartialWo[] = [];

  // بچ
  boardLanes: { code: number; label: string; items: BatchRow[] }[] = [];
  selectedBatch = 'B-1405-0952';
  patternId = 1;
  patternOptions: { label: string; value: number }[] = [];
  dayOffset = 0;
  shift = 'M';
  readonly shiftOptions = [{ label: 'صبح M', value: 'M' }, { label: 'عصر E', value: 'E' }, { label: 'شب N', value: 'N' }];
  segs: PatternSegment[] = [];
  nextNumber = '';
  patternMsgs: { tone: 'danger' | 'warning' | 'info'; text: string }[] = [];
  patternCapacity = '';
  attrCols: { code: string; title: string; unit: string }[] = [];
  attrLines: AttrLine[] = [];
  attrOnlySelected = false;

  // سریال
  serialQuery = 'B-1405-0941-C00150';
  serialResult: SerialInfo | null = null;
  serialSearched = false;
  serialLoading = false;
  aggRows: AggRow[] = [];
  readonly sampleSerials = ['B-1405-0941-C00150', 'B-1405-0941-P002', 'B-1405-0952-C05003', 'B-1405-0952-C04999'];

  // شجره‌نامه
  genBatch = 'PCM-2406';
  genDir: 1 | 2 = 2;
  readonly dirOptions = [{ label: '← رو به عقب (مواد مصرف‌شده)', value: 1 }, { label: 'رو به جلو (کجا مصرف شد) →', value: 2 }];
  batchOptions: { label: string; value: string }[] = [];
  genRoot: GenNode | null = null;
  genLoading = false;
  genStats = { nodes: 0, depth: 0, estimated: 0, recycle: 0, ends: [] as string[] };
  genGaps: GapRow[] = [];

  // برچسب
  labelTemplateId = 1;
  labelBatch = 'B-1405-0941';
  labelSerial = '';
  labelSvg: LabelSvg = { w: 70, h: 40, rects: [], texts: [] };
  labelViewBox = '0 0 70 40';
  labelData: { code: string; title: string; field: string; value: string }[] = [];
  templateOptions: { label: string; value: number }[] = [];

  // مغایرت‌گیری
  reconOnlyEx = false;
  reconReportView: ReconReportRow[] = [];
  reconOutputView: ReconOutputRow[] = [];
  exCards: { code: number; label: string; count: number; tone: Tone }[] = [];

  loading = false;
  loadFailed = false;
  readonly companyId = DEMO_COMPANY_ID;

  readonly faNum = faNum; readonly faInt = faInt; readonly faPct = faPct; readonly faDay = faDay; readonly faDateTime = faDateTime;
  readonly OUTPUT_TYPE = OUTPUT_TYPE; readonly RECEIPT_POLICY = RECEIPT_POLICY; readonly RECEIPT_QC = RECEIPT_QC; readonly BATCH_STATUS = BATCH_STATUS;
  readonly SERIAL_LEVEL = SERIAL_LEVEL; readonly SERIAL_STATUS = SERIAL_STATUS; readonly GENEALOGY_RELATION = GENEALOGY_RELATION; readonly REJECTED_ROUTE = REJECTED_ROUTE;
  readonly RECON_EXCEPTION = RECON_EXCEPTION; readonly RELATION_COLOR = RELATION_COLOR; readonly ITEM_TYPE = ITEM_TYPE; readonly ATTR_ACTION = ATTR_ACTION;
  readonly reconTone = reconTone;

  constructor(private pc07: FrmPc07Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.pc07.bundle(this.companyId).subscribe({
      next: (b) => {
        Object.assign(this, { receipts: b.receipts, reconReports: b.reconReports, reconOutputs: b.reconOutputs, batches: b.batches, patterns: b.patterns, attributes: b.attributes });
        Object.assign(this, { serials: b.serials, serialPatterns: b.serialPatterns, links: b.links, gaps: b.gaps, templates: b.templates });
        this.buildWoList();
        this.patternOptions = this.patterns.map((p) => ({ label: `${p.line} — ${p.group}`, value: p.id }));
        this.templateOptions = this.templates.map((t) => ({ label: `${t.number} — ${t.name}`, value: t.id }));
        const names = new Set<string>([...this.batches.map((x) => x.number), ...this.links.flatMap((l) => [l.parentBatch, l.childBatch])]);
        this.batchOptions = [...names].sort().map((n) => ({ label: n, value: n }));
        this.attrCols = [...new Map(this.attributes.map((a) => [a.code, { code: a.code, title: a.title, unit: a.unit }])).values()];
        this.buildAggregation();
        this.refresh();
        this.buildPattern();
        this.buildLabel();
        this.runTrace();
        this.searchSerial();
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-PC-07] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  // ───────── دستورها (پنل راست) ─────────

  private buildWoList(): void {
    const m = new Map<number, WoItem>();
    for (const b of this.batches) {
      if (!m.has(b.woId)) m.set(b.woId, { id: b.woId, wo: b.wo, product: b.product, type: WO_TYPE[b.woType] ?? '', status: WO_STATUS[b.woStatus] ?? '', statusCode: b.woStatus, issues: 0 });
    }
    for (const r of this.reconReports) if (!m.has(r.woId)) m.set(r.woId, { id: r.woId, wo: r.wo, product: r.product, type: '', status: '', statusCode: 0, issues: 0 });
    for (const w of m.values()) {
      w.issues = this.reconReports.filter((r) => r.woId === w.id && r.exception && r.exception !== 5).length + this.reconOutputs.filter((r) => r.woId === w.id && r.exception).length;
    }
    const hasData = (id: number) => this.receipts.some((r) => r.woId === id) || this.reconReports.some((r) => r.woId === id);
    this.woList = [...m.values()].sort((a, b) => b.issues - a.issues || Number(hasData(b.id)) - Number(hasData(a.id)) || b.wo.localeCompare(a.wo));
  }

  pickWo(id: number | null): void {
    this.selectedWoId = id;
    const b = this.batches.find((x) => x.woId === id);
    if (b) {
      this.selectedBatch = b.number;
      this.labelBatch = b.number;
      this.buildLabel();
    }
    this.refresh();
  }

  private inWo<T extends { woId: number }>(rows: T[]): T[] {
    return this.selectedWoId === null ? rows : rows.filter((r) => r.woId === this.selectedWoId);
  }

  get selectedWo(): WoItem | undefined {
    return this.woList.find((w) => w.id === this.selectedWoId);
  }

  refresh(): void {
    this.buildReceipts();
    this.buildCoProducts();
    this.buildPartials();
    this.buildBoard();
    this.buildAttributes();
    this.buildRecon();
  }

  // ───────── رسید محصول (056، 058) ─────────

  buildReceipts(): void {
    const q = this.receiptSearch.trim().toLowerCase();
    const base = this.inWo(this.receipts);
    this.receiptView = base.filter((r) => {
      if (this.receiptFilter === 'pending' && r.qc !== 1) return false;
      if (this.receiptFilter === 'rejected' && !(r.qcRejected && r.qcRejected > 0)) return false;
      if (this.receiptFilter === 'quarantine' && r.policy !== 4) return false;
      if (this.receiptFilter === 'side' && r.outputType === 1) return false;
      return !q || [r.number, r.wo, r.batch, r.product, r.report, r.doc].some((s) => s.toLowerCase().includes(q));
    });
    const hints: Record<number, string> = {
      1: 'ورود فوری به موجودی قابل مصرف',
      2: 'ورود پس از مجوز سرپرست',
      3: 'به موجودی می‌رود ولی تا آزادسازی QC قابل مصرف نیست',
      4: 'ورود به انبار قرنطینه تا گواهی آنالیز',
    };
    this.policyCards = [1, 2, 3, 4].map((c) => {
      const rows = base.filter((r) => r.policy === c);
      return { code: c, label: RECEIPT_POLICY[c], count: rows.length, qty: rows.length ? `${faInt(rows.length)} رسید` : '—', hint: hints[c] };
    });
    this.qcSplits = base
      .filter((r) => r.qcRejected && r.qcRejected > 0)
      .map((r) => {
        const total = (r.qcApproved ?? 0) + (r.qcRejected ?? 0);
        const target = this.links.find((l) => l.relation === 2 && l.childBatch === r.batch);
        return {
          r, approvedPct: total ? ((r.qcApproved ?? 0) * 100) / total : 0, route: REJECTED_ROUTE[r.rejectedRoute ?? 0] ?? 'بدون مسیر',
          target: target ? `${target.parentWo} (${target.parentBatch})` : '',
        };
      });
  }

  setReceiptFilter(k: string): void {
    this.receiptFilter = k;
    this.buildReceipts();
  }

  policyTone(c: number): Tone {
    return c === 1 ? 'success' : c === 2 ? 'info' : c === 3 ? 'warning' : 'danger';
  }

  qcTone(c: number | null): Tone {
    return c === 2 ? 'success' : c === 1 ? 'warning' : c === 3 ? 'danger' : c === 4 ? 'info' : 'secondary';
  }

  outTone(c: number): Tone {
    return c === 1 ? 'info' : c === 2 ? 'success' : c === 3 ? 'contrast' : c === 4 ? 'danger' : 'warning';
  }

  // ───────── هم‌زاد و جانبی (057) ─────────

  buildCoProducts(): void {
    const wos = [...new Set(this.inWo(this.receipts).filter((r) => r.outputType !== 1 || r.costShare !== null).map((r) => r.wo))];
    this.coGroups = wos.map((wo) => {
      if (this.costPool[wo] === undefined) this.costPool[wo] = 600_000_000;
      return this.coGroup(wo);
    });
  }

  private coGroup(wo: string): CoGroup {
    const rows = this.receipts.filter((r) => r.wo === wo);
    const byKey = new Map<string, CoLine>();
    for (const r of rows) {
      const k = `${r.outputType}|${r.productCode}`;
      const l = byKey.get(k) ?? { label: `${r.productCode} — ${r.product}`, type: r.outputType, joint: r.outputType <= 2, qty: 0, unit: r.unit, share: r.costShare, rate: r.valuationRate, value: 0, alloc: 0, unitCost: null };
      l.qty += r.received;
      byKey.set(k, l);
    }
    const lines = [...byKey.values()].sort((a, b) => a.type - b.type);
    for (const l of lines) l.value = l.rate ? l.rate * l.qty : 0;
    const byValue = lines.filter((l) => l.type >= 3).reduce((s, l) => s + l.value, 0);
    const joint = lines.filter((l) => l.type <= 2);
    if (joint.length === 1 && joint[0].share === null) joint[0].share = 100;
    const shareSum = joint.reduce((s, l) => s + (l.share ?? 0), 0);
    const pool = Math.max((this.costPool[wo] ?? 0) - byValue, 0);
    for (const l of joint) {
      l.alloc = (pool * (l.share ?? 0)) / 100;
      l.unitCost = l.qty ? l.alloc / l.qty : null;
    }
    for (const l of lines.filter((x) => x.type >= 3)) {
      l.alloc = l.value;
      l.unitCost = l.rate;
    }
    const woId = rows[0]?.woId;
    return { wo, lines, byValue, shareSum, missing: this.reconOutputs.filter((o) => o.woId === woId && o.exception === 6) };
  }

  recalcCo(wo: string): void {
    const i = this.coGroups.findIndex((g) => g.wo === wo);
    if (i >= 0) this.coGroups[i] = this.coGroup(wo);
  }

  // ───────── رسید جزئی (059) ─────────

  buildPartials(): void {
    const wos = [...new Set(this.inWo(this.reconReports).map((r) => r.woId))];
    this.partials = wos.map((id) => {
      const reps = this.reconReports.filter((r) => r.woId === id);
      const batch = this.batches.find((b) => b.woId === id && b.number.indexOf('-BR') < 0);
      const steps: PartialStep[] = reps.map((r) => {
        const rc = this.receipts.filter((x) => x.report === r.report && x.outputType === 1);
        const state: PartialStep['state'] = r.received <= 0 ? 'todo' : r.pending && r.pending > 0 ? 'active' : 'done';
        const hint = r.received <= 0 ? `منتظر رسید — ${faNum(r.ageHours, 1)} ساعت از گزارش` : r.pending && r.pending > 0 ? 'رسید شد، منتظر QC' : r.rejected > 0 ? `${faInt(r.rejected)} رد` : 'آزاد';
        return { report: r.report, at: r.reportedAt, reported: r.reported, received: r.received, approved: r.approved, state, receipts: rc.map((x) => x.number).join('، '), hint };
      });
      const sum = (f: (r: ReconReportRow) => number) => reps.reduce((s, r) => s + f(r), 0);
      return {
        wo: reps[0].wo, product: reps[0].product, unit: reps[0].unit, planned: batch?.planned ?? 0, reported: sum((r) => r.reported),
        received: sum((r) => r.received), approved: sum((r) => r.approved), steps,
      };
    });
  }

  pctOf(a: number, b: number): number {
    return b ? Math.min((a * 100) / b, 100) : 0;
  }

  // ───────── بچ محصول (060) ─────────

  buildBoard(): void {
    this.boardLanes = [1, 2, 3, 4, 5, 6, 7]
      .map((c) => ({ code: c, label: BATCH_STATUS[c], items: this.batches.filter((b) => b.status === c) }))
      .filter((l) => l.items.length);
  }

  pickBatch(n: string): void {
    this.selectedBatch = n;
    this.labelBatch = this.batches.some((b) => b.number === n) ? n : this.labelBatch;
    this.buildAttributes();
    this.buildLabel();
  }

  batchDim(b: BatchRow): boolean {
    return this.selectedWoId !== null && b.woId !== this.selectedWoId;
  }

  batchTone(c: number): Tone {
    return c === 4 ? 'success' : c === 5 ? 'info' : c === 2 ? 'warning' : c === 3 || c === 6 ? 'danger' : c === 7 ? 'secondary' : 'contrast';
  }

  /** پیش‌نمایش شماره‌ی بچ بعدی از اجزای الگوی خط */
  buildPattern(): void {
    const p = this.patterns.find((x) => x.id === this.patternId);
    this.segs = [];
    this.patternMsgs = [];
    if (!p) return;
    const date = new Date(SHOP_NOW.getTime() + this.dayOffset * 86_400_000);
    const ym = persianYm(date);
    let pos = 0;
    let renewChanged = false;
    let lastCounter = NaN;
    let counterLen = 0;
    for (const it of p.items) {
      const last = p.lastUsed.substr(pos, it.length);
      let text = '';
      let label = ITEM_TYPE[it.type] ?? '';
      if (it.type === 1) {
        text = isPlaceholder(it.value) ? this.shift : it.value;
        if (isPlaceholder(it.value)) label = `«${it.value}»`;
        else if (last !== it.value) this.patternMsgs.push({ tone: 'warning', text: `متن ثابت «${it.value}» در آخرین شماره (${p.lastUsed}) جای «${last}» آمده است.` });
      } else if (it.type === 2) text = String(ym.y).slice(-it.length).padStart(it.length, '0');
      else if (it.type === 3) text = String(ym.m).padStart(it.length, '0');
      else if (it.type === 4) text = String(p.lineId).padStart(it.length, '0');
      else if (it.type === 5) {
        lastCounter = parseInt(last, 10);
        counterLen = it.length;
        if (it.value) label = `شمارنده («${it.value}»)`;
      }
      if (it.renewal && it.type !== 5 && last !== text) {
        renewChanged = true;
        const tone = /^\d+$/.test(last) && parseInt(last, 10) > parseInt(text, 10) && it.type === 3 && p.lastUsed.substr(4, 4) === String(ym.y) ? 'danger' : 'info';
        this.patternMsgs.push({
          tone,
          text: tone === 'danger'
            ? `آخرین شماره (${p.lastUsed}) ${label} «${last}» دارد که از ${label} جاری «${text}» جلوتر است — داده‌ی الگو یا شماره‌ی مصرف‌شده را بررسی کنید.`
            : `${label} از «${last}» به «${text}» تغییر کرده؛ عامل تجدید است و شمارنده از ۱ شروع می‌شود.`,
        });
      }
      this.segs.push({ type: it.type, text, renewal: it.renewal, label });
      pos += it.length;
    }
    const next = renewChanged || Number.isNaN(lastCounter) ? 1 : lastCounter + 1;
    const ci = this.segs.findIndex((s) => s.type === 5);
    if (ci >= 0) this.segs[ci].text = String(next).padStart(counterLen, '0');
    this.nextNumber = this.segs.map((s) => s.text).join('');
    const max = Math.pow(10, counterLen) - 1;
    this.patternCapacity = counterLen ? `${faInt(max - next + 1)} شماره‌ی دیگر تا سقف ${faInt(max)} در این دوره` : '';
    if (next > max) this.patternMsgs.push({ tone: 'danger', text: 'شمارنده به سقف رسیده — شماره‌ی بچ جدید ساخته نمی‌شود.' });
    const itemLen = p.items.reduce((s, i) => s + i.length, 0);
    if (itemLen !== p.totalLength) this.patternMsgs.push({ tone: 'warning', text: `جمع طول اجزا ${faInt(itemLen)} است ولی طول کل الگو ${faInt(p.totalLength)} ثبت شده.` });
    if (p.first.length !== itemLen) this.patternMsgs.push({ tone: 'warning', text: `«اولین شماره» (${p.first}) با ساختار الگو نمی‌خواند (${faInt(p.first.length)} نویسه).` });
    const iso = date.toISOString();
    if ((p.validTo && iso > p.validTo) || (p.validFrom && iso < p.validFrom)) this.patternMsgs.push({ tone: 'danger', text: `الگو در ${faDay(iso)} معتبر نیست (اعتبار ${faDay(p.validFrom)} تا ${faDay(p.validTo)}).` });
    if (this.batches.some((b) => b.number === this.nextNumber)) this.patternMsgs.push({ tone: 'danger', text: `${this.nextNumber} قبلاً به یک بچ داده شده است.` });
  }

  get patternRow(): PatternRow | undefined {
    return this.patterns.find((x) => x.id === this.patternId);
  }

  get previewDate(): string {
    return faDay(new Date(SHOP_NOW.getTime() + this.dayOffset * 86_400_000).toISOString());
  }

  /** ماتریس ویژگی‌ها: (بچ × عملیات) × ویژگی */
  buildAttributes(): void {
    const keys = new Map<string, AttrLine>();
    const rows = this.attributes.filter((a) => (!this.attrOnlySelected || a.batch === this.selectedBatch) && (this.selectedWoId === null || this.batches.find((b) => b.id === a.batchId)?.woId === this.selectedWoId));
    for (const a of rows) {
      const k = `${a.batch}|${a.opSeq}`;
      let line = keys.get(k);
      if (!line) {
        line = { batch: a.batch, opSeq: a.opSeq, opTitle: a.opTitle, opStatus: a.opStatus, cells: this.attrCols.map(() => ({ state: 'na' as const, text: '·', tip: '' })) };
        keys.set(k, line);
      }
      const i = this.attrCols.findIndex((c) => c.code === a.code);
      const has = a.valueNumber !== null || (a.valueText !== null && a.valueText !== '');
      const done = a.opStatus === 5;
      const state: AttrCell['state'] = has ? 'filled' : done ? (a.qcGate ? 'gate' : 'missing') : 'pending';
      const text = has ? (a.valueText ?? `${faNum(a.valueNumber)}${a.unit ? ' ' + a.unit : ''}`) : state === 'gate' ? 'دروازه‌ی QC خالی' : state === 'missing' ? 'ثبت نشده' : 'منتظر عملیات';
      line.cells[i] = { state, text, tip: `${ATTR_ACTION[a.action] ?? ''}${a.rule ? ' — ' + a.rule : ''}${a.recordedBy ? ' · ' + a.recordedBy + ' ' + faDateTime(a.recordedAt) : ''}` };
    }
    this.attrLines = [...keys.values()];
  }

  get gateMissing(): AttrLine[] {
    return this.attrLines.filter((l) => l.cells.some((c) => c.state === 'gate'));
  }

  // ───────── سریال (061) ─────────

  private buildAggregation(): void {
    const per = this.serialPatterns.find((p) => p.level === 3)?.childrenPerParent ?? 100;
    const batches = [...new Set(this.serials.map((s) => s.batch))];
    this.aggRows = batches.map((batch) => {
      const g = this.serials.filter((s) => s.batch === batch);
      const c = (lvl: number, st?: number) => g.filter((s) => s.level === lvl && (st === undefined || s.status === st)).reduce((a, s) => a + s.count, 0);
      const cartons = c(2);
      const live = cartons - c(2, 5);
      return {
        batch, wo: g[0].wo, cartons, shipped: c(2, 4), aggregated: c(2, 3), printed: c(2, 2), generated: c(2, 1), voided: c(2, 5), shippers: c(3),
        needShippers: Math.ceil(live / per), nextCarton: this.nextSerial(g, 2), nextShipper: this.nextSerial(g, 3, batch),
      };
    });
  }

  private nextSerial(g: SerialGroup[], level: number, batch?: string): string {
    const pat = this.serialPatterns.find((p) => p.level === level);
    if (!pat) return '—';
    const nums = g.filter((s) => s.level === level).map((s) => parseInt(s.last.replace(/^.*\D/, ''), 10)).filter((n) => !Number.isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return pat.text.replace('{BATCH}', batch ?? g[0].batch).replace('{SEQ}', String(next).padStart(pat.counterLength, '0'));
  }

  searchSerial(s?: string): void {
    if (s) this.serialQuery = s;
    const q = this.serialQuery.trim().toUpperCase();
    if (!q) return;
    this.serialLoading = true;
    this.pc07.serial(q, this.companyId).subscribe({
      next: (r) => {
        this.serialResult = r;
        this.serialSearched = true;
        this.serialLoading = false;
      },
      error: () => {
        this.serialResult = null;
        this.serialSearched = true;
        this.serialLoading = false;
      },
    });
  }

  serialTone(c: number | null): Tone {
    return c === 4 ? 'success' : c === 3 ? 'info' : c === 2 ? 'warning' : c === 5 ? 'danger' : 'secondary';
  }

  get serialChildrenShown(): { serial: string; level: number; status: number }[] {
    return this.serialResult ? this.serialResult.children.slice(0, 24) : [];
  }

  get totalVoid(): number {
    return this.aggRows.reduce((s, a) => s + a.voided, 0);
  }

  // ───────── شجره‌نامه (062) ─────────

  runTrace(batch?: string, dir?: 1 | 2): void {
    if (batch) this.genBatch = batch;
    if (dir) this.genDir = dir;
    const root = this.genBatch.trim();
    if (!root) return;
    this.genLoading = true;
    this.pc07.trace(root, this.genDir, this.companyId).subscribe({
      next: (rows) => {
        this.genRoot = this.buildTree(root, rows);
        this.genLoading = false;
      },
      error: () => {
        this.genRoot = null;
        this.genLoading = false;
      },
    });
    const wo = this.batches.find((b) => b.number === root)?.wo;
    this.genGaps = this.gaps.filter((g) => g.batch === root || (wo && g.wo === wo));
  }

  private buildTree(root: string, rows: TraceRow[]): GenNode {
    const back = this.genDir === 1;
    const b = this.batches.find((x) => x.number === root);
    const any = rows.find((r) => (back ? r.parentBatch : r.childBatch) === root);
    const node: GenNode = {
      batch: root, product: b ? `${b.productCode} — ${b.product}` : any ? (back ? any.parentProduct : any.childProduct) : '', wo: b?.wo ?? (any ? (back ? any.parentWo : any.childWo) : ''),
      unit: b?.unit ?? '', quantity: null, estimated: false, relation: 0, ops: '', inventory: '', children: [], depth: 0, cyclic: false,
    };
    const stats = { nodes: 1, depth: 0, estimated: 0, recycle: 0, ends: [] as string[] };
    const expand = (n: GenNode, path: Set<string>) => {
      const seen = new Set<number>();
      const groups = new Map<string, GenNode>();
      for (const r of rows) {
        if ((back ? r.parentBatch : r.childBatch) !== n.batch || seen.has(r.linkId)) continue;
        seen.add(r.linkId);
        const key = back ? r.childBatch : r.parentBatch;
        let c = groups.get(key);
        if (!c) {
          c = {
            batch: key, product: back ? r.childProduct : r.parentProduct, wo: back ? r.childWo : r.parentWo, unit: r.childUnit, quantity: 0, estimated: false, relation: r.relation,
            ops: '', inventory: back ? r.inventory : '', children: [], depth: n.depth + 1, cyclic: path.has(key),
          };
          groups.set(key, c);
        }
        c.quantity = (c.quantity ?? 0) + r.quantity;
        c.estimated = c.estimated || r.estimated;
        if (r.opSeq !== null) c.ops = c.ops ? `${c.ops}، ${r.opSeq}` : String(r.opSeq);
        if (!back && r.inventory) n.inventory = n.inventory || r.inventory;
      }
      n.children = [...groups.values()];
      for (const c of n.children) {
        stats.nodes++;
        stats.depth = Math.max(stats.depth, c.depth);
        if (c.estimated) stats.estimated++;
        if (c.relation === 2 || c.relation === 3) stats.recycle++;
        if (!c.cyclic && c.depth < 8) expand(c, new Set([...path, c.batch]));
        if (!c.children.length) stats.ends.push(c.batch);
      }
    };
    expand(node, new Set([root]));
    this.genStats = stats;
    return node;
  }

  nodeBorder(n: GenNode): string {
    return n.relation ? RELATION_COLOR[n.relation] ?? 'var(--gng-border)' : 'var(--gng-primary)';
  }

  // ───────── برچسب (063) ─────────

  buildLabel(): void {
    const t = this.templates.find((x) => x.id === this.labelTemplateId);
    const b = this.batches.find((x) => x.number === this.labelBatch);
    if (!t) return;
    const groups = this.serials.filter((s) => s.batch === this.labelBatch && s.level === t.level);
    const serial = this.labelSerial.trim() || (groups.find((g) => g.status === 4 || g.status === 3)?.first ?? groups[0]?.first ?? '');
    const stor = this.attributes.find((a) => a.batch === this.labelBatch && a.code === 'STOR' && a.valueText)?.valueText ?? this.attributes.find((a) => a.code === 'STOR' && a.valueText)?.valueText ?? '';
    const per = this.serialPatterns.find((p) => p.level === 3)?.childrenPerParent;
    const values: Record<string, string> = {
      productName: b?.product ?? '', productCode: b?.productCode ?? '', batch: this.labelBatch, mfgDate: faDay(b?.mfg), expDate: faDay(b?.exp), serial: serial || '—',
      quantity: t.level === 3 ? `${faInt(per ?? 0)} کارتن` : t.level === 4 ? `${faNum(b?.received || b?.planned)} ${b?.unit ?? ''}` : '—',
      storage: stor || '—', qcStatus: b ? BATCH_STATUS[b.status] : '—', workOrder: b?.wo ?? '', owner: b?.owner || 'گلرنگ',
    };
    const svg: LabelSvg = { w: t.width, h: t.height, rects: [], texts: [] };
    svg.rects.push({ x: 0.5, y: 0.5, w: t.width - 1, h: t.height - 1, fill: '#fff', stroke: '#333' });
    for (const p of t.parts) {
      const v = values[p.field] ?? '';
      if (p.element === 2) {
        const bc = code39Bars(v);
        const u = p.w / Math.max(bc.total, 1);
        for (const bar of bc.bars) svg.rects.push({ x: p.x + bar.x * u, y: p.y, w: bar.w * u, h: p.h, fill: '#000', stroke: 'none' });
        continue;
      }
      const size = (p.fontPt ?? 8) * 0.3528;
      const baseY = p.y + p.h / 2 + size * 0.35;
      if (p.element === 3) {
        const c = b?.status === 4 ? '#27ae60' : b?.status === 5 ? '#2f80ed' : b?.status === 7 ? '#828282' : '#eb5757';
        svg.rects.push({ x: p.x, y: p.y, w: p.w, h: p.h, fill: c, stroke: 'none' });
        svg.texts.push({ x: p.x + p.w / 2, y: baseY, size: Math.min(size, p.h * 0.5), bold: true, text: v, anchor: 'middle', fill: '#fff', ltr: false });
        continue;
      }
      const latin = !/[؀-ۿ]/.test(v) && !p.caption;
      const text = p.caption ? `${p.caption}: ${v}` : v;
      svg.texts.push({ x: latin ? p.x : p.x + p.w, y: baseY, size, bold: p.bold, text, anchor: 'start', fill: '#111', ltr: latin });
    }
    this.labelSvg = svg;
    this.labelViewBox = `0 0 ${t.width} ${t.height}`;
    this.labelData = t.parts.map((p) => ({ code: p.code, title: p.title, field: p.field, value: values[p.field] ?? '' }));
  }

  get labelTemplate(): LabelTemplate | undefined {
    return this.templates.find((x) => x.id === this.labelTemplateId);
  }

  get labelBatchOptions(): { label: string; value: string }[] {
    return this.batches.map((b) => ({ label: `${b.number} — ${b.product}`, value: b.number }));
  }

  // ───────── مغایرت‌گیری (064) ─────────

  buildRecon(): void {
    const rr = this.inWo(this.reconReports);
    const ro = this.inWo(this.reconOutputs).filter((o) => o.expected > 0 || o.received > 0);
    this.reconReportView = this.reconOnlyEx ? rr.filter((r) => r.exception) : rr;
    this.reconOutputView = this.reconOnlyEx ? ro.filter((r) => r.exception) : ro;
    this.exCards = [1, 2, 3, 4, 5, 6].map((c) => ({
      code: c, label: RECON_EXCEPTION[c], tone: reconTone(c),
      count: (c === 6 ? ro : rr).filter((r) => r.exception === c).length,
    }));
  }

  get exTotal(): number {
    return this.exCards.reduce((s, c) => s + c.count, 0);
  }

  // ───────── سرآیند ─────────

  get contextLabel(): string {
    return this.selectedWo ? `${this.selectedWo.wo} — ${this.selectedWo.product}` : 'همه‌ی دستورها';
  }

  private get issues(): { tone: 'danger' | 'warning'; text: string }[] {
    const out: { tone: 'danger' | 'warning'; text: string }[] = [];
    for (const r of this.reconReports.filter((x) => x.exception === 1)) out.push({ tone: 'danger', text: `${r.wo}: رسید ${faNum(r.received)} بیش از گزارش ${r.report} (${faNum(r.reported)} ${r.unit})` });
    const notRec = this.reconReports.filter((x) => x.exception === 2 || x.exception === 5);
    if (notRec.length) out.push({ tone: 'warning', text: `${faInt(notRec.length)} گزارش تولید هنوز رسید نشده (${notRec.map((r) => r.report).join('، ')})` });
    const side = this.reconOutputs.filter((x) => x.exception === 6);
    if (side.length) out.push({ tone: 'warning', text: `${faInt(side.length)} خروجی جانبی دستور تکمیل‌شده رسید نشده (${[...new Set(side.map((s) => s.wo))].join('، ')})` });
    for (const r of this.receipts.filter((x) => x.qcRejected && x.qcRejected > 0)) {
      const t = this.links.find((l) => l.relation === 2 && l.childBatch === r.batch);
      out.push({ tone: 'warning', text: `${faInt(r.qcRejected)} ${r.unit} از ${r.batch} رد QC ← ${REJECTED_ROUTE[r.rejectedRoute ?? 0] ?? 'بدون مسیر'}${t ? ' ' + t.parentWo : ''}` });
    }
    const gate = this.attributes.filter((a) => a.qcGate && a.opStatus === 5 && a.valueNumber === null && !a.valueText);
    const gateBatches = [...new Set(gate.map((a) => a.batch))];
    if (gateBatches.length) out.push({ tone: 'danger', text: `دروازه‌ی QC بچ ${gateBatches.join('، ')} خالی است ولی بچ آزاد شده` });
    if (this.totalVoid) out.push({ tone: 'warning', text: `${faInt(this.totalVoid)} سریال کارتن باطل‌شده` });
    if (this.gaps.length) out.push({ tone: 'warning', text: `${faInt(this.gaps.reduce((s, g) => s + g.rows, 0))} ردیف مصرف بدون شماره‌ی بچ — شجره‌نامه‌ی ${[...new Set(this.gaps.map((g) => g.wo))].join('، ')} ناقص است` });
    return out;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const i = this.issues;
    return i.some((x) => x.tone === 'danger') ? 'danger' : i.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc07_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن…';
    const i = this.issues;
    return i.length ? i.map((x) => x.text).join('؛ ') + '.' : 'همه‌ی گزارش‌های تولید با رسید انبار منطبق‌اند.';
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
