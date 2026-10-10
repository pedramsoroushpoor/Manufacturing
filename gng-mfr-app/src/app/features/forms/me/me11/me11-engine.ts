import {
  CATEGORIES, CAT_OWNER, Contractor, Defect, Elig, FORM_OWNER, Me11Bundle, ORDER_TYPE, Op, Report, Resource, Routing, Subcontract, Tone, Usage,
} from '../frm-me-11.data';

/**
 * موتور محاسبه‌ی FRM-ME-11 — بدون وابستگی به Angular. همه‌ی فضاها از همین کلاس مشتق می‌شوند:
 * سلامت روش (از کاتالوگ نقص‌ها)، کالیبراسیون استاندارد با اجرا، شبیه‌ساز گلوگاه، نوارهای پوشش نسخه، ریسک بیرونی و بدهی فنی.
 */

const fa = (v: number, d = 0): string => v.toLocaleString('fa-IR', { maximumFractionDigits: d });
const median = (xs: number[]): number => {
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
export const PRODUCT_COLORS = ['#4fc3f7', '#ffb74d', '#81c784', '#ba68c8', '#f06292', '#4db6ac', '#fff176', '#90a4ae'];
const PENALTY: Record<number, number> = { 3: 25, 2: 10, 1: 3 };
const SEV_WEIGHT: Record<number, number> = { 3: 9, 2: 4, 1: 1 };

// ───────── شکل خروجی‌ها ─────────

export interface Check { cat: string; label: string; form: string; owner: string; defects: Defect[]; inherited: Defect[]; worst: number; penalty: number }
export interface Health { routing: Routing; score: number; base: number; tone: Tone; checks: Check[]; failing: number; defectCount: number; critical: number; opSev: Record<number, number> }

export interface Sample { perUnit: number; ratio: number; wo: string; number: string; minutes: number; units: number; adjusted: boolean; pos: number }
export interface UsageCmp { cap: string; unit: string; std: number | null; actual: number | null; ratio: number | null; note: string }
export interface CalRow {
  roId: number; routingId: number; routing: string; seq: number; title: string; resource: string; std: number; setup: number; batch: number; n: number;
  samples: Sample[]; min: number; med: number; max: number; wmean: number; bias: number; spread: number; confidence: 'high' | 'medium' | 'low'; systematic: boolean;
  w: number; suggested: number; deltaBatchMin: number; yieldStd: number | null; yieldAct: number | null; usage: UsageCmp[];
  stdPos: number; medPos: number; sugPos: number; minPos: number; maxPos: number; hasStd: boolean;
}
export interface CalResult { rows: CalRow[]; excludedZero: Report[]; excludedRework: number; excludedUniform: number; uniform: { wo: string; minutes: number; count: number }[]; axisMax: number }

export interface SimParams {
  mix: Record<number, number>; routeOf: Record<number, number>; horizon: number; eff: number; qtyMult: number;
  extraShift: Record<string, boolean>; extraUnit: Record<string, number>; altShare: Record<number, number>; calibrated: Record<number, number> | null;
}
export interface LoadSeg { productId: number; min: number; color: string; pct: number; left: number; w: number }
export interface LoadBar {
  key: string; title: string; line: string; reqMin: number; capMin: number; util: number; utilLabel: string; segs: LoadSeg[]; flags: string[]; tone: Tone;
  bottleneck: boolean; width: number; capWidth: number; ops: { label: string; min: number }[];
}
export interface SimResult {
  bars: LoadBar[]; unassigned: { label: string; min: number; why: string }[]; external: { label: string; qty: number; lead: string }[]; maxUtil: number;
  bottleneck: LoadBar | null; throughput: number; narrative: string; scaleMax: number;
}

export interface Band { from: number; to: number; code: string; tone: 'win' | 'gap' | 'tie'; left: number; width: number; label: string }
export interface CovCell {
  productId: number; lineId: number; orderType: number; eligible: Elig[]; rejected: Elig[]; status: 'gap' | 'one' | 'many' | 'conflict'; label: string; tone: Tone;
  demand: { number: string; qty: number; covered: boolean; winner: string }[];
}

export interface ContractorRisk {
  c: Contractor; score: number; tone: Tone; reasons: string[]; ops: { label: string; priority: number; fee: number | null; regFee: number | null; hasCap: boolean }[];
  live: { wo: string; delay: number; wastePct: number; allowed: number | null; progress: number }[];
}
export interface OutsourcedOp { op: Op; routing: Routing; qualified: number; total: number; singleSource: boolean; cheapest: Subcontract | null; tone: Tone }
export interface CostRow { routing: Routing; ops: number; withActivities: number; actMin: number; vaMin: number; vaPct: number | null; noDriver: number; shareIssues: number }

export interface DebtItem { d: Defect; impact: number; routing: string; owner: string; factor: number; reach: number; product: string }
export interface DebtGroup { key: string; title: string; items: DebtItem[]; impact: number; pct: number }

export class Me11Engine {
  readonly routingById = new Map<number, Routing>();
  readonly opById = new Map<number, Op>();
  readonly opsByRouting = new Map<number, Op[]>();
  readonly defectsByRouting = new Map<number, Defect[]>();
  readonly libByOp = new Map<number, Defect[]>();
  readonly resByKey = new Map<string, Resource>();
  readonly altsByRo = new Map<number, Me11Bundle['alts']>();
  readonly subsByRo = new Map<number, Subcontract[]>();

  constructor(readonly b: Me11Bundle) {
    for (const r of b.routings) this.routingById.set(r.id, r);
    for (const o of b.ops) {
      this.opById.set(o.id, o);
      this.opsByRouting.set(o.routingId, [...(this.opsByRouting.get(o.routingId) ?? []), o]);
    }
    for (const d of b.defects) {
      if (d.routingId !== null) this.defectsByRouting.set(d.routingId, [...(this.defectsByRouting.get(d.routingId) ?? []), d]);
      else if (d.cat === 'LIB' && d.libOpId !== null) this.libByOp.set(d.libOpId, [...(this.libByOp.get(d.libOpId) ?? []), d]);
    }
    for (const r of b.resources) this.resByKey.set(r.key, r);
    for (const a of b.alts) this.altsByRo.set(a.roId, [...(this.altsByRo.get(a.roId) ?? []), a]);
    for (const s of b.subcontracts) this.subsByRo.set(s.roId, [...(this.subsByRo.get(s.roId) ?? []), s]);
  }

  routingLabel(id: number | null): string {
    const r = id === null ? undefined : this.routingById.get(id);
    return r ? `${r.code} ${r.version}` : '—';
  }

  // ═════════ ۱) سلامت روش ═════════

  health(r: Routing, fixed: Set<string> = new Set()): Health {
    const ops = this.opsByRouting.get(r.id) ?? [];
    const own = (this.defectsByRouting.get(r.id) ?? []).filter((d) => !fixed.has(d.key));
    const seenLib = new Set<string>();
    const inherited: Defect[] = [];
    for (const o of ops)
      for (const d of this.libByOp.get(o.opId) ?? [])
        if (!fixed.has(d.key) && !seenLib.has(d.key)) {
          seenLib.add(d.key);
          inherited.push(d);
        }
    const applies = (cat: string): boolean => {
      switch (cat) {
        case 'BATCH': return ops.some((o) => o.attrCount > 0) || own.some((d) => d.cat === cat);
        case 'POL': return ops.some((o) => o.matCount > 0) || own.some((d) => d.cat === cat);
        case 'VER': return !r.isTemplate;
        case 'SUB': return r.isToll || ops.some((o) => o.outsourced);
        case 'REC': return ops.some((o) => o.recCount > 0) || own.some((d) => d.cat === cat);
        case 'CONT': return r.ptype === 2;
        case 'COST': return ops.some((o) => o.actCount > 0) || own.some((d) => d.cat === cat);
        case 'LIB': return inherited.length > 0;
        default: return true;
      }
    };
    const checks: Check[] = CATEGORIES.filter((c) => applies(c.code)).map((c) => {
      const ds = own.filter((d) => d.cat === c.code);
      const inh = c.code === 'LIB' ? inherited : [];
      const raw = ds.reduce((a, d) => a + PENALTY[d.sev], 0) + inh.length * PENALTY[1];
      return {
        cat: c.code, label: c.label, form: c.form, owner: c.owner, defects: ds, inherited: inh,
        worst: Math.max(0, ...ds.map((d) => d.sev), inh.length ? 1 : 0), penalty: Math.min(40, raw),
      };
    });
    // افت نمایی: نقص‌های بیشتر امتیاز را به صفر نزدیک می‌کنند ولی روش‌های پرنقص هنوز از هم تفکیک‌پذیرند
    const score = Math.round(100 * Math.exp(-checks.reduce((a, c) => a + c.penalty, 0) / 120));
    const opSev: Record<number, number> = {};
    for (const o of ops) opSev[o.id] = (this.libByOp.get(o.opId) ?? []).some((d) => !fixed.has(d.key)) ? 1 : 0;
    for (const d of own) if (d.roId !== null) opSev[d.roId] = Math.max(opSev[d.roId] ?? 0, d.sev);
    return {
      routing: r, score, base: score, tone: scoreTone(score), checks, failing: checks.filter((c) => c.worst > 0).length, defectCount: own.length + inherited.length,
      critical: own.filter((d) => d.sev === 3).length, opSev,
    };
  }

  // ═════════ ۲) استاندارد در برابر واقعیت ═════════

  calibrate(routingIds: Set<number>, includeRework: boolean, mode: 'auto' | 'manual', k: number, wManual: number, excludeUniform = true): CalResult {
    const excludedZero: Report[] = [];
    let excludedRework = 0;
    let excludedUniform = 0;
    const by = new Map<number, { op: Op; s: Sample[]; good: number; waste: number }>();
    const perWo = new Map<string, number[]>();
    for (const rp of this.b.reports) perWo.set(rp.wo, [...(perWo.get(rp.wo) ?? []), rp.minutes]);
    // دستوری که همه‌ی گزارش‌هایش (≥۴) یک مدت دارند به احتمال زیاد تخمینی ثبت شده است
    const uniform = [...perWo.entries()].filter(([, m]) => m.length >= 4 && m.every((x) => x === m[0])).map(([wo, m]) => ({ wo, minutes: m[0], count: m.length }));
    const uniformSet = new Set(uniform.map((u) => u.wo));
    for (const rp of this.b.reports) {
      if (rp.roId === null || !routingIds.has(rp.routingId ?? -1)) continue;
      if (excludeUniform && uniformSet.has(rp.wo)) {
        excludedUniform++;
        continue;
      }
      const op = this.opById.get(rp.roId);
      if (!op) continue;
      if (!includeRework && (rp.reprocess || rp.woType === 3)) {
        excludedRework++;
        continue;
      }
      const units = rp.good + rp.waste;
      if (units <= 0) {
        excludedZero.push(rp);
        continue;
      }
      const std = stdRun(op);
      const adjusted = rp.first && op.setup > 0 && rp.minutes > op.setup;
      const run = adjusted ? rp.minutes - op.setup : rp.minutes;
      const perUnit = run / units;
      const e = by.get(op.id) ?? { op, s: [], good: 0, waste: 0 };
      e.s.push({ perUnit, ratio: std > 0 ? perUnit / std : 0, wo: rp.wo, number: rp.number, minutes: rp.minutes, units, adjusted, pos: 0 });
      e.good += rp.good;
      e.waste += rp.waste;
      by.set(op.id, e);
    }
    const usageBy = new Map<number, Usage[]>();
    for (const u of this.b.usage) if (u.roId !== null) usageBy.set(u.roId, [...(usageBy.get(u.roId) ?? []), u]);
    const rows: CalRow[] = [];
    let axisMax = 2;
    for (const { op, s, good, waste } of by.values()) {
      const r = this.routingById.get(op.routingId);
      const std = stdRun(op);
      const pus = s.map((x) => x.perUnit);
      const totalRun = s.reduce((a, x) => a + x.perUnit * x.units, 0);
      const totalUnits = s.reduce((a, x) => a + x.units, 0);
      const med = median(pus);
      const min = Math.min(...pus);
      const max = Math.max(...pus);
      const n = s.length;
      const w = mode === 'auto' ? n / (n + k) : wManual;
      const suggested = std > 0 ? std + w * (med - std) : med;
      const bias = std > 0 ? (med / std - 1) * 100 : 0;
      const spread = med > 0 ? (max - min) / med : 0;
      const systematic = std > 0 && n >= 2 && Math.abs(bias) >= 15 && (pus.every((p) => p > std) || pus.every((p) => p < std));
      const confidence = n >= 5 && spread < 0.35 ? 'high' : n >= 3 && spread < 0.8 ? 'medium' : 'low';
      const batch = op.timingBatch ?? r?.batch ?? 0;
      const yieldStd = op.timingYield ?? op.yield;
      const yieldAct = good + waste > 0 ? (good / (good + waste)) * 100 : null;
      const usage = this.usageCompare(usageBy.get(op.id) ?? []);
      const ratios = s.map((x) => x.ratio);
      if (std > 0) axisMax = Math.max(axisMax, Math.min(4, Math.max(...ratios, suggested / std) * 1.1));
      rows.push({
        roId: op.id, routingId: op.routingId, routing: this.routingLabel(op.routingId), seq: op.seq, title: op.title, resource: op.resTitle, std, setup: op.setup,
        batch, n, samples: s, min, med, max, wmean: totalUnits > 0 ? totalRun / totalUnits : 0, bias, spread, confidence, systematic, w, suggested,
        deltaBatchMin: std > 0 ? (suggested - std) * batch : 0, yieldStd, yieldAct, usage, stdPos: 0, medPos: 0, sugPos: 0, minPos: 0, maxPos: 0, hasStd: std > 0,
      });
    }
    // جایگاه روی محور نسبت به استاندارد (۰ تا axisMax)
    const pos = (ratio: number): number => Math.max(0, Math.min(100, (ratio / axisMax) * 100));
    for (const row of rows) {
      const base = row.std > 0 ? row.std : row.med || 1;
      for (const x of row.samples) x.pos = pos(x.perUnit / base);
      row.stdPos = pos(1);
      row.medPos = pos(row.med / base);
      row.sugPos = pos(row.suggested / base);
      row.minPos = pos(row.min / base);
      row.maxPos = pos(row.max / base);
    }
    rows.sort((a, b) => (a.hasStd ? 0 : 1) - (b.hasStd ? 0 : 1) || Math.abs(b.bias) * Math.sqrt(b.n) - Math.abs(a.bias) * Math.sqrt(a.n));
    return { rows, excludedZero, excludedRework, excludedUniform, uniform, axisMax };
  }

  private usageCompare(us: Usage[]): UsageCmp[] {
    const agg = new Map<string, { cap: string; unit: string; std: number | null; actual: number | null; note: string }>();
    for (const u of us) {
      const std = stdUsage(u);
      const k = u.capCode;
      const e = agg.get(k) ?? { cap: u.capTitle, unit: u.unit, std: null, actual: null, note: '' };
      if (std !== null) e.std = (e.std ?? 0) + std;
      if (u.actual !== null) e.actual = (e.actual ?? 0) + u.actual;
      if (u.basis === null) e.note = 'در روش تعریف نشده';
      else if (std === null) e.note = u.basis === 3 ? 'پله ندارد' : 'فرمولی — ارزیابی نشد';
      else if (u.actual === null) e.note = 'ثبت واقعی ندارد';
      agg.set(k, e);
    }
    return [...agg.values()].map((e) => ({ ...e, ratio: e.std && e.actual !== null ? e.actual / e.std : null }));
  }

  // ═════════ ۳) شبیه‌ساز گلوگاه ═════════

  /** روش‌های قابل انتخاب برای هر کالا (غیرالگو، غیرمنسوخ) و پیش‌فرض: روش نسخه‌ی برنده‌ی دستور عادی */
  routesFor(productId: number): Routing[] {
    return this.b.routings.filter((r) => r.productId === productId && !r.isTemplate && r.status !== 4);
  }

  defaultRoute(productId: number): number | null {
    const el = this.b.elig.filter((e) => e.productId === productId && e.orderType === 1 && !e.reject).sort((a, c) => a.priority - c.priority);
    if (el.length) return el[0].routingId;
    const rs = this.routesFor(productId).sort((a, c) => (a.status === 3 ? 0 : 1) - (c.status === 3 ? 0 : 1));
    return rs[0]?.id ?? null;
  }

  /** تقاضای افق (هفته) برای پیش‌پر کردن ترکیب: باقی‌مانده‌ی دستورهای باز + درخواست‌های بی‌دستور با تاریخ نیاز در افق */
  defaultMix(horizonWeeks: number, now: number): Record<number, number> {
    const until = now + horizonWeeks * 7 * 86400000;
    const mix: Record<number, number> = {};
    for (const d of this.b.demand) if (d.need === null || d.need <= until) mix[d.productId] = (mix[d.productId] ?? 0) + d.remaining;
    for (const k of Object.keys(mix)) mix[+k] = Math.round(mix[+k] * 100) / 100;
    return mix;
  }

  resourceKey(kind: 'S' | 'G' | null, id: number | null): string | null {
    if (!kind || id === null) return null;
    const res = this.resByKey.get(`${kind}${id}`);
    if (kind === 'S' && res?.groupId) return `G${res.groupId}`;
    return `${kind}${id}`;
  }

  simulate(p: SimParams, productIds: number[]): SimResult {
    const load = new Map<string, { req: number; segs: Map<number, number>; ops: Map<string, number> }>();
    const unassigned: SimResult['unassigned'] = [];
    const external: SimResult['external'] = [];
    const add = (key: string, productId: number, min: number, opLabel: string): void => {
      const e = load.get(key) ?? { req: 0, segs: new Map<number, number>(), ops: new Map<string, number>() };
      e.req += min;
      e.segs.set(productId, (e.segs.get(productId) ?? 0) + min);
      e.ops.set(opLabel, (e.ops.get(opLabel) ?? 0) + min);
      load.set(key, e);
    };
    for (const pid of productIds) {
      const q = (p.mix[pid] ?? 0) * p.qtyMult;
      const rid = p.routeOf[pid];
      const r = rid ? this.routingById.get(rid) : undefined;
      if (q <= 0 || !r) continue;
      for (const o of this.opsByRouting.get(r.id) ?? []) {
        const qOp = (q * (o.alloc ?? 100)) / 100;
        const label = `${r.code} ${r.version}/${o.seq} ${o.title}`;
        if (o.outsourced) {
          const best = (this.subsByRo.get(o.id) ?? []).filter((s) => s.isActive).sort((a, c) => a.priority - c.priority)[0];
          external.push({ label, qty: qOp, lead: best ? `${best.contractor} · ${fa(best.lead ?? 0)} روز` : 'پیمانکاری ندارد' });
          continue;
        }
        if (!o.hasTiming) {
          unassigned.push({ label, min: 0, why: 'زمان استاندارد ندارد — بار دیده نمی‌شود' });
          continue;
        }
        const batch = o.timingBatch || r.batch || qOp;
        const batches = Math.max(1, Math.ceil(qOp / batch - 1e-9));
        const run = p.calibrated && p.calibrated[o.id] !== undefined ? p.calibrated[o.id] : stdRun(o);
        const min = batches * (o.setup + o.teardown + (o.waitOccupies ? o.wait : 0)) + (qOp * run) / (p.eff / 100);
        const key = this.resourceKey(o.resKind, o.resId);
        if (!key) {
          unassigned.push({ label, min, why: 'منبع ندارد' });
          continue;
        }
        const altPct = Math.max(0, Math.min(100, p.altShare[o.id] ?? 0));
        const alt = (this.altsByRo.get(o.id) ?? [])[0];
        const altKey = alt ? this.resourceKey(alt.resKind, alt.resId) : null;
        if (altPct > 0 && altKey) {
          add(key, pid, (min * (100 - altPct)) / 100, label);
          add(altKey, pid, (min * altPct) / 100, `${label} (جایگزین)`);
        } else add(key, pid, min, label);
      }
    }
    const colorOf = (pid: number): string => PRODUCT_COLORS[Math.max(0, productIds.indexOf(pid)) % PRODUCT_COLORS.length];
    const bars: LoadBar[] = [...load.entries()].map(([key, e]) => {
      const res = this.resByKey.get(key);
      const flags: string[] = [];
      let cap = 0;
      if (!res) flags.push('منبع در مدل ظرفیت نیست');
      else {
        const count = (res.machines ?? res.labor ?? 1) + (p.extraUnit[key] ?? 0);
        const dayMin = Math.min(1440, res.dayMin + (p.extraShift[key] ? 480 : 0));
        const shifts = Math.max(1, Math.round(dayMin / 480));
        const avail = (res.machines !== null ? res.avail ?? 100 : 100) / 100;
        const prod = (res.machines !== null ? res.prod ?? 100 : 100) / 100;
        const down = res.machines !== null ? res.downtime ?? 0 : 0;
        cap = p.horizon * res.weekDays * Math.max(0, dayMin * count * avail * prod - down * shifts * count);
        if (!res.active) {
          cap = 0;
          flags.push('ایستگاه غیرفعال');
        }
        if (res.capSource === 0 && res.labor === null) flags.push('ظرفیت RM-06 ندارد — یک واحد فرض شد');
        else if (res.capSource === 0) flags.push('فقط نفر (بدون ماشین‌ساعت)');
        else if (res.capSource === 2) flags.push('ظرفیت از ایستگاه‌های عضو');
        if (p.extraShift[key] && res.dayMin >= 1440) flags.push('تقویم ۲۴ ساعته است؛ شیفت اضافه اثری ندارد');
      }
      const util = cap > 0 ? (e.req / cap) * 100 : e.req > 0 ? Infinity : 0;
      const segs: LoadSeg[] = [...e.segs.entries()].map(([pid, min]) => ({ productId: pid, min, color: colorOf(pid), pct: e.req > 0 ? (min / e.req) * 100 : 0, left: 0, w: 0 }));
      return {
        key, title: res?.title ?? key, line: res?.lineTitle ?? '', reqMin: e.req, capMin: cap, util, utilLabel: Number.isFinite(util) ? `${fa(util)}٪` : '∞',
        segs, flags, tone: !Number.isFinite(util) || util > 100 ? 'bad' : util >= 90 ? 'warn' : 'ok', bottleneck: false, width: 0, capWidth: 0,
        ops: [...e.ops.entries()].map(([label, min]) => ({ label, min })).sort((a, c) => c.min - a.min),
      };
    });
    bars.sort((a, c) => (Number.isFinite(c.util) ? c.util : 1e9) - (Number.isFinite(a.util) ? a.util : 1e9));
    const finite = bars.filter((x) => Number.isFinite(x.util));
    const scaleMax = Math.max(120, ...finite.map((x) => x.util));
    for (const x of bars) {
      x.width = Number.isFinite(x.util) ? (x.util / scaleMax) * 100 : 100;
      x.capWidth = (100 / scaleMax) * 100;
      let acc = 0;
      for (const sg of x.segs) {
        sg.left = acc;
        sg.w = (sg.pct / 100) * x.width;
        acc += sg.w;
      }
    }
    const top = bars[0] ?? null;
    if (top) top.bottleneck = true;
    const maxUtil = top ? top.util : 0;
    const throughput = Number.isFinite(maxUtil) && maxUtil > 0 ? Math.min(999, 10000 / maxUtil) : 0;
    let narrative = 'ترکیبی برای شبیه‌سازی انتخاب نشده است.';
    if (top) {
      narrative = Number.isFinite(maxUtil)
        ? `گلوگاه «${top.title}» با بار ${fa(maxUtil)}٪ است؛ ${maxUtil > 100 ? `این ترکیب در افق ${fa(p.horizon)} هفته‌ای جا نمی‌شود و حداکثر ${fa(throughput)}٪ آن شدنی است.` : `ترکیب جا می‌شود و تا ${fa(throughput)}٪ همین ترکیب ظرفیت هست.`}`
        : `«${top.title}» بار دارد ولی ظرفیتش صفر است (${top.flags.join('، ')}) — هر سفارشی که از آن بگذرد قفل می‌شود.`;
      const second = bars.find((x) => x !== top && Number.isFinite(x.util));
      if (second) narrative += ` منبع بعدی «${second.title}» با ${second.utilLabel}.`;
      if (unassigned.length) narrative += ` ${fa(unassigned.length)} عملیات بار بی‌صاحب دارند.`;
    }
    return { bars, unassigned, external, maxUtil, bottleneck: top, throughput, narrative, scaleMax };
  }

  // ═════════ ۴) پوشش نسخه‌ی تولید ═════════

  coverage(productIds: number[], lineIds: number[]): Map<string, CovCell> {
    const out = new Map<string, CovCell>();
    for (const pid of productIds)
      for (const lid of lineIds)
        for (const ot of [1, 2, 3, 4]) {
          const all = this.b.elig.filter((e) => e.productId === pid && e.lineId === lid && e.orderType === ot);
          const eligible = all.filter((e) => !e.reject).sort((a, c) => a.priority - c.priority || span(a) - span(c));
          const rejected = all.filter((e) => !!e.reject);
          let conflict = false;
          for (let i = 0; i < eligible.length; i++)
            for (let j = i + 1; j < eligible.length; j++)
              if (eligible[i].priority === eligible[j].priority && overlap(eligible[i], eligible[j])) conflict = true;
          const status: CovCell['status'] = !eligible.length ? 'gap' : conflict ? 'conflict' : eligible.length > 1 ? 'many' : 'one';
          const demand = this.b.demand
            .filter((d) => d.productId === pid && d.orderType === ot && (d.lineId === null || d.lineId === lid))
            .map((d) => {
              const w = winnerAt(eligible, d.remaining);
              return { number: d.number, qty: d.remaining, covered: !!w, winner: w?.code ?? '' };
            });
          out.set(`${pid}-${lid}-${ot}`, {
            productId: pid, lineId: lid, orderType: ot, eligible, rejected, status, demand,
            label: status === 'gap' ? '—' : eligible.map((e) => e.code.replace(/^MV-/, '')).join(' · '),
            tone: status === 'gap' ? (all.length ? 'bad' : 'muted') : status === 'conflict' ? 'warn' : 'ok',
          });
        }
    return out;
  }

  /** نوارهای «برنده بر حسب مقدار» برای یک خانه */
  bands(cell: CovCell): { bands: Band[]; axisMax: number; ticks: { left: number; label: string }[] } {
    const finite = cell.eligible.flatMap((e) => [e.min ?? 0, e.max ?? 0]).concat(cell.demand.map((d) => d.qty)).filter((x) => x > 0);
    const axisMax = Math.max(1, ...finite) * 1.15;
    const pts = new Set<number>([0, axisMax]);
    for (const e of cell.eligible) {
      pts.add(Math.min(axisMax, e.min ?? 0));
      pts.add(Math.min(axisMax, e.max ?? axisMax));
    }
    const xs = [...pts].sort((a, c) => a - c);
    const bands: Band[] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i];
      const c = xs[i + 1];
      if (c - a <= 0) continue;
      const mid = (a + c) / 2;
      const inR = cell.eligible.filter((e) => (e.min ?? 0) <= mid && mid <= (e.max ?? Infinity));
      const w = inR[0];
      const tie = inR.length > 1 && inR[1].priority === w?.priority;
      const tone: Band['tone'] = !w ? 'gap' : tie ? 'tie' : 'win';
      const code = w ? w.code : '';
      const last = bands[bands.length - 1];
      if (last && last.code === code && last.tone === tone) {
        last.to = c;
        last.width = ((last.to - last.from) / axisMax) * 100;
        continue;
      }
      bands.push({ from: a, to: c, code, tone, left: (a / axisMax) * 100, width: ((c - a) / axisMax) * 100, label: tone === 'gap' ? 'بی‌نسخه' : tie ? `${code} = ${inR[1].code}` : code });
    }
    for (const x of bands) x.label += ` (${compact(x.from)}–${x.to >= axisMax ? '∞' : compact(x.to)})`;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ left: f * 100, label: compact(axisMax * f) }));
    return { bands, axisMax, ticks };
  }

  winnerAt(cell: CovCell, qty: number): Elig | null {
    return winnerAt(cell.eligible, qty);
  }

  // ═════════ ۵) وابستگی بیرونی و هزینه ═════════

  contractorRisk(): ContractorRisk[] {
    return this.b.contractors
      .map((c) => {
        const reasons: string[] = [];
        let score = 0;
        const hit = (points: number, reason: string): void => {
          score += points;
          reasons.push(reason);
        };
        if (!c.active) hit(40, 'غیرفعال');
        if (c.qual === 3) hit(40, 'تعلیق صلاحیت');
        else if (c.qual === 2) hit(15, 'صلاحیت مشروط');
        if (c.daysLeft !== null && c.daysLeft < 0) hit(30, 'قرارداد تمام‌شده');
        else if (c.daysLeft !== null && c.daysLeft < 60) hit(15, `${fa(c.daysLeft)} روز تا پایان قرارداد`);
        if (c.expiredQual) hit(10 * c.expiredQual, `${fa(c.expiredQual)} قابلیت با صلاحیت منقضی`);
        if (!c.caps) hit(20, 'هیچ قابلیتی ثبت نشده');
        const subs = this.b.subcontracts.filter((s) => s.contractorId === c.id);
        const ops = subs.map((s) => {
          const o = this.opById.get(s.roId);
          if (!s.hasCap) hit(10, `بدون قابلیت برای ${o ? `${this.routingLabel(o.routingId)}/${o.seq}` : 'عملیات'}`);
          return { label: o ? `${this.routingLabel(o.routingId)}/${o.seq} ${o.title}` : '—', priority: s.priority, fee: s.fee, regFee: s.regFee, hasCap: s.hasCap };
        });
        const live = this.b.subOrders
          .filter((x) => x.contractorId === c.id)
          .map((x) => {
            const allowed = subs[0]?.wastePct ?? null;
            const done = x.progressCompleted + x.progressWasted;
            const wastePct = done > 0 ? (x.progressWasted / done) * 100 : 0;
            if (x.delayDays > 0) hit(5 * x.delayDays, `${x.wo}: ${fa(x.delayDays)} روز تأخیر`);
            if (allowed !== null && wastePct > allowed) hit(15, `${x.wo}: ضایعات ${fa(wastePct, 1)}٪ > مجاز ${fa(allowed, 1)}٪`);
            return { wo: x.wo, delay: x.delayDays, wastePct, allowed, progress: x.toComplete > 0 ? (done / x.toComplete) * 100 : 0 };
          });
        return { c, score, tone: (score >= 40 ? 'bad' : score >= 15 ? 'warn' : 'ok') as Tone, reasons, ops, live };
      })
      .sort((a, c) => c.score - a.score);
  }

  outsourcedOps(routingIds: Set<number>): OutsourcedOp[] {
    return this.b.ops
      .filter((o) => o.outsourced && routingIds.has(o.routingId))
      .map((o) => {
        const subs = (this.subsByRo.get(o.id) ?? []).filter((s) => s.isActive);
        const qualified = o.qualifiedSubs;
        const cheapest = subs.filter((s) => s.contractorActive && s.hasCap && s.qual !== 3).sort((a, c) => (a.fee ?? 1e18) - (c.fee ?? 1e18))[0] ?? null;
        return {
          op: o, routing: this.routingById.get(o.routingId) as Routing, qualified, total: subs.length, singleSource: qualified <= 1, cheapest,
          tone: (qualified === 0 ? 'bad' : qualified === 1 ? 'warn' : 'ok') as Tone,
        };
      });
  }

  costRows(routingIds: Set<number>): CostRow[] {
    return this.b.routings
      .filter((r) => routingIds.has(r.id) && !r.isTemplate)
      .map((r) => {
        const ops = this.opsByRouting.get(r.id) ?? [];
        const ds = this.defectsByRouting.get(r.id) ?? [];
        const actMin = ops.reduce((a, o) => a + o.actMin, 0);
        const vaMin = ops.reduce((a, o) => a + o.vaMin, 0);
        return {
          routing: r, ops: ops.length, withActivities: ops.filter((o) => o.actCount > 0).length, actMin, vaMin, vaPct: actMin > 0 ? (vaMin / actMin) * 100 : null,
          noDriver: ds.filter((d) => d.rule === 'H1' || d.rule === 'H2').length, shareIssues: ds.filter((d) => d.rule === 'H3').length,
        };
      })
      .sort((a, c) => c.ops - a.ops);
  }

  // ═════════ ۶) بدهی فنی ═════════

  debt(routingIds: Set<number> | null): DebtItem[] {
    const useCount = new Map<number, number>();
    for (const o of this.b.ops) {
      const r = this.routingById.get(o.routingId);
      if (r && r.status === 3 && !r.isTemplate) useCount.set(o.opId, (useCount.get(o.opId) ?? 0) + 1);
    }
    return this.b.defects
      .filter((d) => routingIds === null || d.routingId === null || routingIds.has(d.routingId))
      .map((d) => {
        const r = d.routingId !== null ? this.routingById.get(d.routingId) : undefined;
        const factor = !r ? 1 : r.isTemplate ? 0.6 : r.status === 3 ? 1 : r.status === 2 ? 0.8 : r.status === 1 ? 0.5 : 0.3;
        const reach = r ? 1 + r.openWos + (r.activeVersions > 0 ? 1 : 0) : 1 + (d.libOpId !== null ? useCount.get(d.libOpId) ?? 0 : 0);
        return {
          d, impact: Math.round(SEV_WEIGHT[d.sev] * factor * reach * 10) / 10, routing: r ? `${r.code} ${r.version}` : d.cat === 'LIB' ? 'کتابخانه' : 'سراسری',
          owner: FORM_OWNER[d.form] ?? CAT_OWNER[d.cat] ?? '—', factor, reach, product: r?.product || '—',
        };
      })
      .sort((a, c) => c.impact - a.impact || c.d.sev - a.d.sev);
  }

  group(items: DebtItem[], by: 'cat' | 'form' | 'routing' | 'owner' | 'product', labelOf: (k: string) => string): DebtGroup[] {
    const m = new Map<string, DebtItem[]>();
    for (const it of items) {
      const k = by === 'cat' ? it.d.cat : by === 'form' ? it.d.form : by === 'routing' ? it.routing : by === 'owner' ? it.owner : it.product;
      m.set(k, [...(m.get(k) ?? []), it]);
    }
    const groups = [...m.entries()].map(([key, xs]) => ({ key, title: labelOf(key), items: xs, impact: xs.reduce((a, x) => a + x.impact, 0), pct: 0 }));
    const max = Math.max(1, ...groups.map((g) => g.impact));
    for (const g of groups) g.pct = (g.impact / max) * 100;
    return groups.sort((a, c) => c.impact - a.impact);
  }
}

// ───────── کمکی‌ها ─────────

export function stdRun(o: Op): number {
  return o.outsourced ? o.outRun : Math.max(o.eqRun, o.labRun);
}

/** مبنای محاسبه‌ی کارکرد ME-03: ۱ ثابت، ۲ متناسب، ۳ پلکانی «از-تا:مقدار;…»، ۴ ثابت+متغیر، ۵ فرمول (ارزیابی نمی‌شود) */
export function stdUsage(u: Usage): number | null {
  const per = u.per && u.per > 0 ? u.per : 1;
  switch (u.basis) {
    case 1: return u.fixed ?? 0;
    case 2: return ((u.variable ?? 0) * u.produced) / per;
    case 4: return (u.fixed ?? 0) + ((u.variable ?? 0) * u.produced) / per;
    case 3: {
      for (const part of u.steps.split(';')) {
        const m = /^\s*([\d.]+)\s*-\s*([\d.]+)\s*:\s*([\d.]+)\s*$/.exec(part);
        if (m && u.produced >= +m[1] && u.produced <= +m[2]) return +m[3];
      }
      return null;
    }
    default: return null;
  }
}

export function scoreTone(score: number): Tone {
  return score >= 90 ? 'ok' : score >= 70 ? 'info' : score >= 50 ? 'warn' : 'bad';
}

const span = (e: Elig): number => (e.max ?? 1e18) - (e.min ?? 0);
const overlap = (a: Elig, c: Elig): boolean => (a.min ?? 0) <= (c.max ?? Infinity) && (c.min ?? 0) <= (a.max ?? Infinity);
function winnerAt(eligible: Elig[], qty: number): Elig | null {
  return eligible.find((e) => (e.min ?? 0) <= qty && qty <= (e.max ?? Infinity)) ?? null;
}
function compact(v: number): string {
  if (v >= 1e6) return `${fa(v / 1e6, 2)}M`;
  if (v >= 1e3) return `${fa(v / 1e3, 1)}K`;
  return fa(v, 1);
}
export const ORDER_TYPES = [1, 2, 3, 4].map((c) => ({ code: c, label: ORDER_TYPE[c] }));
