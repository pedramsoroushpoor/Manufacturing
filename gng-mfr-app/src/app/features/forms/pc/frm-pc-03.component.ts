import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { SHOP_NOW, Tone, WO_STATUS, code39Bars, faDateTime, faDay, faDuration, faInt, faNum, faPct, woStatusTone } from './pc-shared';
import { WoMaterial, WorkOrder } from './frm-pc-02.data';
import {
  CHECK_CODES, CHECK_ICON, CHECK_STATUS, CHECK_TITLE, EXCESS_STATUS, FEEDING_POLICY, KIT_STATUS,
  ExcessRow, KitRow, LineSideRow, Pc03Bundle, ReleaseCheck,
} from './frm-pc-03.data';
import { FrmPc03Service } from './frm-pc-03.service';

interface ReadinessRow {
  o: WorkOrder;
  cells: { code: string; check: ReleaseCheck | null }[];
  worst: number;
  verdict: string;
}

interface ChargeRow {
  m: WoMaterial;
  kits: KitRow[];
  planned: number;
  scheduled: number;
  delivered: number;
  consumed: number;
  policy: string;
  deliveredPct: number;
  consumedPct: number;
  scheduledPct: number;
}

interface KitView {
  k: KitRow;
  daysToExpiry: number | null;
  expiryTone: Tone;
  fefo: string;
  potencyDelta: number;
  substitution: boolean;
  bars: { x: number; w: number }[];
  barTotal: number;
  barText: string;
}

interface Gauge {
  l: LineSideRow;
  scale: number;
  onPct: number;
  needPct: number;
  minPct: number | null;
  maxPct: number | null;
  ropPct: number | null;
  runOutH: number | null;
  signal: string;
  signalTone: Tone;
  policyIssue: string;
}

/**
 * FRM-PC-03 — «آزادسازی، شارژ و تغذیه‌ی پای کار».
 *
 * ماتریس آمادگی آزادسازی (دستور × مواد/ظرفیت/ابزار/مهارت/کیفی/تجهیز) با جزئیات مانع و جمع‌بندی «چه چیزی جلوی آزادسازی را
 * گرفته»، تابلوی شارژ هر دستور (برنامه / در صف انتقال / تحویل / مصرف) با انتقال‌های به اندازه‌ی بچ و بارکد هر انتقال، تخصیص بچ
 * با کنترل FEFO، تصحیح عیار و جایگزینی، درخواست مازاد با کنترل سقف مصرف و برگشتی‌ها، و عقربه‌های موجودی پای کار در برابر
 * حداقل/حداکثر/نقطه‌ی سفارش با پیش‌بینی زمان اتمام و سیگنال فراخوان کششی.
 *
 * فاز اول: F-PC-020 تا 030 به‌صورت نمایش زنده. آزادسازی، صدور دستور شارژ، تخصیص و رزرو، تأیید مازاد، سند برگشت، فراخوان
 * کششی خودکار و تحویل با اسکن با فاز ایجاد/ویرایش می‌آیند.
 */
@Component({
  selector: 'gng-frm-pc-03',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, TabViewModule, TableModule, TagModule, TooltipModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-pc-03.component.html',
  styles: [`
    .pc3-matrix td, .pc3-matrix th { text-align: center; }
    .pc3-cell { display: inline-flex; width: 1.9rem; height: 1.9rem; border-radius: 50%; align-items: center; justify-content: center; cursor: pointer; color: #fff; font-size: 0.8rem; }
    .pc3-cell--1 { background: var(--gng-success); } .pc3-cell--2 { background: var(--gng-warning); } .pc3-cell--3 { background: var(--gng-danger); }
    .pc3-cell--0 { background: var(--gng-border); color: var(--gng-text-muted); }
    .pc3-cell--sel { outline: 3px solid var(--gng-primary); outline-offset: 2px; }
    .pc3-chip { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; padding: 0.05rem 0.45rem; border-radius: 999px; background: var(--gng-bg); border: 1px solid var(--gng-border); margin: 0.15rem 0 0 0.25rem; }
    .pc3-chip--danger { color: var(--gng-danger); border-color: var(--gng-danger); } .pc3-chip--warning { color: var(--gng-warning); border-color: var(--gng-warning); }
    .pc3-chip--success { color: var(--gng-success); border-color: var(--gng-success); } .pc3-chip--info { color: var(--gng-info); border-color: var(--gng-info); }
    .pc3-chip--secondary, .pc3-chip--contrast { color: var(--gng-text-muted); }
    .pc3-chip--on { background: var(--gng-primary); color: #fff; border-color: var(--gng-primary); cursor: pointer; }
    .pc3-item { padding: 0.45rem 0.5rem; border-radius: 8px; cursor: pointer; border: 1px solid transparent; font-size: 0.79rem; }
    .pc3-item:hover { background: var(--gng-bg); } .pc3-item--sel { border-color: var(--gng-primary); background: var(--gng-bg); }
    .pc3-dots { display: flex; gap: 3px; margin-top: 0.25rem; }
    .pc3-dots span { width: 10px; height: 10px; border-radius: 50%; }
    .pc3-d1 { background: var(--gng-success); } .pc3-d2 { background: var(--gng-warning); } .pc3-d3 { background: var(--gng-danger); } .pc3-d0 { background: var(--gng-border); }
    .pc3-bar { position: relative; height: 14px; background: var(--gng-bg); border: 1px solid var(--gng-border); border-radius: 7px; overflow: hidden; }
    .pc3-seg { position: absolute; top: 0; bottom: 0; }
    .pc3-seg--cons { background: var(--gng-text-muted); } .pc3-seg--del { background: var(--gng-success); }
    .pc3-seg--sch { background: repeating-linear-gradient(45deg, var(--gng-info), var(--gng-info) 4px, transparent 4px, transparent 7px); }
    .pc3-kits { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.6rem; }
    .pc3-kit { border: 1px solid var(--gng-border); border-radius: var(--gng-radius); padding: 0.55rem; background: var(--gng-surface); font-size: 0.78rem; }
    .pc3-kit--sub { border-color: var(--gng-warning); }
    .pc3-barcode { background: #fff; padding: 0.3rem; border-radius: 4px; border: 1px solid var(--gng-border); margin-top: 0.35rem; text-align: center; }
    .pc3-gauge { border: 1px solid var(--gng-border); border-radius: var(--gng-radius); padding: 0.55rem 0.65rem; background: var(--gng-surface); }
    .pc3-gauge__track { position: relative; height: 18px; background: var(--gng-bg); border-radius: 9px; border: 1px solid var(--gng-border); margin: 0.5rem 0 1rem; }
    .pc3-gauge__fill { position: absolute; top: 0; bottom: 0; right: 0; border-radius: 9px; background: var(--gng-info); }
    .pc3-gauge__mark { position: absolute; top: -4px; bottom: -4px; width: 2px; }
    .pc3-gauge__mark span { position: absolute; top: 22px; transform: translateX(50%); font-size: 0.62rem; white-space: nowrap; }
    .pc3-gauges { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 0.6rem; }
    .pc3-block { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .pc3-block > div { flex: 1; min-width: 9rem; }
  `],
})
export class FrmPc03Component implements OnInit {
  data: Pc03Bundle = { orders: [], checks: [], kits: [], excess: [], returns: [], lineSide: [], materials: [] };
  readiness: ReadinessRow[] = [];
  filtered: ReadinessRow[] = [];
  selected: ReadinessRow | null = null;
  selectedCheck: string | null = null;
  search = '';
  blockSummary: { code: string; blocks: string[]; warns: string[] }[] = [];

  chargeRows: ChargeRow[] = [];
  kitViews: KitView[] = [];
  orderKitViews: KitView[] = [];
  gauges: Gauge[] = [];
  gaugeScope: 'order' | 'all' = 'all';
  excessViews: { e: ExcessRow; pct: number; over: boolean; order: string }[] = [];
  unreturned: { order: string; m: WoMaterial; left: number }[] = [];

  readonly companyId = DEMO_COMPANY_ID;
  readonly CHECK_CODES = CHECK_CODES;
  readonly CHECK_TITLE = CHECK_TITLE;
  readonly CHECK_ICON = CHECK_ICON;
  readonly CHECK_STATUS = CHECK_STATUS;
  readonly KIT_STATUS = KIT_STATUS;
  readonly EXCESS_STATUS = EXCESS_STATUS;
  readonly FEEDING_POLICY = FEEDING_POLICY;
  readonly WO_STATUS = WO_STATUS;
  readonly faNum = faNum;
  readonly faInt = faInt;
  readonly faPct = faPct;
  readonly faDay = faDay;
  readonly faDateTime = faDateTime;
  readonly faDuration = faDuration;
  readonly woStatusTone = woStatusTone;
  loading = false;
  loadFailed = false;

  constructor(private pc03: FrmPc03Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.pc03.bundle(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.buildReadiness();
        this.kitViews = this.buildKitViews();
        this.excessViews = b.excess.map((e) => {
          const pct = e.plannedKit ? (100 * (e.plannedKit + e.quantity)) / e.plannedKit : 0;
          return { e, pct, over: e.maxPercent !== null && pct > e.maxPercent, order: this.orderNumber(e.workOrderId) };
        });
        /* مازاد برگشت‌نخورده‌ی دستورهای پایان‌یافته (F-PC-027) */
        const done = new Set(b.orders.filter((o) => o.statusCode >= 4 && o.statusCode !== 6).map((o) => o.id));
        this.unreturned = b.materials
          .filter((m) => done.has(m.workOrderId) && (m.actualKit ?? 0) - (m.consumed ?? 0) - (m.returned ?? 0) > 0.01)
          .map((m) => ({ order: this.orderNumber(m.workOrderId), m, left: (m.actualKit ?? 0) - (m.consumed ?? 0) - (m.returned ?? 0) }));
        this.loading = false;
        this.select(this.readiness.find((r) => r.worst === 3) ?? this.readiness[0] ?? null);
      },
      error: (err) => {
        console.warn('[FRM-PC-03] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  // ───────── آمادگی آزادسازی (F-PC-020) ─────────

  private buildReadiness(): void {
    const ids = new Set(this.data.checks.map((c) => c.workOrderId));
    this.readiness = this.data.orders
      .filter((o) => ids.has(o.id))
      .sort((a, b) => a.statusCode - b.statusCode || a.number.localeCompare(b.number))
      .map((o) => {
        const cells = CHECK_CODES.map((code) => ({ code, check: this.data.checks.find((c) => c.workOrderId === o.id && c.code === code) ?? null }));
        const worst = Math.max(...cells.map((c) => c.check?.statusCode ?? 0));
        const missing = cells.filter((c) => !c.check).map((c) => CHECK_TITLE[c.code]);
        const verdict = (worst === 3 ? 'مسدود' : worst === 2 ? 'با هشدار' : 'آماده') + (missing.length ? ` · بدون داده: ${missing.join('، ')}` : '');
        return { o, cells, worst, verdict };
      });
    this.blockSummary = CHECK_CODES.map((code) => ({
      code,
      blocks: this.readiness.filter((r) => r.cells.find((c) => c.code === code)?.check?.statusCode === 3).map((r) => r.o.number),
      warns: this.readiness.filter((r) => r.cells.find((c) => c.code === code)?.check?.statusCode === 2).map((r) => r.o.number),
    }));
    this.applyFilter();
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = this.readiness.filter((r) => !q || [r.o.number, r.o.name, r.o.productTitle, r.o.batchNumber].join(' ').toLowerCase().includes(q));
  }

  select(r: ReadinessRow | null, check: string | null = null): void {
    this.selected = r;
    this.selectedCheck = check;
    if (!r) return;
    this.chargeRows = this.buildCharge(r.o);
    this.orderKitViews = this.kitViews.filter((k) => k.k.workOrderId === r.o.id);
    this.buildGauges();
  }

  get selectedChecks(): ReleaseCheck[] {
    return this.selected ? this.data.checks.filter((c) => c.workOrderId === this.selected!.o.id).sort((a, b) => b.statusCode - a.statusCode) : [];
  }

  cellTip(c: { code: string; check: ReleaseCheck | null }): string {
    return c.check ? `${CHECK_TITLE[c.code]} — ${CHECK_STATUS[c.check.statusCode]}: ${c.check.detail}` : `${CHECK_TITLE[c.code]}: کنترلی برنگشت`;
  }

  // ───────── دستور شارژ و انتقال (F-PC-021، 022، 030) ─────────

  private buildCharge(o: WorkOrder): ChargeRow[] {
    const kits = this.data.kits.filter((k) => k.workOrderId === o.id);
    return this.data.materials
      .filter((m) => m.workOrderId === o.id && !m.quantumSatis && m.plannedKit > 0)
      .sort((a, b) => a.operationSeq - b.operationSeq)
      .map((m) => {
        const mk = kits.filter((k) => k.materialId === m.id).sort((a, b) => a.transferNo - b.transferNo);
        const scheduled = mk.filter((k) => k.statusCode === 1).reduce((s, k) => s + k.kitQuantity, 0);
        const delivered = mk.filter((k) => k.statusCode >= 2).reduce((s, k) => s + k.kitQuantity, 0) || (m.actualKit ?? 0);
        const consumed = m.consumed ?? 0;
        const policy = this.data.lineSide.find((l) => l.workOrderId === o.id && l.productCode === m.productCode)?.feedingPolicyCode ?? null;
        const scale = Math.max(m.plannedKit, delivered + scheduled, 1e-9);
        return {
          m, kits: mk, planned: m.plannedKit, scheduled, delivered, consumed,
          policy: policy ? FEEDING_POLICY[policy] : '—',
          consumedPct: (100 * Math.min(consumed, delivered)) / scale,
          deliveredPct: (100 * Math.max(0, delivered - consumed)) / scale,
          scheduledPct: (100 * scheduled) / scale,
        };
      });
  }

  // ───────── تخصیص بچ، FEFO، عیار، جایگزینی (F-PC-024، 025، 029) ─────────

  private buildKitViews(): KitView[] {
    return this.data.kits.map((k) => {
      const days = k.expireDate ? Math.floor((new Date(k.expireDate).getTime() - SHOP_NOW.getTime()) / 86400000) : null;
      /* FEFO: آیا بچی از همان قلم با انقضای زودتر، دیرتر از این انتقال شارژ شده (یعنی موجود بوده)؟ */
      const earlier = this.data.kits.find(
        (x) => x !== k && x.productCode === k.productCode && x.batch !== k.batch && x.expireDate && k.expireDate && x.expireDate < k.expireDate &&
          x.effectiveDate && k.effectiveDate && x.effectiveDate > k.effectiveDate && x.workOrderId !== k.workOrderId &&
          new Date(x.effectiveDate).getTime() - new Date(k.effectiveDate).getTime() < 86400000
      );
      const m = this.data.materials.find((x) => x.id === k.materialId);
      const code = `${this.orderNumber(k.workOrderId)}-${k.productCode}-${k.transferNo}`;
      const bc = code39Bars(code, 2.2);
      return {
        k,
        daysToExpiry: days,
        expiryTone: days === null ? 'secondary' : days < 30 ? 'danger' : days < 120 ? 'warning' : 'success',
        fefo: earlier ? `بچ ${earlier.batch} با انقضای زودتر (${faDay(earlier.expireDate)}) بعداً در ${this.orderNumber(earlier.workOrderId)} مصرف شد — انحراف از FEFO` : '',
        potencyDelta: k.kitQuantity - k.activeQuantity,
        substitution: !!m?.substitutedTitle || k.description.includes('جایگزین'),
        bars: bc.bars,
        barTotal: bc.total,
        barText: code,
      };
    });
  }

  get fefoIssues(): KitView[] {
    return this.kitViews.filter((k) => k.fefo);
  }

  get substitutions(): { k: KitView; m: WoMaterial | undefined }[] {
    return this.kitViews.filter((k) => k.substitution).map((k) => ({ k, m: this.data.materials.find((x) => x.id === k.k.materialId) }));
  }

  // ───────── موجودی پای کار (F-PC-023، 028) ─────────

  private buildGauges(): void {
    const rows = this.gaugeScope === 'order' && this.selected ? this.data.lineSide.filter((l) => l.workOrderId === this.selected!.o.id) : this.data.lineSide;
    this.gauges = rows.map((l) => {
      const marks = [l.minStock, l.maxStock, l.reorderPoint].filter((x): x is number => x !== null);
      const scale = Math.max(l.onLine, Math.max(0, l.remainingNeed), ...marks, 1e-9) * 1.1;
      const pct = (v: number | null) => (v === null ? null : Math.min(100, (100 * v) / scale));
      const first = this.data.kits.filter((k) => k.workOrderId === l.workOrderId && k.productCode === l.productCode && k.effectiveDate && k.statusCode >= 2)
        .map((k) => new Date(k.effectiveDate as string).getTime()).sort()[0];
      const hours = first ? (SHOP_NOW.getTime() - first) / 3600000 : 0;
      const rate = hours > 0.5 && l.consumed > 0 ? l.consumed / hours : 0;
      const runOutH = rate > 0 && l.onLine > 0 ? l.onLine / rate : null;
      let signal = 'کافی';
      let signalTone: Tone = 'success';
      if (l.remainingNeed > l.onLine + 0.01) { signal = `نیاز ${faNum(l.remainingNeed - l.onLine)} ${l.unit} انتقال بعدی`; signalTone = 'warning'; }
      if (l.reorderPoint !== null && l.onLine <= l.reorderPoint && l.remainingNeed > 0) { signal = 'فراخوان کششی — زیر نقطه‌ی سفارش'; signalTone = 'danger'; }
      if (l.remainingNeed < -0.01) { signal = `مصرف بیش از برنامه (${faNum(-l.remainingNeed)})`; signalTone = 'danger'; }
      const policyIssue = l.minStock !== null && l.maxStock !== null && l.minStock > l.maxStock
        ? `سیاست ME-06 ناسازگار: حداقل ${faNum(l.minStock)} > حداکثر ${faNum(l.maxStock)}${l.reorderPoint !== null && l.reorderPoint < l.minStock ? ` و نقطه‌ی سفارش ${faNum(l.reorderPoint)} زیر حداقل` : ''}` : '';
      return { l, scale, onPct: pct(l.onLine) ?? 0, needPct: pct(Math.max(0, l.remainingNeed)) ?? 0, minPct: pct(l.minStock), maxPct: pct(l.maxStock), ropPct: pct(l.reorderPoint), runOutH, signal, signalTone, policyIssue };
    });
  }

  setGaugeScope(s: 'order' | 'all'): void {
    this.gaugeScope = s;
    this.buildGauges();
  }

  // ───────── نمایش ─────────

  orderNumber(id: number): string {
    return this.data.orders.find((o) => o.id === id)?.number ?? `#${id}`;
  }

  verdictTone(w: number): Tone {
    return w === 3 ? 'danger' : w === 2 ? 'warning' : 'success';
  }

  excessTone(c: number): Tone {
    return c === 1 ? 'warning' : c === 2 ? 'success' : 'danger';
  }

  get contextLabel(): string {
    return this.selected ? `${this.selected.o.number} — ${this.selected.o.name}` : 'آزادسازی و شارژ';
  }

  private get problems(): { tone: 'danger' | 'warning'; text: string }[] {
    const out: { tone: 'danger' | 'warning'; text: string }[] = [];
    for (const r of this.readiness)
      for (const c of r.cells.filter((x) => x.check && x.check.statusCode >= 2))
        out.push({ tone: c.check!.statusCode === 3 ? 'danger' : 'warning', text: `${r.o.number} ${CHECK_TITLE[c.code]}: ${c.check!.detail}` });
    for (const x of this.excessViews.filter((e) => e.over && e.e.statusCode === 1))
      out.push({ tone: 'danger', text: `${x.order}: مازاد ${x.e.product} ${faNum(x.e.quantity)} ${x.e.unit} = ${faPct(x.pct)} بیش از سقف ${faPct(x.e.maxPercent)} و منتظر تأیید` });
    for (const u of this.unreturned) out.push({ tone: 'warning', text: `${u.order}: ${faNum(u.left)} ${u.m.unit} ${u.m.productTitle} پای کار مانده و برگشت نخورده` });
    for (const k of this.fefoIssues) out.push({ tone: 'warning', text: `${this.orderNumber(k.k.workOrderId)} ${k.k.productTitle} بچ ${k.k.batch}: ${k.fefo}` });
    const pol = [...new Set(this.data.lineSide.filter((l) => l.minStock !== null && l.maxStock !== null && l.minStock > l.maxStock).map((l) => l.group))];
    if (pol.length) out.push({ tone: 'warning', text: `سیاست پای کار «${pol.join('، ')}»: حداقل از حداکثر بیشتر است` });
    return out;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const p = this.problems;
    return p.some((x) => x.tone === 'danger') ? 'danger' : p.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc03_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال بررسی پیش‌شرط‌ها و موجودی پای کار…';
    const p = this.problems.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'danger' ? -1 : 1));
    return p.length ? p.map((x) => x.text).join(' · ') : 'همه‌ی دستورها آماده‌ی آزادسازی‌اند و پای کار کمبودی ندارد.';
  }

  get counts(): { ready: number; warn: number; block: number } {
    return {
      ready: this.readiness.filter((r) => r.worst <= 1).length,
      warn: this.readiness.filter((r) => r.worst === 2).length,
      block: this.readiness.filter((r) => r.worst === 3).length,
    };
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
