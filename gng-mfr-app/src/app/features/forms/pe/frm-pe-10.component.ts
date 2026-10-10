import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { BannerTone, OperationalFormLayoutComponent } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { WO_STATUS, faInt, faNum, faPct } from '../pc/pc-shared';
import {
  ECO_CHANGE, ECO_ENTITY, ECO_ORIGIN, ECO_STATUS, HEALTH_FORMULA, IMPACT_FORMULA, OUTPUT_TYPE, PeProduct, PeRecoveryReceipt, PeStructure, ROLE, STRUCT_STATUS,
  STRUCT_TYPE, SUGGEST_FORMULA, Space, faD, faDM, healthColor, healthTone,
} from './frm-pe-10.data';
import { FrmPe10Service } from './frm-pe-10.service';
import {
  Cluster, Defect, DefectGroup, EcoView, Health, LeafReq, Pe10Engine, RippleOpts, RippleResult, Scope, StarEdge, StarNode, SubOption, TruthRow, XNode, YieldTruth,
} from './pe10/pe10-engine';
import { Overlay, Pe10IcicleComponent } from './pe10/pe10-icicle.component';
import { Pe10RippleComponent } from './pe10/pe10-ripple.component';
import { Pe10SkyComponent } from './pe10/pe10-sky.component';
import { Pe10TimelineComponent } from './pe10/pe10-timeline.component';

interface Kpi { label: string; value: string; sub: string; tone: string; hint: string }
interface Card { product: PeProduct; health: Health; structures: { s: PeStructure; health: Health; color: string }[]; color: string; facts: string[] }
interface Bar { key: string; label: string; v: number; pct: number; tone: string }

const EMPTY_SCOPE: Scope = { groups: [], productId: null, types: [], statuses: [] };

/**
 * FRM-PE-10 — «رصدخانه‌ی مهندسی محصول» (BI مهندسی محصول برای جلسه‌ی بازبینی مهندسی؛ به درخواست کاربر).
 *
 * یک دامنه‌ی مشترک (گروه کالا، کالا، نوع و وضعیت ساختار) شش فضا را می‌راند: صورت‌فلکی محصولات با امتیاز سلامت مهندسی
 * و کارت سلامت (کنترل‌های mes.GetBiPeChecks با فرم مالک)، پرتونگاری ساختار (بسط چندسطحی آیسیکل با لایه‌های خطر،
 * ظرفیت ساخت با موجودی و کنترل متقابل با mes.ExplodeStructure)، «اگر این ماده نرسد…» (موج اثر روی ساختار، دستور و
 * درخواست با سناریوی جایگزین/ECO/محموله‌ی در راه)، دقت ساختار در اجرا (مصرف، بازده و بازیابی واقعی در برابر
 * استاندارد با پیشنهاد اصلاح و اعتماد)، رادار تغییر (قیف، سن، اثر و خط زمانی ECO) و بدهی فنی داده (نقص‌های رتبه‌بندی‌شده).
 *
 * فاز اول: فقط‌خواندنی. اعمال مقدار پیشنهادی در ساختار، ثبت ECO از روی سناریو، ارجاع نقص به مسئول و ذخیره‌ی
 * سناریوها با فاز ایجاد/ویرایش می‌آید.
 */
@Component({
  selector: 'gng-frm-pe-10',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, DropdownModule, TooltipModule, OperationalFormLayoutComponent, DataSourceBadgeComponent, Pe10SkyComponent,
    Pe10IcicleComponent, Pe10RippleComponent, Pe10TimelineComponent,
  ],
  templateUrl: './frm-pe-10.component.html',
  styles: [`
    .ob { --o-bg: #0b223b; --o-p: rgba(16, 44, 74, 0.92); --o-p2: #143556; --o-line: rgba(111, 183, 255, 0.28); --o-text: #e3efff; --o-mut: #8fb3d9;
      --o-cyan: #6fb7ff; --o-amber: #ffcf5a; --o-red: #ff8a7a; --o-green: #7fd1ae;
      background-color: var(--o-bg); color: var(--o-text); border-radius: var(--gng-radius); padding: 0.9rem; display: flex; flex-direction: column; gap: 0.8rem; min-height: 30rem;
      background-image: linear-gradient(rgba(111, 183, 255, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(111, 183, 255, 0.07) 1px, transparent 1px),
        linear-gradient(rgba(111, 183, 255, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(111, 183, 255, 0.035) 1px, transparent 1px);
      background-size: 96px 96px, 96px 96px, 24px 24px, 24px 24px; }
    .ob__state { padding: 2rem; text-align: center; color: var(--o-mut); }
    .ob__state--err { color: var(--o-red); }
    .ob__scope { background: var(--o-p); border: 1px solid var(--o-line); border-radius: var(--gng-radius); padding: 0.6rem 0.75rem; display: flex; flex-direction: column; gap: 0.45rem; }
    .row { display: flex; flex-wrap: wrap; gap: 0.45rem 1.1rem; align-items: center; }
    .seg { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
    .seg--grow { flex: 1 1 16rem; min-width: 13rem; }
    .dim { color: var(--o-mut); font-size: 0.72rem; }
    .chip { background: rgba(111, 183, 255, 0.06); color: var(--o-text); border: 1px solid var(--o-line); border-radius: 99px; padding: 0.18rem 0.65rem; font-size: 0.74rem;
      cursor: pointer; font-family: inherit; white-space: nowrap; }
    .chip:hover { border-color: var(--o-cyan); }
    .chip--on { background: var(--o-amber); border-color: var(--o-amber); color: #1b1404; font-weight: 700; }
    .chip--ghost { background: none; color: var(--o-mut); }
    .crumb { font-size: 0.92rem; font-weight: 700; color: var(--o-amber); }
    .kpis { position: relative; display: grid; grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr)); gap: 0.55rem; }
    .kpi { background: var(--o-p); border: 1px solid var(--o-line); border-radius: var(--gng-radius); padding: 0.55rem 0.75rem; border-top: 3px solid var(--o-cyan); }
    .kpi--danger { border-top-color: var(--o-red); } .kpi--warning { border-top-color: var(--o-amber); } .kpi--success { border-top-color: var(--o-green); }
    .kpi__l { font-size: 0.72rem; color: var(--o-mut); }
    .kpi__v { font-size: 1.55rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .kpi__s { font-size: 0.68rem; color: #c3d8f0; }
    .rail { display: flex; gap: 0.3rem; flex-wrap: wrap; border-bottom: 1px solid var(--o-line); padding-bottom: 0.35rem; }
    .rail button { background: none; border: none; color: var(--o-mut); font-family: inherit; font-size: 0.86rem; padding: 0.45rem 0.8rem; border-radius: 8px 8px 0 0; cursor: pointer;
      display: flex; gap: 0.35rem; align-items: center; }
    .rail button:hover { color: var(--o-text); }
    .rail button.on { color: #fff; background: var(--o-p); box-shadow: inset 0 -3px 0 var(--o-amber); font-weight: 700; }
    .rail b { background: rgba(111, 183, 255, 0.15); border-radius: 99px; padding: 0 0.45rem; font-size: 0.7rem; }
    .rail b.hot { background: #c0392b; color: #fff; }
    .sp { display: flex; flex-direction: column; gap: 0.8rem; }
    .two { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(18rem, 1fr); gap: 0.8rem; align-items: start; }
    .two--even { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    @media (max-width: 1100px) { .two, .two--even { grid-template-columns: 1fr; } }
    .panel { position: relative; background: var(--o-p); border: 1px solid var(--o-line); border-radius: var(--gng-radius); padding: 0.75rem 0.9rem; min-width: 0; }
    .panel h3 { margin: 0 0 0.5rem; font-size: 0.95rem; color: #fff; }
    .panel h3 small { color: var(--o-mut); font-weight: 400; font-size: 0.72rem; }
    .ph { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    .ph h3 { margin: 0; }
    .hint { font-size: 0.7rem; color: var(--o-mut); margin-top: 0.45rem; line-height: 1.7; }
    .empty { color: var(--o-mut); font-size: 0.8rem; padding: 0.6rem 0; }
    .mono { font-family: monospace; }
    .story { margin: 0.3rem 0 0; font-size: 0.8rem; line-height: 1.8; background: rgba(255, 207, 90, 0.06); border-right: 3px solid var(--o-amber); padding: 0.4rem 0.6rem; border-radius: 4px; }
    .legend { display: flex; flex-wrap: wrap; gap: 0.7rem; font-size: 0.68rem; color: var(--o-mut); align-items: center; }
    .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 4px; vertical-align: middle; }
    .grad { display: inline-block; width: 7rem; height: 8px; border-radius: 9px; background: linear-gradient(90deg, hsl(142, 78%, 48%), hsl(73, 78%, 52%), hsl(4, 78%, 56%)); vertical-align: middle; }
    .gauge { display: flex; gap: 0.8rem; align-items: center; }
    .ring { width: 4.2rem; height: 4.2rem; border-radius: 50%; display: grid; place-items: center; flex: none; }
    .ring span { width: 3.3rem; height: 3.3rem; border-radius: 50%; background: var(--o-p2); display: grid; place-items: center; font-weight: 900; font-size: 1.05rem; }
    .card__t { font-size: 1rem; font-weight: 800; }
    .card__s { font-size: 0.72rem; color: var(--o-mut); }
    .chk { display: grid; grid-template-columns: 1.3rem 1fr auto; gap: 0.4rem; align-items: start; font-size: 0.76rem; padding: 0.3rem 0.2rem; border-bottom: 1px dashed rgba(111, 183, 255, 0.14); }
    .chk__i--ok { color: var(--o-green); } .chk__i--bad { color: var(--o-red); } .chk__i--warn { color: var(--o-amber); }
    .chk small { display: block; color: var(--o-mut); font-size: 0.68rem; line-height: 1.6; }
    .form { font-family: monospace; font-size: 0.66rem; border: 1px solid var(--o-line); border-radius: 6px; padding: 0 0.35rem; color: var(--o-cyan); white-space: nowrap; }
    .pill { display: inline-block; font-size: 0.64rem; padding: 0 0.42rem; border-radius: 99px; background: rgba(111, 183, 255, 0.12); color: #c3d8f0; margin-left: 0.25rem; white-space: nowrap; }
    .pill--danger { background: rgba(255, 107, 107, 0.2); color: #ffb3a8; } .pill--warning { background: rgba(255, 207, 90, 0.18); color: #ffe08a; }
    .pill--success { background: rgba(127, 209, 174, 0.18); color: #a8f0cf; } .pill--muted { color: var(--o-mut); } .pill--info { background: rgba(124, 196, 255, 0.18); color: #b8e0ff; }
    .mini { width: 100%; border-collapse: collapse; font-size: 0.73rem; }
    .mini th { text-align: right; color: var(--o-mut); font-weight: 400; border-bottom: 1px solid var(--o-line); padding: 0.25rem 0.3rem; white-space: nowrap; }
    .mini td { padding: 0.25rem 0.3rem; border-bottom: 1px solid rgba(111, 183, 255, 0.08); vertical-align: top; }
    .mini tr.click { cursor: pointer; } .mini tr.click:hover td { background: rgba(111, 183, 255, 0.07); }
    .mini tr.on td { background: rgba(255, 207, 90, 0.1); }
    .st--ok { color: var(--o-green); } .st--sub { color: #7cc4ff; } .st--partial { color: var(--o-amber); } .st--blocked, .st--risk { color: var(--o-red); }
    .link { background: none; border: 1px dashed var(--o-line); color: var(--o-cyan); border-radius: 6px; padding: 0.1rem 0.5rem; font-family: inherit; font-size: 0.72rem; cursor: pointer; }
    .link:hover { color: #fff; border-color: var(--o-amber); }
    .sel { background: var(--o-p2); color: var(--o-text); border: 1px solid var(--o-line); border-radius: 6px; padding: 0.2rem 0.4rem; font-family: inherit; font-size: 0.78rem; }
    .num { width: 6rem; }
    input[type='range'] { accent-color: var(--o-amber); direction: ltr; }
    .lt { display: grid; grid-template-columns: minmax(8rem, 1.4fr) 1fr 5rem; gap: 0.4rem; align-items: center; font-size: 0.72rem; padding: 0.15rem 0; }
    .bar { position: relative; height: 0.7rem; background: rgba(111, 183, 255, 0.1); border-radius: 4px; overflow: hidden; }
    .bar i { position: absolute; inset: 0 0 0 auto; border-radius: 4px; }
    .bar--success i { background: var(--o-green); } .bar--warning i { background: var(--o-amber); } .bar--danger i { background: var(--o-red); } .bar--muted i { background: var(--o-mut); }
    .bar--info i { background: var(--o-cyan); }
    .big { font-size: 1.15rem; font-weight: 800; color: var(--o-amber); }
    .xc { display: flex; gap: 0.4rem; align-items: center; font-size: 0.74rem; flex-wrap: wrap; }
    .opt { border: 1px solid var(--o-line); border-radius: 8px; padding: 0.45rem 0.6rem; font-size: 0.74rem; display: flex; flex-direction: column; gap: 0.2rem; cursor: pointer; background: rgba(111, 183, 255, 0.04); }
    .opt--on { border-color: var(--o-amber); background: rgba(255, 207, 90, 0.09); }
    .opt__h { display: flex; justify-content: space-between; gap: 0.4rem; font-weight: 700; }
    .opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.5rem; }
    .chkbox { display: flex; gap: 0.35rem; align-items: center; font-size: 0.74rem; cursor: pointer; }
    .chkbox input { accent-color: var(--o-amber); }
    .strip { position: relative; height: 1.3rem; background: rgba(111, 183, 255, 0.07); border-radius: 4px; min-width: 10rem; }
    .strip__band { position: absolute; top: 0; bottom: 0; background: rgba(127, 209, 174, 0.18); border-left: 1px solid rgba(127, 209, 174, 0.6); border-right: 1px solid rgba(127, 209, 174, 0.6); }
    .strip__zero { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255, 255, 255, 0.5); }
    .strip__dot { position: absolute; top: 50%; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--o-cyan); border: 1px solid #fff; }
    .strip__dot--c { background: #c9a7ff; }
    .strip__mean { position: absolute; top: 2px; bottom: 2px; width: 3px; margin-left: -1.5px; background: var(--o-amber); }
    .strip__sug { position: absolute; top: -3px; width: 0; height: 0; margin-left: -5px; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 7px solid var(--o-red); }
    .funnel { display: flex; flex-direction: column; gap: 0.25rem; align-items: center; }
    .funnel__s { display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.3rem 0.7rem; border-radius: 6px; font-size: 0.76rem; background: rgba(111, 183, 255, 0.14);
      border: 1px solid var(--o-line); min-width: 8rem; }
    .funnel__s--hot { background: rgba(255, 207, 90, 0.2); border-color: var(--o-amber); }
    .eco { border: 1px solid var(--o-line); border-radius: 10px; padding: 0.6rem 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; cursor: pointer; background: rgba(111, 183, 255, 0.03); }
    .eco--on { border-color: var(--o-amber); }
    .eco__h { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .eco__steps { display: flex; gap: 2px; }
    .eco__steps i { flex: 1; height: 5px; border-radius: 3px; background: rgba(111, 183, 255, 0.15); }
    .eco__steps i.done { background: var(--o-green); } .eco__steps i.cur { background: var(--o-amber); }
    .kv { display: flex; flex-wrap: wrap; gap: 0.25rem 0.9rem; font-size: 0.72rem; color: var(--o-mut); }
    .kv b { color: var(--o-text); }
    .def { display: grid; grid-template-columns: 2.8rem 1fr auto; gap: 0.5rem; align-items: center; padding: 0.35rem; border-radius: 6px; font-size: 0.76rem;
      border-right: 3px solid var(--o-cyan); cursor: pointer; }
    .def:hover { background: rgba(111, 183, 255, 0.06); }
    .def--3 { border-right-color: var(--o-red); } .def--2 { border-right-color: var(--o-amber); }
    .def__score { font-weight: 900; text-align: center; background: rgba(111, 183, 255, 0.12); border-radius: 6px; padding: 0.1rem 0; }
    .def__x { margin: 0.1rem 3.3rem 0.5rem 0; font-size: 0.74rem; line-height: 1.7; color: #c3d8f0; }
    .grp__h { font-weight: 800; font-size: 0.82rem; border-bottom: 1px solid var(--o-line); padding: 0.25rem 0; margin: 0.4rem 0 0.2rem; display: flex; justify-content: space-between; }
    .grp__h span { color: var(--o-mut); font-weight: 400; font-size: 0.7rem; }
    .todo { margin: 0; }
    :host ::ng-deep .ob__dd.p-dropdown { background: var(--gng-dark-700); border-color: var(--gng-dark-border); }
    :host ::ng-deep .ob__dd .p-dropdown-label { color: #e3efff; font-size: 0.8rem; padding: 0.3rem 0.6rem; }
  `],
})
export class FrmPe10Component implements OnInit {
  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;
  eng: Pe10Engine | null = null;
  space: Space = 'sky';
  scope: Scope = { ...EMPTY_SCOPE };

  groupChips: string[] = [];
  readonly typeChips = [1, 2, 3].map((c) => ({ code: c, label: STRUCT_TYPE[c] }));
  readonly statusChips = [1, 3, 4].map((c) => ({ code: c, label: STRUCT_STATUS[c] }));
  productOptions: { label: string; value: number }[] = [];
  breadcrumb = '';
  kpis: Kpi[] = [];

  // ۱) صورت‌فلکی
  stars: StarNode[] = [];
  edges: StarEdge[] = [];
  clusters: Cluster[] = [];
  selProduct: number | null = null;
  card: Card | null = null;
  worst: { id: number; label: string; score: number | null; color: string; fail: number }[] = [];

  // ۲) پرتونگاری
  structureOptions: { label: string; value: number }[] = [];
  xStruct: number | null = null;
  xBatches = 1;
  xWaste = true;
  overlay: Overlay = 'risk';
  xNodes: XNode[] = [];
  leaves: LeafReq[] = [];
  xRootLabel = '';
  xRootQty = '';
  makeable = '';
  serverCheck: { state: 'idle' | 'loading' | 'ok' | 'diff' | 'error'; text: string; diffs: string[] } = { state: 'idle', text: '', diffs: [] };
  readonly overlays: { value: Overlay; label: string }[] = [
    { value: 'risk', label: 'خطر ترکیبی' }, { value: 'stock', label: 'موجودی' }, { value: 'single', label: 'تک‌منبع' }, { value: 'noSub', label: 'بدون جایگزین' },
    { value: 'quality', label: 'قرنطینه/انقضا' }, { value: 'ai', label: 'ماده‌ی مؤثره' }, { value: 'customer', label: 'امانی مشتری' },
  ];

  // ۳) اگر نرسد
  materials: { id: number; label: string; days: number | null; tone: string }[] = [];
  matId: number | null = null;
  ropts: RippleOpts = { optionByGroup: {}, acceptEcos: [], includeTransit: false };
  ripple: RippleResult | null = null;
  shortMaterials = 0;

  // ۴) دقت در اجرا
  k = 3;
  truthRows: TruthRow[] = [];
  yieldRows: YieldTruth[] = [];
  recovery: PeRecoveryReceipt[] = [];
  selTruth: string | null = null;
  biasCount = 0;
  range = 8;

  // ۵) رادار تغییر
  ecoViews: EcoView[] = [];
  funnel: { status: number; label: string; count: number; width: number; hot: boolean }[] = [];
  selEco: number | null = null;
  openEcos = 0;

  // ۶) بدهی فنی
  defects: Defect[] = [];
  defectBy: 'type' | 'form' | 'owner' | 'entity' = 'type';
  defectGroups: DefectGroup[] = [];
  selDefect: string | null = null;
  ownerBars: Bar[] = [];
  productBars: Bar[] = [];
  critical = 0;

  bannerText = 'در حال خواندن…';
  bannerTone: BannerTone = 'info';
  contextLabel = '';

  readonly faInt = faInt;
  readonly faNum = faNum;
  readonly faPct = faPct;
  readonly faD = faD;
  readonly faDM = faDM;
  readonly healthColor = healthColor;
  readonly role = ROLE;
  readonly structType = STRUCT_TYPE;
  readonly structStatus = STRUCT_STATUS;
  readonly ecoStatus = ECO_STATUS;
  readonly ecoOrigin = ECO_ORIGIN;
  readonly ecoEntity = ECO_ENTITY;
  readonly ecoChange = ECO_CHANGE;
  readonly outputType = OUTPUT_TYPE;
  readonly woStatus = WO_STATUS;
  readonly healthFormula = HEALTH_FORMULA;
  readonly impactFormula = IMPACT_FORMULA;
  readonly suggestFormula = SUGGEST_FORMULA;
  readonly ecoSteps = [1, 2, 3, 4, 5];
  readonly dsChecks = this.ds('pe10-checks', 'چک‌لیست سلامت');
  readonly dsProducts = this.ds('pe10-products', 'واقعیت کالاها');
  readonly dsItems = this.ds('pe10-items', 'ردیف‌های مؤثر ساختار');
  readonly dsStock = this.ds('pe10-stock', 'موجودی مواد');
  readonly dsDemand = this.ds('pe10-demand', 'نیاز باز دستورها');
  readonly dsExec = this.ds('pe10-execution', 'مصرف واقعی');
  readonly dsEco = this.ds('pe10-eco', 'دامنه‌ی ECO');
  readonly dsSubs = this.ds('pe10-substitutes', 'گروه‌های جایگزین');

  constructor(private svc: FrmPe10Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.svc.bundle(this.companyId).subscribe({
      next: (b) => {
        this.eng = new Pe10Engine(b);
        this.loading = false;
        this.groupChips = this.eng.groups;
        this.productOptions = b.products
          .filter((p) => this.eng?.isStar(p))
          .map((p) => ({ label: `${p.code} — ${p.title}${p.role !== null ? ' (' + ROLE[p.role] + ')' : ''}`, value: p.id }));
        this.recompute();
      },
      error: (err) => {
        console.warn('[FRM-PE-10] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
        this.bannerText = 'خواندن داده از gng-mfr-api ناموفق بود. اجرای mes_frm_pe10_setup.sql و endpoint ‎/api/pe10/bundle را بررسی کنید.';
        this.bannerTone = 'danger';
      },
    });
  }

  // ───────── دامنه ─────────
  toggleGroup(g: string): void {
    this.scope = { ...this.scope, groups: this.scope.groups.includes(g) ? this.scope.groups.filter((x) => x !== g) : [...this.scope.groups, g] };
    this.recompute();
  }

  toggleType(c: number): void {
    this.scope = { ...this.scope, types: this.scope.types.includes(c) ? this.scope.types.filter((x) => x !== c) : [...this.scope.types, c] };
    this.recompute();
  }

  toggleStatus(c: number): void {
    this.scope = { ...this.scope, statuses: this.scope.statuses.includes(c) ? this.scope.statuses.filter((x) => x !== c) : [...this.scope.statuses, c] };
    this.recompute();
  }

  setProduct(id: number | null): void {
    this.scope = { ...this.scope, productId: id };
    if (id !== null) this.selProduct = id;
    this.recompute();
  }

  clearScope(): void {
    this.scope = { ...EMPTY_SCOPE };
    this.recompute();
  }

  private recompute(): void {
    const e = this.eng;
    if (!e) return;
    const s = this.scope;
    const parts = [
      s.groups.length ? s.groups.join('، ') : 'همه‌ی گروه‌ها', s.productId !== null ? e.label(s.productId) : '',
      s.types.length ? `ساختار ${s.types.map((t) => STRUCT_TYPE[t]).join('/')}` : '', s.statuses.length ? s.statuses.map((t) => STRUCT_STATUS[t]).join('/') : '',
    ].filter((x) => !!x);
    this.breadcrumb = parts.join(' · ');
    this.contextLabel = e.isAll(s) ? 'کل شرکت' : this.breadcrumb;

    const sky = e.constellation(s);
    this.stars = sky.nodes;
    this.edges = sky.edges;
    this.clusters = sky.clusters;
    this.worst = sky.nodes
      .filter((n) => !n.dim && n.score !== null && (n.score as number) < 100)
      .sort((a, c) => (a.score ?? 0) - (c.score ?? 0) || c.reach - a.reach)
      .slice(0, 8)
      .map((n) => ({ id: n.id, label: `${n.code} ${n.title}`, score: n.score, color: n.color, fail: e.productHealth(n.id).fail }));
    if (this.selProduct === null) this.selProduct = this.worst[0]?.id ?? null;
    this.buildCard();

    const ss = e.scopeStructures(s).filter((x) => x.type !== 3);
    this.structureOptions = ss.map((x) => ({ label: `${x.code} — ${x.title} (${STRUCT_STATUS[x.status] ?? ''})`, value: x.id }));
    if (this.xStruct === null || !ss.some((x) => x.id === this.xStruct)) this.xStruct = ss.find((x) => x.isDefault && x.type === 1)?.id ?? ss[0]?.id ?? null;
    this.recomputeXray();

    this.materials = e.materialList(s);
    this.shortMaterials = this.materials.filter((m) => m.tone === 'danger').length;
    if (this.matId === null || !this.materials.some((m) => m.id === this.matId)) this.matId = this.materials[0]?.id ?? null;
    this.recomputeRipple();

    this.recomputeTruth();

    this.ecoViews = e.ecoViews(s);
    this.openEcos = this.ecoViews.filter((v) => v.open).length;
    const max = Math.max(1, ...[1, 2, 3, 4, 5, 6].map((st) => this.ecoViews.filter((v) => v.eco.status === st).length));
    this.funnel = [1, 2, 3, 4, 5, 6].map((st) => {
      const count = this.ecoViews.filter((v) => v.eco.status === st).length;
      return { status: st, label: ECO_STATUS[st], count, width: 40 + (60 * count) / max, hot: st === 3 && count > 0 };
    });
    if (this.selEco === null || !this.ecoViews.some((v) => v.eco.id === this.selEco)) this.selEco = this.ecoViews.find((v) => v.open)?.eco.id ?? this.ecoViews[0]?.eco.id ?? null;

    this.defects = e.defects(s);
    this.critical = this.defects.filter((d) => d.severity >= 3).length;
    this.regroup();
    const own = e.groupDefects(this.defects, 'owner');
    const omax = Math.max(1, ...own.map((g) => g.impact));
    this.ownerBars = own.map((g) => ({ key: g.key, label: g.title, v: g.impact, pct: (100 * g.impact) / omax, tone: 'warning' }));
    const byP = new Map<number, number>();
    for (const d of this.defects) if (d.productId !== null) byP.set(d.productId, (byP.get(d.productId) ?? 0) + d.impact);
    const pmax = Math.max(1, ...byP.values());
    this.productBars = [...byP.entries()]
      .sort((a, c) => c[1] - a[1])
      .slice(0, 10)
      .map(([id, v]) => ({ key: String(id), label: e.label(id), v, pct: (100 * v) / pmax, tone: v >= pmax * 0.6 ? 'danger' : 'warning' }));

    this.buildKpis();
    this.buildBanner();
  }

  private buildKpis(): void {
    const e = this.eng;
    if (!e) return;
    const scored = this.stars.filter((n) => !n.dim && n.score !== null);
    const avg = scored.length ? Math.round(scored.reduce((a, n) => a + (n.score ?? 0), 0) / scored.length) : null;
    this.kpis = [
      { label: 'سلامت مهندسی میانگین', value: avg === null ? '—' : faInt(avg), sub: `${faInt(scored.length)} کالای ارزیابی‌شده`, tone: healthTone(avg), hint: HEALTH_FORMULA },
      { label: 'نقص داده‌ی مهندسی', value: faInt(this.defects.length), sub: `${faInt(this.critical)} بحرانی`, tone: this.critical ? 'danger' : this.defects.length ? 'warning' : 'success', hint: IMPACT_FORMULA },
      { label: 'مواد زیر ۳ روز پوشش', value: faInt(this.shortMaterials), sub: `از ${faInt(this.materials.length)} ماده‌ی ساختارها`, tone: this.shortMaterials ? 'danger' : 'success', hint: 'پوشش = موجودی آزاد ÷ مصرف روزانه (بیشینه‌ی مصرف ۱۴ روز و نیاز باز دستورها)' },
      { label: 'استاندارد سوگیر در اجرا', value: faInt(this.biasCount), sub: `از ${faInt(this.truthRows.length)} ردیف با نمونه‌ی مصرف`, tone: this.biasCount ? 'warning' : 'success', hint: SUGGEST_FORMULA },
      { label: 'ECO باز', value: faInt(this.openEcos), sub: this.ecoViews.filter((v) => v.open && v.issues.length).length ? 'دارای ایراد اجرایی' : 'بدون ایراد اجرایی', tone: this.ecoViews.some((v) => v.open && v.issues.length) ? 'warning' : 'info', hint: 'ECO با وضعیت پیش‌نویس تا تأییدشده' },
    ];
  }

  private buildBanner(): void {
    const parts: string[] = [];
    const top = this.defects[0];
    if (top) parts.push(`پراثرترین نقص: ${top.entity} — ${top.title}`);
    const w = this.worst[0];
    if (w) parts.push(`کم‌سلامت‌ترین: ${w.label} (${w.score === null ? '—' : faInt(w.score)})`);
    const m = this.materials.find((x) => x.tone === 'danger');
    if (m) parts.push(`پوشش کمتر از ۳ روز: ${m.label}`);
    const eco = this.ecoViews.find((v) => v.open && v.issues.length);
    if (eco) parts.push(`${eco.eco.number}: ${eco.issues[0]}`);
    this.bannerText = parts.length ? parts.join('   ·   ') : 'در این دامنه نقص مهندسی دیده نمی‌شود.';
    this.bannerTone = this.critical ? 'danger' : parts.length ? 'warning' : 'success';
  }

  // ───────── ۱) صورت‌فلکی ─────────
  pickStar(id: number): void {
    this.selProduct = id;
    this.buildCard();
  }

  private buildCard(): void {
    const e = this.eng;
    const p = e?.p(this.selProduct);
    if (!e || !p) {
      this.card = null;
      return;
    }
    const h = e.productHealth(p.id);
    const facts = [
      p.role !== null ? ROLE[p.role] : 'بدون نقش تولیدی', p.group, `${faInt(e.whereUsed(p.id).length)} ساختار مصرف‌کننده`,
      `موجودی آزاد ${faNum(p.onHand, 2)} ${p.unit}`, p.openReq ? `نیاز باز ${faNum(p.openReq, 2)}` : '', p.quarantine ? `قرنطینه ${faNum(p.quarantine, 2)}` : '',
    ].filter((x) => !!x);
    this.card = {
      product: p, health: h, color: healthColor(h.score), facts,
      structures: (e.structuresOf.get(p.id) ?? []).map((s) => {
        const sh = e.structureHealth(s.id);
        return { s, health: sh, color: healthColor(sh.score) };
      }),
    };
  }

  ringBg(score: number | null): string {
    const v = score ?? 0;
    return `conic-gradient(${healthColor(score)} ${v * 3.6}deg, rgba(111,183,255,0.12) 0)`;
  }

  goXray(sid: number): void {
    this.xStruct = sid;
    this.space = 'xray';
    this.recomputeXray();
  }

  goRipple(pid: number): void {
    if (!this.materials.some((m) => m.id === pid)) {
      this.scope = { ...EMPTY_SCOPE };
      this.recompute();
    }
    this.matId = pid;
    this.ropts = { optionByGroup: {}, acceptEcos: [], includeTransit: false };
    this.space = 'ripple';
    this.recomputeRipple();
  }

  // ───────── ۲) پرتونگاری ─────────
  recomputeXray(): void {
    const e = this.eng;
    const s = e?.st.get(this.xStruct ?? -1);
    this.serverCheck = { state: 'idle', text: '', diffs: [] };
    if (!e || !s || !s.baseQty) {
      this.xNodes = [];
      this.leaves = [];
      this.makeable = '';
      return;
    }
    const qty = s.baseQty * Math.max(0.1, this.xBatches);
    const p = e.p(s.productId);
    this.xNodes = e.explode(s.id, qty, this.xWaste);
    this.leaves = e.leafTotals(this.xNodes, true);
    this.xRootLabel = s.code;
    this.xRootQty = `${faNum(qty, 0)} ${p?.unit ?? ''} ${p?.code ?? ''}`;
    const one = e.leafTotals(e.explode(s.id, s.baseQty, this.xWaste), true);
    const lim = one.filter((l) => l.batches !== null).sort((a, c) => (a.batches ?? 0) - (c.batches ?? 0))[0];
    this.makeable = lim
      ? `با موجودی آزاد امروز ${faNum(Math.floor((lim.batches ?? 0) * 10) / 10, 1)} بچ مرجع (${faNum(s.baseQty, 0)} ${p?.unit ?? ''}) ساختنی است؛ گلوگاه: ${lim.code} ${lim.title}.`
      : '';
  }

  setOverlay(o: Overlay): void {
    this.overlay = o;
  }

  leafPct(l: LeafReq): number {
    return l.batches === null ? 0 : Math.min(100, l.batches * 50);
  }

  crossCheck(): void {
    const e = this.eng;
    const s = e?.st.get(this.xStruct ?? -1);
    if (!e || !s || !s.baseQty) return;
    if (!this.xWaste) {
      this.serverCheck = { state: 'error', text: 'کنترل متقابل با ضایعات انجام می‌شود؛ گزینه‌ی ضایعات را روشن کنید.', diffs: [] };
      return;
    }
    const qty = s.baseQty * Math.max(0.1, this.xBatches);
    this.serverCheck = { state: 'loading', text: 'در حال بسط در سرور…', diffs: [] };
    this.svc.explode(s.id, qty).subscribe({
      next: (rows) => {
        const srv = new Map<number, number>();
        for (const r of rows) if (r.isLeaf && r.required !== null) srv.set(r.productId, (srv.get(r.productId) ?? 0) + r.required);
        const mine = new Map(e.leafTotals(this.xNodes).map((l) => [l.productId, l.req]));
        const diffs: string[] = [];
        for (const id of new Set([...srv.keys(), ...mine.keys()])) {
          const a = mine.get(id) ?? 0;
          const b = srv.get(id) ?? 0;
          if (Math.abs(a - b) > Math.max(0.01, Math.abs(b) * 0.001)) diffs.push(`${e.label(id)}: رصدخانه ${faNum(a, 3)} · سرور ${faNum(b, 3)}`);
        }
        this.serverCheck = diffs.length
          ? { state: 'diff', text: `${faInt(diffs.length)} اختلاف با mes.ExplodeStructure`, diffs }
          : { state: 'ok', text: `مطابق mes.ExplodeStructure — ${faInt(srv.size)} ماده‌ی برگ`, diffs: [] };
      },
      error: () => (this.serverCheck = { state: 'error', text: 'بسط سرور در دسترس نیست (/api/pe08/explode).', diffs: [] }),
    });
  }

  // ───────── ۳) اگر نرسد ─────────
  recomputeRipple(): void {
    this.ripple = this.eng && this.matId !== null ? this.eng.ripple(this.matId, this.ropts) : null;
  }

  setMaterial(id: number): void {
    this.matId = id;
    this.ropts = { optionByGroup: {}, acceptEcos: [], includeTransit: false };
    this.recomputeRipple();
  }

  toggleOption(o: SubOption): void {
    const cur = this.ropts.optionByGroup[o.groupId] ?? null;
    this.ropts = { ...this.ropts, optionByGroup: { ...this.ropts.optionByGroup, [o.groupId]: cur === o.optionNo ? null : o.optionNo } };
    this.recomputeRipple();
  }

  isOptionOn(o: SubOption): boolean {
    return (this.ropts.optionByGroup[o.groupId] ?? null) === o.optionNo;
  }

  toggleEco(id: number): void {
    const l = this.ropts.acceptEcos.includes(id) ? this.ropts.acceptEcos.filter((x) => x !== id) : [...this.ropts.acceptEcos, id];
    this.ropts = { ...this.ropts, acceptEcos: l };
    this.recomputeRipple();
  }

  setTransit(v: boolean): void {
    this.ropts = { ...this.ropts, includeTransit: v };
    this.recomputeRipple();
  }

  stateLabel(st: string): string {
    return st === 'ok' ? 'پوشش از موجودی' : st === 'sub' ? 'با جایگزین' : st === 'partial' ? 'ناقص' : st === 'blocked' ? 'مسدود' : st === 'risk' ? 'در خطر' : st;
  }

  // ───────── ۴) دقت در اجرا ─────────
  recomputeTruth(): void {
    const e = this.eng;
    if (!e) return;
    this.truthRows = e.truth(this.scope, this.k);
    this.yieldRows = e.yieldTruth(this.scope);
    this.biasCount = this.truthRows.filter((r) => r.verdict === 'over' || r.verdict === 'under').length;
    const dev = this.truthRows.flatMap((r) => r.samples.map((x) => Math.abs(x.ratio - 1) * 100));
    this.range = Math.min(30, Math.max(4, Math.ceil(Math.max(0, ...dev) + 1)));
    this.recovery = e.b.recovery;
  }

  setK(v: number): void {
    this.k = Number(v);
    this.recomputeTruth();
    this.buildKpis();
  }

  /** موقعیت افقی (درصد) یک نسبت روی نوار انحراف −range..+range */
  pos(ratio: number): number {
    return Math.max(0, Math.min(100, 50 + ((ratio - 1) * 100 * 50) / this.range));
  }

  devPos(pct: number): number {
    return Math.max(0, Math.min(100, 50 + (pct * 50) / this.range));
  }

  verdictLabel(v: TruthRow['verdict'] | YieldTruth['verdict']): string {
    return { over: 'مصرف/بازده بیشتر از استاندارد', under: 'کمتر از استاندارد', ok: 'منطبق', noisy: 'پراکنده', few: 'نمونه‌ی کم', gap: 'مصرف ثبت نشده', none: 'رسید نشده' }[v];
  }

  verdictTone(v: TruthRow['verdict'] | YieldTruth['verdict']): string {
    return v === 'over' || v === 'under' ? 'danger' : v === 'noisy' || v === 'gap' ? 'warning' : v === 'ok' ? 'success' : 'muted';
  }

  recoveryTone(r: PeRecoveryReceipt): string {
    if (r.actualPct === null || r.stdPct === null) return 'muted';
    const d = r.stdPct - r.actualPct;
    return d > r.threshold ? 'danger' : d > r.threshold / 2 ? 'warning' : 'success';
  }

  // ───────── ۵) رادار تغییر ─────────
  get eco(): EcoView | null {
    return this.ecoViews.find((v) => v.eco.id === this.selEco) ?? null;
  }

  pickEco(id: number): void {
    this.selEco = id;
  }

  stepClass(v: EcoView, st: number): string {
    if (v.eco.status === 6) return '';
    return st < v.eco.status || v.eco.status === 5 ? 'done' : st === v.eco.status ? 'cur' : '';
  }

  // ───────── ۶) بدهی فنی ─────────
  setDefectBy(b: 'type' | 'form' | 'owner' | 'entity'): void {
    this.defectBy = b;
    this.regroup();
  }

  private regroup(): void {
    if (this.eng) this.defectGroups = this.eng.groupDefects(this.defects, this.defectBy);
  }

  pickDefect(k: string): void {
    this.selDefect = this.selDefect === k ? null : k;
  }

  openDefect(d: Defect): void {
    if (d.productId !== null) {
      this.selProduct = d.productId;
      this.buildCard();
      this.space = 'sky';
    }
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }

  trackKey(_: number, x: { key: string }): string {
    return x.key;
  }
}
