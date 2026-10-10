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
import { CONSUMPTION_MODE, SHOP_NOW, STOCK_QC, WO_STATUS, WO_TYPE, faDateTime, faDay, faInt, faNum, faPct, faTime } from './pc-shared';
import { CONTROL, ConsRow, Flag, MODE_TONE, POLICY, Pc06Bundle, RecoveredRow, SHORTAGE, VarRow, WoHead, WoMaterialRow } from './frm-pc-06.data';
import { FrmPc06Service } from './frm-pc-06.service';

interface WoItem { id: number; number: string; name: string; typeCode: number | null; statusCode: number | null; flags: number; }
interface Bullet { v: VarRow; pct: number | null; lo: number; hi: number; marker: number; bandRight: number; bandWidth: number; tone: string; note: string; }
interface MixGroup { woId: number; seq: number; product: string; unit: string; virgin: number; recovered: number; theoretical: number; batches: string; cap: number | null; }
interface Eligibility { r: RecoveredRow; checks: { label: string; ok: boolean | null }[]; eligible: boolean; dataIssue: string; }
interface Chain { original: ConsRow; reversal: ConsRow; repost: ConsRow | undefined; }

/**
 * FRM-PC-06 — «مصرف مواد»: دفتر مصرف دستی/Backflush با زوج‌های سند معکوس، انحراف مصرف در برابر استاندارد
 * تولیدشده با باند حداقل/حداکثر ساختار، تصحیح عیار ماده‌ی مؤثره، ترکیب ماده‌ی نو و بازیابی‌شده با سقف
 * درصد مجاز و صلاحیت بچ بازیابی، و مصرف مواد امانی مشتری به‌صورت جدا.
 *
 * فاز اول (فقط‌خواندنی): F-PC-044 تا 055 (همه M) — نمایش، کنترل‌ها و ماشین‌حساب‌های زنده.
 * هنوز پیاده نشده: ثبت مصرف دستی و انتخاب بچ، اجرای Backflush و سند معکوس، رفع صف کسری، صدور سند انبار.
 */
@Component({
  selector: 'gng-frm-pc-06',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, DropdownModule, InputTextModule, SliderModule, TabViewModule, TableModule, TagModule, TooltipModule,
    OperationalFormLayoutComponent, DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pc-06.component.html',
  styles: [`
    .chips { display: flex; gap: .4rem; flex-wrap: wrap; align-items: center; margin: .4rem 0 .7rem; }
    .chip { border: 1px solid var(--gng-border); border-radius: 999px; padding: .15rem .7rem; font-size: .76rem; cursor: pointer; background: var(--gng-surface); }
    .chip.on { background: var(--gng-primary); color: #fff; border-color: var(--gng-primary); }
    .bullet { position: relative; height: 1.1rem; background: var(--gng-bg); border: 1px solid var(--gng-border); border-radius: 4px; min-width: 12rem; }
    .bullet .band { position: absolute; top: 0; bottom: 0; background: rgba(46,158,99,.25); }
    .bullet .std { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--gng-text); }
    .bullet .mk { position: absolute; top: 2px; width: .8rem; height: .8rem; border-radius: 50%; transform: translateX(50%); border: 2px solid #fff; }
    .rev-chain { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; font-size: .8rem; }
    .rev-chain .box { border: 1px solid var(--gng-border); border-radius: 6px; padding: .3rem .6rem; background: var(--gng-surface); }
    .rev-chain .box.neg { border-color: var(--gng-danger); color: var(--gng-danger); }
    .formula { font-size: 1.25rem; font-weight: 700; direction: ltr; text-align: center; padding: .9rem; border-radius: var(--gng-radius); background: var(--gng-bg); font-variant-numeric: tabular-nums; }
    .gauge { position: relative; height: 1.6rem; border-radius: 6px; overflow: hidden; display: flex; border: 1px solid var(--gng-border); }
    .gauge .cap { position: absolute; top: -4px; bottom: -4px; width: 3px; background: var(--gng-danger); }
    .own-split { display: flex; height: 1.4rem; border-radius: 6px; overflow: hidden; border: 1px solid var(--gng-border); }
    .clickable { cursor: pointer; }
    .row-bad td { background: rgba(235,87,87,.07); }
  `],
})
export class FrmPc06Component implements OnInit {
  data: Pc06Bundle | null = null;
  heads: WoHead[] = [];
  materials: WoMaterialRow[] = [];
  orders: WoItem[] = [];
  woId: number | null = null;
  flags: Flag[] = [];

  modeFilter = 0;
  search = '';
  chains: Chain[] = [];
  mixedModes: { product: string; modes: number[]; policy: number | null; control: number | null; mismatch: string }[] = [];
  docs: { doc: string; pattern: string; rows: number; reversal: boolean; customer: boolean }[] = [];
  shortages: ConsRow[] = [];

  bullets: Bullet[] = [];
  reportDeviations: { key: string; product: string; report: string; consumed: number; expected: number; pct: number; lo: number | null; hi: number | null; out: boolean; unit: string; sub: boolean }[] = [];

  aiRows: ConsRow[] = [];
  aiOptions: { label: string; value: number }[] = [];
  aiId: number | null = null;
  potency = 100;
  aiChecks: { c: ConsRow; expected: number | null; potency: number | null; potencySource: string; status: string; tone: 'success' | 'warning' | 'danger' }[] = [];

  mixGroups: MixGroup[] = [];
  mix: MixGroup | null = null;
  mixRecovered = 0;
  eligibility: Eligibility[] = [];

  customerRows: ConsRow[] = [];
  customerVar: VarRow[] = [];
  ownRows: ConsRow[] = [];

  readonly CONSUMPTION_MODE = CONSUMPTION_MODE;
  readonly MODE_TONE = MODE_TONE;
  readonly POLICY = POLICY;
  readonly CONTROL = CONTROL;
  readonly SHORTAGE = SHORTAGE;
  readonly STOCK_QC = STOCK_QC;
  readonly WO_STATUS = WO_STATUS;
  readonly WO_TYPE = WO_TYPE;
  readonly faNum = faNum;
  readonly faInt = faInt;
  readonly faPct = faPct;
  readonly faDay = faDay;
  readonly faTime = faTime;
  readonly faDateTime = faDateTime;
  readonly companyId = DEMO_COMPANY_ID;
  readonly modeChips = [{ code: 0, label: 'همه' }, { code: 1, label: 'دستی' }, { code: 2, label: 'Backflush عملیات' }, { code: 3, label: 'Backflush رسید' }];
  loading = false;
  loadFailed = false;

  constructor(private pc06: FrmPc06Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.pc06.bundle(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.rebuild();
        this.selectWo(this.orders.find((o) => o.number.endsWith('0501'))?.id ?? this.orders[0]?.id ?? null);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-PC-06] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
    this.pc06.context(this.companyId).subscribe({
      next: (c) => {
        this.heads = c.orders;
        this.materials = c.materials;
        if (this.data) {
          this.rebuild();
          this.selectWo(this.woId);
        }
      },
      error: () => undefined,
    });
  }

  private rebuild(): void {
    if (!this.data) return;
    /* اول فهرست دستورها (شماره‌ها) تا متن پرچم‌ها شماره‌ی دستور داشته باشد، نه شناسه */
    const ids = [...new Set([...this.data.consumption.map((c) => c.woId), ...this.data.variance.map((v) => v.woId)])];
    this.orders = ids.map((id) => {
      const h = this.heads.find((x) => x.id === id);
      const doc = this.data!.consumption.find((c) => c.woId === id)?.doc ?? '';
      const short = /-(\d{4})-/.exec(doc)?.[1];
      return { id, number: h?.number ?? (short ? `WO-1405-${short}` : `#${id}`), name: h?.name ?? '', typeCode: h?.typeCode ?? null, statusCode: h?.statusCode ?? null, flags: 0 };
    });
    this.flags = this.computeFlags();
    this.eligibility = this.data.recovered.map((r) => this.eligible(r));
    for (const o of this.orders) o.flags = this.flags.filter((f) => f.woId === o.id).length;
    this.orders.sort((a, b) => b.flags - a.flags || b.number.localeCompare(a.number));
  }

  woNo(id: number): string {
    return this.orders.find((o) => o.id === id)?.number ?? `#${id}`;
  }

  // ───────── انتخاب دستور ─────────

  selectWo(id: number | null): void {
    this.woId = id;
    if (!this.data || id === null) return;
    const d = this.data;
    const rows = d.consumption.filter((c) => c.woId === id);
    this.chains = rows.filter((r) => r.isReversal).map((rev) => {
      const original = d.consumption.find((c) => c.id === rev.reversedId) ?? rev;
      const repost = rows.find((c) => !c.isReversal && c.id > rev.id && c.productId === original.productId && c.seq === original.seq);
      return { original, reversal: rev, repost };
    });
    const vars = d.variance.filter((v) => v.woId === id);
    const byProduct = new Map<string, ConsRow[]>();
    for (const r of rows.filter((x) => !x.isReversal)) byProduct.set(r.productCode, [...(byProduct.get(r.productCode) ?? []), r]);
    this.mixedModes = [...byProduct.entries()].map(([code, list]) => {
      const v = vars.find((x) => x.product.startsWith(code));
      const modes = [...new Set(list.map((x) => x.modeCode))].sort();
      const policy = v?.policyCode ?? null;
      const control = v?.controlCode ?? null;
      let mismatch = '';
      if (v?.active && modes.some((m) => m !== 1)) mismatch = 'ماده‌ی مؤثره‌ی عیارمحور باید دستی و با تصحیح عیار ثبت شود، نه Backflush';
      else if (policy && policy !== 4 && modes.some((m) => m !== policy)) mismatch = `سیاست «${POLICY[policy]}» است ولی «${modes.map((m) => CONSUMPTION_MODE[m]).join('، ')}» ثبت شده`;
      return { product: `${code} — ${list[0].product}`, modes, policy, control, mismatch };
    });
    const docMap = new Map<string, { doc: string; pattern: string; rows: number; reversal: boolean; customer: boolean }>();
    for (const r of rows) {
      const x = docMap.get(r.doc) ?? { doc: r.doc, pattern: r.docPattern, rows: 0, reversal: r.isReversal, customer: r.customer };
      x.rows++;
      docMap.set(r.doc, x);
    }
    this.docs = [...docMap.values()];
    this.shortages = d.consumption.filter((c) => c.shortageCode > 1);
    this.buildVariance(id);
    this.buildPotency(id);
    this.buildMix(id);
    this.customerRows = rows.filter((r) => r.customer);
    this.ownRows = rows.filter((r) => !r.customer && !r.isReversal);
    this.customerVar = vars.filter((v) => v.customer);
  }

  get wo(): WoItem | undefined {
    return this.orders.find((o) => o.id === this.woId);
  }

  get ledger(): ConsRow[] {
    const q = this.search.trim().toLowerCase();
    return (this.data?.consumption ?? [])
      .filter((c) => c.woId === this.woId)
      .filter((c) => !this.modeFilter || c.modeCode === this.modeFilter)
      .filter((c) => !q || `${c.productCode} ${c.product} ${c.batch} ${c.doc} ${c.report}`.toLowerCase().includes(q))
      .sort((a, b) => a.seq - b.seq || a.id - b.id);
  }

  modeCount(code: number): number {
    return (this.data?.consumption ?? []).filter((c) => c.woId === this.woId && (!code || c.modeCode === code)).length;
  }

  reversedBy(c: ConsRow): ConsRow | undefined {
    return this.data?.consumption.find((x) => x.reversedId === c.id);
  }

  // ───────── انحراف مصرف (F-PC-050) ─────────

  private buildVariance(id: number): void {
    const d = this.data!;
    this.bullets = d.variance.filter((v) => v.woId === id).map((v) => {
      const pct = v.standard > 0 ? (v.actual / v.standard) * 100 : null;
      const lo = Math.min(80, v.minPct ?? 100, pct ?? 100);
      const hi = Math.max(120, v.maxPct ?? 100, pct ?? 100);
      const pos = (p: number) => ((p - lo) / (hi - lo)) * 100;
      const out = pct !== null && ((v.minPct !== null && pct < v.minPct) || (v.maxPct !== null && pct > v.maxPct));
      const sub = d.consumption.find((c) => c.woId === v.woId && c.substitute && v.product.startsWith(c.productCode));
      let note = '';
      if (v.standard > 0 && !v.actual) note = 'مصرف ثبت نشده';
      else if (out && sub) note = `جایگزین ${sub.substitute} — ${sub.description}`;
      else if (out) note = `خارج از باند ${faNum(v.minPct)}–${faNum(v.maxPct)}٪ (${CONTROL[v.controlCode ?? 1] ?? 'بدون کنترل'})`;
      return {
        v, pct, lo, hi, marker: pos(pct ?? 100),
        bandRight: pos(v.minPct ?? 100), bandWidth: v.minPct !== null && v.maxPct !== null ? pos(v.maxPct) - pos(v.minPct) : 0,
        tone: pct === null ? 'var(--gng-text-muted)' : out || note === 'مصرف ثبت نشده' ? (sub ? 'var(--gng-warning)' : 'var(--gng-danger)') : 'var(--gng-success)',
        note,
      };
    });
    this.reportDeviations = this.groupDeviations().filter((g) => g.woId === id).map((g) => g.row);
  }

  /** انحراف هر ثبت (گزارش) از مقدار نظری؛ ردیف‌های تقسیم‌شده (نو + بازیابی) با هم جمع می‌شوند */
  private groupDeviations(): { woId: number; row: FrmPc06Component['reportDeviations'][number] }[] {
    const d = this.data!;
    const groups = new Map<string, ConsRow[]>();
    for (const c of d.consumption.filter((x) => !x.isReversal && x.theoretical)) {
      const k = `${c.woId}|${c.seq}|${c.productCode}|${c.report || c.doc.replace(/-E\d$/, '')}`;
      groups.set(k, [...(groups.get(k) ?? []), c]);
    }
    return [...groups.entries()].map(([key, list]) => {
      const f = list[0];
      const consumed = list.reduce((s, x) => s + x.consumed, 0);
      const theo = Math.max(...list.map((x) => x.theoretical ?? 0));
      const expected = f.potency && f.group === 'مواد مؤثره' ? (theo * 100) / f.potency : theo;
      const v = d.variance.find((x) => x.woId === f.woId && x.seq === f.seq && x.product.startsWith(f.productCode));
      const pct = (consumed / expected) * 100;
      const out = (v?.minPct != null && pct < v.minPct - 0.05) || (v?.maxPct != null && pct > v.maxPct + 0.05);
      return { woId: f.woId, row: { key, product: `${f.productCode} ${f.product}`, report: f.report || f.doc, consumed, expected, pct, lo: v?.minPct ?? null, hi: v?.maxPct ?? null, out, unit: f.unit, sub: list.some((x) => !!x.substitute) } };
    });
  }

  // ───────── تصحیح عیار (F-PC-051) ─────────

  private batchPotency(batch: string): number | null {
    return this.data?.consumption.find((c) => c.batch === batch && c.potency)?.potency ?? null;
  }

  private buildPotency(id: number): void {
    const d = this.data!;
    this.aiRows = d.consumption.filter((c) => c.group === 'مواد مؤثره' && !c.isReversal);
    this.aiOptions = this.aiRows.map((c) => ({ label: `${this.woNo(c.woId)} · ${c.doc} · ${faNum(c.theoretical)} ${c.unit}`, value: c.id }));
    this.aiChecks = this.aiRows.map((c) => {
      const pot = c.potency ?? this.batchPotency(c.batch);
      const expected = c.theoretical && pot ? (c.theoretical * 100) / pot : null;
      const diff = expected !== null ? c.consumed - expected : 0;
      let status = 'مطابق تصحیح عیار';
      let tone: 'success' | 'warning' | 'danger' = 'success';
      if (c.modeCode !== 1) { status = `Backflush بدون تصحیح عیار — کسری ${faNum(-diff, 2)} ${c.unit}`; tone = 'danger'; }
      else if (expected !== null && Math.abs(diff) > 0.01) { status = `تصحیح اعمال نشده (${faNum(diff, 2)} ${c.unit})`; tone = 'warning'; }
      return { c, expected, potency: pot, potencySource: c.potency ? 'بچ ثبت مصرف' : pot ? `از ثبت دیگر بچ ${c.batch}` : '—', status, tone };
    });
    const pick = this.aiRows.find((c) => c.woId === id && c.potency) ?? this.aiRows.find((c) => c.woId === id) ?? this.aiRows.find((c) => c.potency) ?? this.aiRows[0];
    this.pickAi(pick?.id ?? null);
  }

  pickAi(id: number | null): void {
    this.aiId = id;
    const c = this.ai;
    this.potency = c ? c.potency ?? this.batchPotency(c.batch) ?? 100 : 100;
  }

  get ai(): ConsRow | undefined {
    return this.aiRows.find((c) => c.id === this.aiId);
  }

  get corrected(): number {
    const c = this.ai;
    return c && c.theoretical ? (c.theoretical * 100) / this.potency : 0;
  }

  // ───────── بازیابی‌شده و ترکیب (F-PC-053، 054) ─────────

  private buildMix(id: number): void {
    const d = this.data!;
    const groups = new Map<string, ConsRow[]>();
    for (const c of d.consumption.filter((x) => !x.isReversal)) groups.set(`${c.woId}|${c.seq}|${c.productCode}`, [...(groups.get(`${c.woId}|${c.seq}|${c.productCode}`) ?? []), c]);
    this.mixGroups = [...groups.values()].filter((l) => l.some((c) => c.recovered)).map((l) => {
      const rec = l.filter((c) => c.recovered);
      const caps = rec.map((c) => d.recovered.find((r) => r.batch === c.batch)?.maxMix).filter((x): x is number => x !== null && x !== undefined);
      return {
        woId: l[0].woId, seq: l[0].seq, product: `${l[0].productCode} ${l[0].product}`, unit: l[0].unit,
        virgin: l.filter((c) => !c.recovered).reduce((s, c) => s + c.consumed, 0), recovered: rec.reduce((s, c) => s + c.consumed, 0),
        theoretical: Math.max(...l.map((c) => c.theoretical ?? 0)), batches: rec.map((c) => c.batch).join('، '), cap: caps.length ? Math.min(...caps) : null,
      };
    });
    this.mix = this.mixGroups.find((g) => g.woId === id) ?? this.mixGroups[0] ?? null;
    this.mixRecovered = this.mix?.recovered ?? 0;
  }

  get mixTotal(): number {
    return this.mix ? Math.max(this.mix.theoretical, this.mix.virgin + this.mix.recovered) : 0;
  }

  get mixPct(): number {
    return this.mixTotal ? (this.mixRecovered / this.mixTotal) * 100 : 0;
  }

  private eligible(r: RecoveredRow): Eligibility {
    const now = SHOP_NOW.getTime();
    const checks = [
      { label: `خلوص ${r.purity === null ? 'نامشخص' : faPct(r.purity)} ≥ ${faPct(r.minPurity)}`, ok: r.purity === null || r.minPurity === null ? null : r.purity >= r.minPurity },
      { label: `چرخه ${r.cycle === null ? '—' : faInt(r.cycle)} از ${faInt(r.maxCycles)}`, ok: r.cycle === null || r.maxCycles === null ? null : r.cycle < r.maxCycles },
      { label: `اعتبار تا ${faDay(r.expire)}`, ok: r.expire ? new Date(r.expire).getTime() > now : null },
      { label: `QC: ${STOCK_QC[r.qcCode] ?? '—'}`, ok: r.qcCode === 1 },
    ];
    const used = this.data?.consumption.filter((c) => c.batch.includes(r.batch)) ?? [];
    const dataIssue = r.purity === null && r.cycle === null
      ? `بچ ${r.batch} بازیابی‌شده نیست (خلوص و چرخه ندارد) ولی در فهرست بازیابی آمده${used.some((c) => c.customer) ? ' — این بچ امانی مشتری است' : ''}`
      : '';
    return { r, checks, eligible: checks.every((c) => c.ok !== false) && !dataIssue, dataIssue };
  }

  // ───────── پرچم‌ها ─────────

  private computeFlags(): Flag[] {
    const d = this.data!;
    const out: Flag[] = [];
    const no = (id: number) => this.woNo(id);
    for (const g of this.groupDeviations().filter((x) => x.row.out)) out.push({ woId: g.woId, tone: g.row.sub ? 'warning' : 'danger', text: `${no(g.woId)}: ${g.row.product} در ${g.row.report} ${faPct(g.row.pct - 100, 1)} انحراف (باند ${faNum(g.row.lo)}–${faNum(g.row.hi)}٪)${g.row.sub ? ' — با جایگزین' : ''}` });
    for (const c of d.consumption.filter((x) => x.shortageCode > 1)) out.push({ woId: c.woId, tone: 'danger', text: `${no(c.woId)}: کسری ${faInt(c.shortage)} ${c.product} — ${SHORTAGE[c.shortageCode]}` });
    const bfAi = d.consumption.filter((c) => c.group === 'مواد مؤثره' && c.modeCode !== 1 && !c.isReversal);
    for (const id of new Set(bfAi.map((c) => c.woId))) out.push({ woId: id, tone: 'danger', text: `${no(id)}: ماده‌ی مؤثره (${bfAi.find((c) => c.woId === id)!.product}) با Backflush و بدون تصحیح عیار مصرف شده` });
    for (const c of d.consumption.filter((x) => x.group === 'مواد مؤثره' && x.modeCode === 1 && x.potency && x.potency < 100 && x.theoretical && Math.abs(x.consumed - x.theoretical) < 0.001))
      out.push({ woId: c.woId, tone: 'warning', text: `${no(c.woId)}: عیار ${faPct(c.potency)} ثبت شده ولی مصرف همان مقدار نظری است` });
    for (const v of d.variance.filter((x) => x.standard > 0 && !x.actual)) out.push({ woId: v.woId, tone: 'warning', text: `${no(v.woId)}: ${v.product} مصرف ثبت‌نشده (استاندارد ${faNum(v.standard)} ${v.unit})` });
    for (const m of this.materials.filter((x) => x.quantumSatis && x.consumed === null)) {
      const h = this.heads.find((x) => x.id === m.woId);
      if (h && h.statusCode >= 4) out.push({ woId: m.woId, tone: 'danger', text: `${h.number}: ${m.product} (q.s.) در دستور تکمیل‌شده مصرف ثبت نکرده` });
    }
    for (const c of d.consumption.filter((x) => x.recovered)) {
      const r = d.recovered.find((x) => x.batch === c.batch);
      if (r && !this.eligible(r).eligible) out.push({ woId: c.woId, tone: 'danger', text: `${no(c.woId)}: بچ بازیابی ${c.batch} واجد شرایط نیست` });
    }
    return out;
  }

  get woFlags(): Flag[] {
    return this.flags.filter((f) => f.woId === this.woId);
  }

  get contextLabel(): string {
    return this.wo ? `${this.wo.number}${this.wo.name ? ' — ' + this.wo.name : ''}` : 'مصرف مواد';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    return this.flags.some((f) => f.tone === 'danger') ? 'danger' : this.flags.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc06_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن…';
    const dz = this.flags.filter((f) => f.tone === 'danger');
    return this.flags.length ? `${faInt(this.flags.length)} مورد: ` + [...dz, ...this.flags.filter((f) => f.tone !== 'danger')].slice(0, 6).map((f) => f.text).join('؛ ') + '.' : 'مصرف همه‌ی دستورها در باند مجاز است.';
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
