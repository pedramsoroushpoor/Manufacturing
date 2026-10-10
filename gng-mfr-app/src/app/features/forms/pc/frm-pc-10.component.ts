import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
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
  INVENTORY_KIND, OP_STATUS, REPORT_SOURCE, SHIPMENT_DIRECTION, SHIPMENT_ROLE, SHOP_NOW, STOCK_QC, SUBCONTRACT_STAGE, WO_STATUS,
  code39Bars, faDateTime, faDay, faDuration, faInt, faNum, faPct, opStatusTone, woStatusTone,
} from './pc-shared';
import {
  ConsumptionRow, DEFAULT_RECON_TOLERANCE, OwnerSection, Pc10Bundle, ProgressRow, ReconRow, Shipment, StageStep, StatementRow,
  StockRow, SUB_FEE_UNIT_SIZE, SubOrder, TollContract, WaterSeg,
} from './frm-pc-10.data';
import { FrmPc10Service } from './frm-pc-10.service';

const DAY = 86400000;
const t = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : NaN);

/**
 * FRM-PC-10 — «اجرای برون‌سپاری و کارمزدی».
 *
 * دو جهت کار با بیرون: (۱) برون‌سپاری — عملیاتی از دستور کار نزد پیمانکار انجام می‌شود: ردیاب مرحله و تأخیر،
 * برگه‌ی همراه ارسال و دریافت، ادامه‌ی خودکار مسیر داخلی، آبشار مغایرت مواد امانی و ماشین‌حساب کارمزد؛
 * (۲) کارمزدی دریافتی — مواد مشتری نزد ما: قرارداد، پیشرفت، صورت‌حساب مواد و کارمزد دریافتنی.
 * تفکیک مالکیت (ما / نزد پیمانکار / مشتری) در یک نما و هرگز جمع‌زده نمی‌شود.
 *
 * فاز اول: F-PC-080 تا F-PC-089 (نمایش زنده و شبیه‌سازی). صدور دستور، ثبت ارسال/دریافت، تأیید کیفیت ورود
 * و ارسال کارمزد/صورت‌حساب به بهای تمام‌شده با فاز ایجاد/ویرایش می‌آید.
 */
@Component({
  selector: 'gng-frm-pc-10',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, CheckboxModule, InputNumberModule, InputTextModule, SliderModule, TabViewModule, TableModule, TagModule,
    TooltipModule, OperationalFormLayoutComponent, DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pc-10.component.html',
  styles: [`
    .pc10-pick { display: flex; flex-direction: column; gap: 0.45rem; }
    .pc10-pick__group { font-size: 0.72rem; color: var(--gng-text-muted); margin-top: 0.4rem; }
    .pc10-pick__item { border: 1px solid var(--gng-border); border-radius: var(--gng-radius-sm); padding: 0.5rem 0.65rem; cursor: pointer; background: var(--gng-surface); }
    .pc10-pick__item:hover { border-color: var(--gng-primary); }
    .pc10-pick__item--on { border-color: var(--gng-primary); box-shadow: inset -3px 0 0 var(--gng-primary); }
    .pc10-pick__title { font-weight: 600; font-size: 0.82rem; }
    .pc10-pick__meta { font-size: 0.72rem; color: var(--gng-text-muted); }
    .pc10-step--partial .gng-step__circle { background: var(--gng-warning); border-color: var(--gng-warning); color: #fff; }
    .pc10-hero { display: grid; grid-template-columns: 1.3fr 1fr; gap: 1rem; align-items: stretch; }
    @media (max-width: 1100px) { .pc10-hero { grid-template-columns: 1fr; } }
    .pc10-count { display: flex; gap: 1.2rem; align-items: center; flex-wrap: wrap; }
    .pc10-count__big { font-size: 2.1rem; font-weight: 800; line-height: 1; }
    .pc10-count__big--danger { color: var(--gng-danger); }
    .pc10-count__big--ok { color: var(--gng-success); }
    .pc10-tl { position: relative; height: 3.6rem; margin: 1.6rem 0 0.4rem; }
    .pc10-tl__track { position: absolute; top: 1.4rem; right: 0; left: 0; height: 8px; border-radius: 99px; background: var(--gng-bg); border: 1px solid var(--gng-border); }
    .pc10-tl__done { position: absolute; top: 1.4rem; height: 8px; border-radius: 99px; background: var(--gng-info); right: 0; }
    .pc10-tl__late { position: absolute; top: 1.4rem; height: 8px; background: repeating-linear-gradient(45deg, var(--gng-danger), var(--gng-danger) 4px, transparent 4px, transparent 8px); opacity: .7; }
    .pc10-tl__mk { position: absolute; top: 0; transform: translateX(50%); text-align: center; font-size: 0.68rem; white-space: nowrap; }
    .pc10-tl__mk i { display: block; width: 2px; height: 1.9rem; margin: 0 auto; background: var(--gng-text-muted); }
    .pc10-tl__mk--now i { background: var(--gng-primary); width: 3px; }
    .pc10-tl__mk--due i { background: var(--gng-warning); }
    .pc10-tl__mk--fc i { background: var(--gng-danger); }
    .pc10-tl__mk span { display: block; margin-top: 0.15rem; color: var(--gng-text-muted); }
    .pc10-spark { width: 100%; height: 120px; }
    .pc10-slip { border: 1px dashed var(--gng-text-muted); border-radius: var(--gng-radius-sm); padding: 0.9rem 1rem; background: var(--gng-surface); margin-bottom: 1rem; }
    .pc10-slip__head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; border-bottom: 2px solid var(--gng-text); padding-bottom: 0.5rem; margin-bottom: 0.6rem; }
    .pc10-slip__title { font-size: 1rem; font-weight: 800; }
    .pc10-slip__route { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; margin: 0.4rem 0; flex-wrap: wrap; }
    .pc10-slip__box { border: 1px solid var(--gng-border); border-radius: 6px; padding: 0.25rem 0.5rem; }
    .pc10-slip__foot { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-top: 0.8rem; font-size: 0.72rem; color: var(--gng-text-muted); }
    .pc10-slip__sign { border-top: 1px solid var(--gng-border); padding-top: 1.2rem; text-align: center; }
    .pc10-bar { display: flex; height: 22px; border-radius: 6px; overflow: hidden; border: 1px solid var(--gng-border); background: var(--gng-bg); }
    .pc10-bar > div { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.66rem; color: #fff; white-space: nowrap; overflow: hidden; }
    .seg-used { background: var(--gng-info); } .seg-good { background: var(--gng-success); } .seg-def { background: var(--gng-warning); }
    .seg-waste { background: #8e6c3a; } .seg-ret { background: var(--gng-teal); } .seg-rem { background: var(--gng-purple); } .seg-diff { background: var(--gng-danger); }
    .pc10-wf { border: 1px solid var(--gng-border); border-radius: var(--gng-radius-sm); padding: 0.8rem 1rem; margin-bottom: 0.9rem; background: var(--gng-surface); }
    .pc10-wf--bad { border-color: var(--gng-danger); }
    .pc10-eq { font-size: 0.82rem; margin: 0.45rem 0; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
    .pc10-eq b { font-weight: 700; }
    .pc10-fee { font-size: 1.6rem; font-weight: 800; color: var(--gng-primary); }
    .pc10-own { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.9rem; align-items: start; }
    @media (max-width: 1200px) { .pc10-own { grid-template-columns: 1fr; } }
    .pc10-own__col { border-radius: var(--gng-radius-sm); border: 2px solid var(--gng-border); padding: 0.7rem 0.8rem; background: var(--gng-surface); }
    .pc10-own__col--own { border-color: var(--gng-info); } .pc10-own__col--contractor { border-color: var(--gng-purple); } .pc10-own__col--customer { border-color: var(--gng-warning); }
    .pc10-own__head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.4rem; }
    .pc10-own__row { display: grid; grid-template-columns: 1fr auto; gap: 0.4rem; font-size: 0.76rem; padding: 0.25rem 0; border-bottom: 1px solid var(--gng-border); }
    .pc10-own__row--hit { background: rgba(242, 177, 52, 0.12); }
    .pc10-own__inv { font-size: 0.72rem; font-weight: 700; color: var(--gng-text-muted); margin-top: 0.5rem; }
    .pc10-chain { display: flex; align-items: stretch; gap: 0.5rem; flex-wrap: wrap; }
    .pc10-chain__node { border: 1px solid var(--gng-border); border-radius: var(--gng-radius-sm); padding: 0.55rem 0.75rem; min-width: 11rem; background: var(--gng-surface); }
    .pc10-chain__arrow { align-self: center; color: var(--gng-text-muted); font-size: 1.2rem; }
  `],
})
export class FrmPc10Component implements OnInit {
  data: Pc10Bundle | null = null;
  loading = false;
  loadFailed = false;
  readonly companyId = DEMO_COMPANY_ID;
  activeTab = 0;
  selKey = '';

  order: SubOrder | null = null;
  contract: TollContract | null = null;
  orderProgress: ProgressRow[] = [];
  stageSteps: StageStep[] = [];
  outShipments: Shipment[] = [];
  inShipments: Shipment[] = [];
  tollShipments: Shipment[] = [];
  orderRecon: ReconRow[] = [];
  tollStatement: StatementRow[] = [];
  tollOurMaterials: ConsumptionRow[] = [];
  tollCustomerMaterials: ConsumptionRow[] = [];

  /* شبیه‌سازها */
  tolerancePct = DEFAULT_RECON_TOLERANCE;
  whatIfAccepted = 0;
  dailyCapacity = 0;
  secondPanBack = false;
  whatIfDelivered = 0;
  stockSearch = '';
  ownerSections: OwnerSection[] = [];
  multiOwnerProducts: string[] = [];

  readonly faNum = faNum;
  readonly faInt = faInt;
  readonly faPct = faPct;
  readonly faDay = faDay;
  readonly faDateTime = faDateTime;
  readonly faDuration = faDuration;
  readonly opStatus = OP_STATUS;
  readonly opStatusTone = opStatusTone;
  readonly woStatus = WO_STATUS;
  readonly woStatusTone = woStatusTone;
  readonly stage = SUBCONTRACT_STAGE;
  readonly direction = SHIPMENT_DIRECTION;
  readonly role = SHIPMENT_ROLE;
  readonly source = REPORT_SOURCE;
  readonly kind = INVENTORY_KIND;
  readonly qc = STOCK_QC;

  constructor(private pc10: FrmPc10Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.pc10.bundle(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.loading = false;
        this.buildOwnership();
        if (b.orders.length) this.pickOrder(b.orders[0]);
        else if (b.contracts.length) this.pickContract(b.contracts[0]);
      },
      error: (err) => {
        console.warn('[FRM-PC-10] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  // ───────── انتخاب ─────────

  pickOrder(o: SubOrder, jump = false): void {
    const d = this.data!;
    this.order = o;
    this.selKey = `sub-${o.workOrderId}-${o.opSeq}`;
    this.orderProgress = d.progress.filter((p) => p.workOrderId === o.workOrderId && p.opSeq === o.opSeq);
    this.outShipments = d.shipments.filter((s) => s.workOrderId === o.workOrderId && s.directionCode === 1);
    this.inShipments = d.shipments.filter((s) => s.workOrderId === o.workOrderId && s.directionCode === 2);
    this.orderRecon = d.recon.filter((r) => r.workOrderId === o.workOrderId).sort((a, b) => b.sent - a.sent);
    this.stageSteps = this.buildStages(o);
    this.whatIfAccepted = o.accepted;
    this.dailyCapacity = Math.round(this.observedRatePerDay / 1000) * 1000;
    this.secondPanBack = false;
    if (jump || this.activeTab >= 5) this.activeTab = 0;
  }

  pickContract(c: TollContract): void {
    const d = this.data!;
    this.contract = c;
    this.selKey = `toll-${c.id}`;
    this.tollStatement = d.statement.filter((s) => s.contractId === c.id);
    this.tollShipments = d.shipments.filter((s) => s.tollingContractId === c.id);
    const cons = d.consumption.filter((x) => x.workOrder === c.workOrder);
    this.tollCustomerMaterials = cons.filter((x) => x.customerMaterial);
    this.tollOurMaterials = cons.filter((x) => !x.customerMaterial);
    this.whatIfDelivered = c.orderQty - c.wastedSoFar;
    this.activeTab = 5;
  }

  // ───────── ردیاب مرحله و تأخیر (F-PC-086) ─────────

  private buildStages(o: SubOrder): StageStep[] {
    const hist = this.orderProgress;
    const firstOf = (st: number) => hist.find((p) => p.stageCode >= st);
    const got = firstOf(1);
    const ready = firstOf(3);
    const handled = o.receivedGood + o.receivedDefective + o.declaredWaste;
    return [
      { label: 'ارسال مواد', meta: `${faDay(o.sentAt)} · ${o.sendNumber}`, state: 'done' },
      { label: 'دریافت مواد نزد پیمانکار', meta: got ? faDateTime(got.reportedAt) : 'اعلام نشده', state: got ? 'done' : 'active' },
      {
        label: 'در جریان',
        meta: `${faInt(o.progressCompleted)} سالم · ${faInt(o.progressWasted)} ضایعات`,
        state: o.stageCode === 2 ? 'active' : (o.stageCode ?? 0) > 2 ? 'done' : '',
      },
      { label: 'آماده‌ی ارسال', meta: ready ? `بخشی از ${faDateTime(ready.reportedAt)}` : '—', state: o.stageCode === 3 ? 'active' : ready ? 'partial' : '' },
      {
        label: 'دریافت‌شده',
        meta: `${faInt(o.receivedGood)} از ${faInt(o.toComplete)}`,
        state: handled >= o.toComplete ? 'done' : o.receivedGood > 0 ? 'partial' : '',
      },
    ];
  }

  stepClass(s: StageStep): string {
    return s.state === 'done' ? 'gng-step--done' : s.state === 'active' ? 'gng-step--active' : s.state === 'partial' ? 'pc10-step--partial' : '';
  }

  get daysToDue(): number {
    return this.order ? (t(this.order.dueDate) - SHOP_NOW.getTime()) / DAY : 0;
  }

  get dueCountdown(): string {
    const d = this.daysToDue;
    return d >= 0 ? `${faDuration(d * 1440)} تا موعد قرارداد` : `${faDuration(-d * 1440)} از موعد گذشته`;
  }

  /** نرخ مشاهده‌شده از دو گزارش «در جریان» پیمانکار (واحد در روز) */
  get observedRatePerDay(): number {
    const pts = this.orderProgress.filter((p) => p.stageCode === 2 && p.completed > 0);
    if (pts.length < 2) return 0;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const days = (t(b.reportedAt) - t(a.reportedAt)) / DAY;
    return days > 0 ? (b.completed + b.wasted - a.completed - a.wasted) / days : 0;
  }

  get remainingToProcess(): number {
    return this.order ? Math.max(0, this.order.toComplete - this.order.progressCompleted - this.order.progressWasted) : 0;
  }

  /** پیش‌بینی ما: باقی‌مانده ÷ ظرفیت روزانه (با بازگشت پان دوم ×۲) از زمان آخرین گزارش */
  get ourForecastIso(): string | null {
    const o = this.order;
    const cap = this.dailyCapacity * (this.secondPanBack ? 2 : 1);
    if (!o || !o.progressAt || cap <= 0) return null;
    return new Date(t(o.progressAt) + (this.remainingToProcess / cap) * DAY).toISOString();
  }

  get ourDelayDays(): number {
    const f = this.ourForecastIso;
    return f && this.order ? (t(f) - t(this.order.dueDate)) / DAY : 0;
  }

  /** نوار زمانی: ارسال تا دیرترین پیش‌بینی؛ موقعیت‌ها از راست (RTL) */
  get timeline(): { start: number; end: number } {
    const o = this.order!;
    const ends = [t(o.dueDate), t(o.expectedReady), t(this.ourForecastIso)].filter((x) => !Number.isNaN(x));
    return { start: t(o.sentAt), end: Math.max(...ends, SHOP_NOW.getTime()) + DAY / 2 };
  }

  pos(iso: string | null | Date): number {
    if (!this.order || !iso) return 0;
    const v = iso instanceof Date ? iso.getTime() : t(iso);
    const { start, end } = this.timeline;
    return Math.max(0, Math.min(100, ((v - start) / (end - start)) * 100));
  }

  readonly shopNow = SHOP_NOW;

  /** نمودار پیشرفت اعلامی (ساعت سناریو از راست به چپ) */
  get spark(): { line: string; dots: { x: number; y: number; drop: boolean; label: string }[]; goalY: number } {
    const pts = this.orderProgress;
    if (!this.order || !pts.length) return { line: '', dots: [], goalY: 0 };
    const t0 = t(this.order.sentAt);
    const t1 = SHOP_NOW.getTime();
    const max = this.order.toComplete;
    const x = (iso: string) => 290 - ((t(iso) - t0) / (t1 - t0)) * 280;
    const y = (v: number) => 110 - (v / max) * 100;
    const dots = pts.map((p, i) => ({
      x: x(p.reportedAt),
      y: y(p.completed),
      drop: i > 0 && p.completed < pts[i - 1].completed,
      label: `${faDateTime(p.reportedAt)}: ${faInt(p.completed)}`,
    }));
    return { line: dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' '), dots, goalY: y(max) };
  }

  get progressDrops(): ProgressRow[] {
    return this.orderProgress.filter((p, i) => i > 0 && p.completed < this.orderProgress[i - 1].completed);
  }

  readyShift(p: ProgressRow): number {
    const i = this.orderProgress.indexOf(p);
    if (i <= 0 || !p.expectedReady || !this.orderProgress[i - 1].expectedReady) return 0;
    return Math.round((t(p.expectedReady) - t(this.orderProgress[i - 1].expectedReady)) / DAY);
  }

  // ───────── دریافت و ادامه‌ی مسیر (F-PC-082، 084) ─────────

  get receiptSegs(): WaterSeg[] {
    const o = this.order;
    if (!o) return [];
    const total = o.receivedGood + o.receivedDefective + o.declaredWaste;
    return this.segs(total, [
      ['سالم', o.receivedGood, 'seg-good'],
      ['معیوب برگشتی', o.receivedDefective, 'seg-def'],
      ['ضایعات اعلامی', o.declaredWaste, 'seg-waste'],
    ]);
  }

  get contractorWastePct(): number {
    const o = this.order;
    const total = o ? o.receivedGood + o.receivedDefective + o.declaredWaste : 0;
    return total ? ((o!.declaredWaste + o!.receivedDefective) / total) * 100 : 0;
  }

  get continuationOk(): boolean {
    return !!this.order && this.order.nextSeq !== null && this.order.nextReceived >= this.order.accepted && this.order.accepted > 0;
  }

  private segs(total: number, parts: [string, number, string][]): WaterSeg[] {
    return parts.filter((p) => p[1] > 0).map(([label, value, cls]) => ({ label, value, pct: total ? (value / total) * 100 : 0, cls }));
  }

  // ───────── مغایرت مواد امانی (F-PC-083) ─────────

  reconSegs(r: ReconRow): WaterSeg[] {
    return this.segs(r.sent, [
      ['مصرف اعلامی', r.declared, 'seg-used'],
      ['برگشتی', r.returned, 'seg-ret'],
      ['مانده نزد پیمانکار', r.remaining, 'seg-rem'],
      ['بی‌توضیح', r.difference, 'seg-diff'],
    ]);
  }

  diffPct(r: { difference: number; sent?: number; received?: number }): number {
    const base = r.sent ?? r.received ?? 0;
    return base ? (r.difference / base) * 100 : 0;
  }

  /** ماده‌ی اصلی (بیشترین ارسال) مبنای نسبت مصرف بقیه‌ی مواد است */
  get mainRecon(): ReconRow | null {
    return this.orderRecon[0] ?? null;
  }

  /** نیاز ماده‌ی فرعی برای باقی‌مانده‌ی ماده‌ی اصلی، به نسبت مصرف اعلامی تا کنون */
  needForRemaining(r: ReconRow): number | null {
    const m = this.mainRecon;
    if (!m || r === m || !m.declared) return null;
    return (m.remaining * r.declared) / m.declared;
  }

  /** از مانده‌ی ماده‌ی اصلی، چه‌قدر طبق گزارش پیشرفت فرآوری شده ولی هنوز برنگشته */
  get processedNotShipped(): number {
    const o = this.order;
    const m = this.mainRecon;
    return o && m ? Math.max(0, o.progressCompleted + o.progressWasted - m.declared) : 0;
  }

  // ───────── کارمزد (F-PC-085) ─────────

  get feeRate(): number {
    const o = this.order;
    return o && o.feePerUnit !== null ? o.feePerUnit / SUB_FEE_UNIT_SIZE : 0;
  }

  get whatIfFee(): number {
    return (this.whatIfAccepted ?? 0) * this.feeRate;
  }

  get fullOrderFee(): number {
    return this.order ? this.order.toComplete * this.feeRate : 0;
  }

  get withheldFee(): number {
    return this.order ? (this.order.receivedDefective + this.order.declaredWaste) * this.feeRate : 0;
  }

  // ───────── کارمزدی دریافتی (F-PC-087، 088) ─────────

  get tollWastePct(): number {
    return this.contract && this.contract.orderQty ? (this.contract.wastedSoFar / this.contract.orderQty) * 100 : 0;
  }

  get tollWasteExcess(): number {
    const c = this.contract;
    return c ? Math.max(0, c.wastedSoFar - (c.orderQty * c.allowedWastePct) / 100) : 0;
  }

  get tollFeeWhatIf(): number {
    const c = this.contract;
    return c && c.feePerUnit !== null ? ((this.whatIfDelivered ?? 0) * c.feePerUnit) / c.feeUnitSize : 0;
  }

  statementSegs(r: StatementRow): WaterSeg[] {
    return this.segs(r.received, [
      ['مصرف', r.consumed, 'seg-used'],
      ['مانده نزد ما', r.remaining, 'seg-rem'],
      ['بی‌توضیح', r.difference, 'seg-diff'],
    ]);
  }

  allowedLoss(r: StatementRow): number {
    return this.contract ? (r.consumed * this.contract.allowedWastePct) / 100 : 0;
  }

  // ───────── تفکیک مالکیت (F-PC-089) ─────────

  buildOwnership(): void {
    const all = this.data?.stock ?? [];
    const q = this.stockSearch.trim();
    const rows = q ? all.filter((r) => `${r.product} ${r.batch} ${r.inventory}`.includes(q)) : all;
    const tot = (rs: StockRow[]) => {
      const m = new Map<string, number>();
      for (const r of rs) m.set(r.unit, (m.get(r.unit) ?? 0) + r.onHand);
      return [...m.entries()].map(([unit, qty]) => ({ unit, qty }));
    };
    const own = rows.filter((r) => !r.customerOwned && r.kindCode !== 5);
    const ctr = rows.filter((r) => !r.customerOwned && r.kindCode === 5);
    const cus = rows.filter((r) => r.customerOwned);
    this.ownerSections = [
      { key: 'own', title: 'موجودی ما (در انبارهای خودمان)', hint: 'مرکزی، پای کار، قرنطینه، در راه', rows: own, totals: tot(own) },
      { key: 'contractor', title: 'مال ما نزد پیمانکار', hint: 'امانی نزد غیر — در حساب ما، در دست پیمانکار', rows: ctr, totals: tot(ctr) },
      { key: 'customer', title: 'مالکیت مشتری (امانی نزد ما)', hint: 'در دست ما، در حساب مشتری — هرگز در موجودی ما', rows: cus, totals: tot(cus) },
    ];
    const owners = new Map<number, Set<string>>();
    for (const r of all) owners.set(r.productId, (owners.get(r.productId) ?? new Set()).add(r.customerOwned ? 'c' : r.kindCode === 5 ? 'k' : 'o'));
    this.multiOwnerProducts = [...owners.entries()].filter(([, v]) => v.size > 1).map(([id]) => all.find((r) => r.productId === id)!.product);
  }

  isMultiOwner(r: StockRow): boolean {
    return this.multiOwnerProducts.includes(r.product);
  }

  inventoriesOf(sec: OwnerSection): { inventory: string; rows: StockRow[] }[] {
    const m = new Map<string, StockRow[]>();
    for (const r of sec.rows) m.set(r.inventory, [...(m.get(r.inventory) ?? []), r]);
    return [...m.entries()].map(([inventory, rows]) => ({ inventory, rows }));
  }

  // ───────── نمایش ─────────

  barcode(text: string): { bars: { x: number; w: number }[]; total: number } {
    return code39Bars(text);
  }

  roleTone(code: number): 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'contrast' {
    return code === 2 || code === 8 ? 'success' : code === 3 ? 'warning' : code === 6 ? 'danger' : code === 7 ? 'contrast' : code === 5 ? 'info' : 'secondary';
  }

  get problems(): { tone: 'danger' | 'warning'; text: string }[] {
    const out: { tone: 'danger' | 'warning'; text: string }[] = [];
    const d = this.data;
    if (!d) return out;
    for (const o of d.orders) {
      if (o.isOverdue) out.push({ tone: 'danger', text: `${o.workOrder} نزد ${o.contractor} از موعد ${faDay(o.dueDate)} گذشته` });
      else if (o.delayDays > 0) out.push({ tone: 'danger', text: `${o.workOrder} نزد ${o.contractor}: ${faInt(o.delayDays)} روز تأخیر پیش‌بینی (${faDay(o.expectedReady)} به جای ${faDay(o.dueDate)})` });
    }
    for (const r of d.recon.filter((x) => x.difference !== 0))
      out.push({ tone: 'danger', text: `${faNum(r.difference, 3)} ${r.unit} ${r.product.split(' — ').pop()} ارسالی به ${r.contractor} بی‌توضیح است` });
    for (const r of d.statement.filter((x) => x.difference !== 0))
      out.push({ tone: 'danger', text: `${faNum(r.difference, 2)} ${r.unit} ${r.product.split(' — ').pop()} مشتری ${r.customer} بی‌توضیح است` });
    for (const c of d.contracts) {
      const pct = c.orderQty ? (c.wastedSoFar / c.orderQty) * 100 : 0;
      if (pct > c.allowedWastePct) out.push({ tone: 'warning', text: `ضایعات ${c.workOrder} ${faPct(pct, 2)} — بیش از مجاز قرارداد ${c.number} (${faPct(c.allowedWastePct, 0)})` });
    }
    return out;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const p = this.problems;
    return p.some((x) => x.tone === 'danger') ? 'danger' : p.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc10_setup.sql را بررسی کنید.';
    if (this.loading || !this.data) return 'در حال خواندن…';
    const p = this.problems;
    return p.length ? p.map((x) => x.text).join('؛ ') + '.' : 'کار نزد پیمانکاران طبق برنامه است و مواد امانی و مواد مشتری بی‌مغایرت‌اند.';
  }

  get contextLabel(): string {
    if (this.activeTab === 5 && this.contract) return `${this.contract.number} — ${this.contract.customer}`;
    return this.order ? `${this.order.workOrder} / ${this.order.opSeq} — ${this.order.contractorCode}` : 'برون‌سپاری و کارمزدی';
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
