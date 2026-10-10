/**
 * موتور محاسبه‌ی FRM-PC-13 — توابع خالص روی بسته‌ی داده (بدون Angular).
 * شاخص‌ها یک‌بار در سازنده ساخته می‌شوند؛ هر تابع با «دامنه» (Scope) و «لحظه‌ی t» صدا زده می‌شود
 * و فقط از جریان رویداد و ردیف‌های بسته مشتق می‌گیرد (هیچ عددی ساخته نمی‌شود).
 */
import { CA_STATUS, SHOP_NOW, WO_STATUS, WO_TYPE, faInt, faNum, faPct } from '../pc-shared';
import {
  AREA_LABEL, AgendaItem, AgendaLine, Area, DAY, DispositionRow, DnaRow, DnaTick, Ev, EvKind, Fact, ForecastRow, HOUR, HeatDay, HeatMetric, HeatRow, JAxisTick,
  JBar, JLane, KIND_COLOR, KIND_LABEL, KpiTile, LineTile, MIN, OperationRow, Pc13Bundle, Problem, ProblemGroup, RECON_EXCEPTION, ReconOutputRow, RiskPoint, Scope, SixM,
  WaterStep, WhatIfParams, WhatIfRow, clamp, dayStart, faDM, faDMT, faDur, faHM, faHours, faMoney, faWeekday, shortLine,
} from '../frm-pc-13.data';

export const NOW = SHOP_NOW.getTime();

interface StopIv { ev: Ev; woId: number; lineId: number | null; start: number; end: number; open: boolean }
interface OutPt { t: number; qty: number; lineId: number | null }
export interface Ctx { s: Scope; ids: Set<number>; orders: Fact[]; filtered: boolean }
export interface KpiCalc {
  has: boolean; earnedH: number; good: Map<string, number>; run: number; stop: number; avail: number | null; waste: Map<string, number>; rework: Map<string, number>;
  ncCost: number; completed: number; late: number; wip: number; reports: number;
  perLine: Map<number, { earned: number; good: Map<string, number>; run: number; stop: number }>;
}
export interface MatGate { woId: number; wo: string; productCode: string; product: string; unit: string; need: number; short: number; arrival: number | null; projected: boolean; seq: number | null }

const add = (m: Map<string, number>, k: string, v: number): void => {
  m.set(k, (m.get(k) ?? 0) + v);
};
const unitsText = (m: Map<string, number>): string =>
  [...m.entries()].filter(([, v]) => v > 0).map(([u, v]) => `${faNum(v, v < 100 ? 1 : 0)} ${u}`).join(' + ') || '—';

export const BASE_WHATIF: WhatIfParams = { repairH: 2, rates: {}, extraShift: {}, approveAll: false, decisionWaitH: 1, materialGate: true };

export class Pc13Engine {
  readonly facts: Fact[];
  readonly byId = new Map<number, Fact>();
  readonly byWo = new Map<string, Fact>();
  readonly evByWo = new Map<number, Ev[]>();
  readonly opsByWo = new Map<number, OperationRow[]>();
  readonly outputs = new Map<number, OutPt[]>();
  readonly stops: StopIv[] = [];
  readonly dispTime = new Map<string, number>();
  readonly win = new Map<number, [number, number]>();
  readonly lines: { id: number; title: string; short: string }[];
  readonly gates: MatGate[] = [];
  readonly customers: string[];
  readonly types: number[];

  constructor(readonly b: Pc13Bundle) {
    this.facts = b.facts;
    for (const f of b.facts) {
      this.byId.set(f.id, f);
      this.byWo.set(f.wo, f);
    }
    for (const e of b.events) {
      if (e.woId === null) continue;
      const l = this.evByWo.get(e.woId) ?? [];
      l.push(e);
      this.evByWo.set(e.woId, l);
    }
    for (const o of b.operations) {
      const l = this.opsByWo.get(o.woId) ?? [];
      l.push(o);
      this.opsByWo.set(o.woId, l);
    }
    for (const l of this.opsByWo.values()) l.sort((x, y) => x.seq - y.seq);

    for (const f of b.facts) {
      const evs = this.evByWo.get(f.id) ?? [];
      // خروجی سالم = گزارش‌های آخرین عملیات خروجی‌دار؛ برای برون‌سپاری بدون گزارش، یک پله در آخرین دریافت
      const pts: OutPt[] = evs.filter((e) => e.kind === 'REPORT' && f.lastSeq !== null && e.seq === f.lastSeq && (e.qty ?? 0) > 0).map((e) => ({ t: e.t, qty: e.qty ?? 0, lineId: e.lineId ?? f.lineId }));
      if (!pts.length && f.good > 0) {
        const ship = [...evs].reverse().find((e) => e.kind === 'SHIP' || e.kind === 'RECEIPT');
        pts.push({ t: f.lastEnd ?? f.lastReportAt ?? ship?.t ?? f.actComplete ?? NOW, qty: f.good, lineId: f.lineId });
      }
      this.outputs.set(f.id, pts);
      const times = [f.planRelease, f.actRelease, f.firstStart, evs[0]?.t ?? null].filter((x): x is number => x !== null);
      const ends = [f.due, f.planComplete, f.actComplete, f.closeDate, f.lastReportAt, f.forecastEnd, evs[evs.length - 1]?.t ?? null].filter((x): x is number => x !== null);
      const a = times.length ? Math.min(...times) : NOW;
      this.win.set(f.id, [a, ends.length ? Math.max(a, ...ends) : a]);
    }

    for (const e of b.events) {
      if (e.kind === 'STOP' && e.woId !== null) {
        const f = this.byId.get(e.woId);
        const end = e.t + (e.min ?? 0) * MIN;
        this.stops.push({ ev: e, woId: e.woId, lineId: e.lineId ?? f?.lineId ?? null, start: e.t, end, open: !!f && f.openStops > 0 && end >= NOW - MIN });
      }
      if (e.kind === 'NC') this.dispTime.set(e.title.split(' — ')[0].trim(), e.t);
    }
    for (const d of b.dispositions) if (!this.dispTime.has(d.number)) {
      const t = d.reportedAt ?? d.decidedAt;
      if (t !== null) this.dispTime.set(d.number, t);
    }

    const lm = new Map<number, string>();
    for (const f of b.facts) lm.set(f.lineId, f.line);
    for (const d of b.daily) if (!lm.has(d.lineId)) lm.set(d.lineId, d.line);
    this.lines = [...lm.entries()].sort((x, y) => x[0] - y[0]).map(([id, title]) => ({ id, title, short: shortLine(title) }));
    this.customers = [...new Set(b.facts.map((f) => f.customer).filter((c) => !!c))].sort();
    this.types = [...new Set(b.facts.map((f) => f.type))].sort((x, y) => x - y);
    this.buildGates();
  }

  /** کسری مواد: کسری ثبت‌شده + کسری پیش‌بینی‌شده‌ی مواد کیت‌نشده (تخصیص موجودی آزاد + رزرو به ترتیب سررسید) */
  private buildGates(): void {
    for (const m of this.b.materials) {
      const f = this.byId.get(m.woId);
      if (!f || (m.shortage ?? 0) <= 0) continue;
      this.gates.push({ woId: f.id, wo: f.wo, productCode: m.productCode, product: m.product, unit: m.unit, need: m.shortage ?? 0, short: Math.max(0, (m.shortage ?? 0) - Math.max(0, m.available ?? 0)), arrival: m.nextArrival, projected: false, seq: m.seq });
    }
    const stock = new Map<string, number>();
    const open = this.b.materials
      .filter((m) => m.status === 1 && (m.actualKit ?? 0) <= 0 && !m.customer && [1, 2, 3, 7].includes(this.byId.get(m.woId)?.status ?? 0))
      .sort((x, y) => (this.byId.get(x.woId)?.due ?? 0) - (this.byId.get(y.woId)?.due ?? 0));
    for (const m of open) {
      const f = this.byId.get(m.woId);
      if (!f) continue;
      if (!stock.has(m.productCode)) stock.set(m.productCode, Math.max(0, m.available ?? 0) + Math.max(0, m.reserved ?? 0));
      const have = stock.get(m.productCode) ?? 0;
      const need = m.planKit;
      if (need <= 0) continue;
      if (need > have + 1e-9) this.gates.push({ woId: f.id, wo: f.wo, productCode: m.productCode, product: m.product, unit: m.unit, need, short: need - have, arrival: m.nextArrival, projected: true, seq: m.seq });
      stock.set(m.productCode, Math.max(0, have - need));
    }
  }

  // ───────── دامنه ─────────

  ctx(s: Scope): Ctx {
    const orders = this.facts.filter((f) => {
      if (s.mode === 'order' && s.woId !== null) return f.id === s.woId;
      const w = this.win.get(f.id) ?? [0, 0];
      if (!(w[0] < s.to && w[1] >= s.from)) return false;
      if (s.lines.length && !s.lines.includes(f.lineId)) return false;
      if (s.types.length && !s.types.includes(f.type)) return false;
      if (s.customer !== null && f.customer !== s.customer) return false;
      return true;
    });
    return { s, ids: new Set(orders.map((f) => f.id)), orders, filtered: s.mode === 'order' || !!s.lines.length || !!s.types.length || s.customer !== null };
  }

  evMatch(c: Ctx, e: Ev): boolean {
    if (e.woId !== null) return c.ids.has(e.woId);
    if (c.s.mode === 'order' || c.s.types.length || c.s.customer !== null) return false;
    if (c.s.lines.length) return e.lineId !== null && c.s.lines.includes(e.lineId);
    return true;
  }

  eventsIn(c: Ctx, a: number, b: number): Ev[] {
    return this.b.events.filter((e) => e.t >= a && e.t <= b && this.evMatch(c, e));
  }

  goodAt(f: Fact, t: number): number {
    let q = 0;
    for (const p of this.outputs.get(f.id) ?? []) if (p.t <= t) q += p.qty;
    return q;
  }

  progressAt(f: Fact, t: number): number {
    return f.qty > 0 ? clamp(this.goodAt(f, t) / f.qty, 0, 1) : 0;
  }

  private stopEnd(iv: StopIv): number {
    return iv.open ? Math.max(iv.end, NOW) : iv.end;
  }

  stopMinutes(iv: StopIv, a: number, b: number): number {
    const x = Math.max(a, iv.start);
    const y = Math.min(b, this.stopEnd(iv));
    return y > x ? (y - x) / MIN : 0;
  }

  stopOpenAt(iv: StopIv, t: number): boolean {
    return iv.start <= t && t < this.stopEnd(iv) + (iv.open && t >= NOW ? 1 : 0);
  }

  openStopsAt(c: Ctx, t: number): StopIv[] {
    return this.stops.filter((iv) => c.ids.has(iv.woId) && this.stopOpenAt(iv, t));
  }

  dispIn(c: Ctx, a: number, b: number) {
    return this.b.dispositions.filter((d) => {
      const t = this.dispTime.get(d.number);
      return c.ids.has(d.woId) && t !== undefined && t >= a && t <= b;
    });
  }

  // ───────── شاخص‌ها ─────────

  kpi(c: Ctx, a: number, b: number): KpiCalc {
    const k: KpiCalc = { has: false, earnedH: 0, good: new Map(), run: 0, stop: 0, avail: null, waste: new Map(), rework: new Map(), ncCost: 0, completed: 0, late: 0, wip: 0, reports: 0, perLine: new Map() };
    const line = (id: number) => {
      let l = k.perLine.get(id);
      if (!l) k.perLine.set(id, (l = { earned: 0, good: new Map(), run: 0, stop: 0 }));
      return l;
    };
    if (b <= a) return k;
    for (const e of this.eventsIn(c, a, b)) {
      k.has = true;
      if (e.kind === 'REPORT') {
        k.reports++;
        k.run += e.min ?? 0;
        line(e.lineId ?? this.byId.get(e.woId ?? 0)?.lineId ?? 0).run += e.min ?? 0;
      }
      if (e.kind === 'COMPLETE') k.completed++;
    }
    for (const f of c.orders) {
      for (const p of this.outputs.get(f.id) ?? []) {
        if (p.t < a || p.t > b) continue;
        const h = f.qty > 0 ? (p.qty / f.qty) * f.stdMin / 60 : 0;
        k.earnedH += h;
        add(k.good, f.unit, p.qty);
        const l = line(p.lineId ?? f.lineId);
        l.earned += h;
        add(l.good, f.unit, p.qty);
      }
      if (f.status !== 6 && f.due !== null && f.due <= b && (f.actComplete === null || (f.actComplete > f.due && f.actComplete >= a))) k.late++;
      if (f.status !== 6 && f.actRelease !== null && f.actRelease <= b && (f.actComplete === null || f.actComplete > b)) k.wip++;
    }
    for (const iv of this.stops) {
      if (!c.ids.has(iv.woId)) continue;
      const m = this.stopMinutes(iv, a, b);
      if (m <= 0) continue;
      k.stop += m;
      line(iv.lineId ?? 0).stop += m;
    }
    for (const d of this.dispIn(c, a, b)) {
      const u = d.unit || this.byId.get(d.woId)?.unit || '';
      add(d.ncType === 3 ? k.rework : k.waste, u, d.qty);
      k.ncCost += d.cost;
    }
    k.avail = k.run + k.stop > 0 ? (k.run / (k.run + k.stop)) * 100 : null;
    return k;
  }

  /** کاشی‌های «تصویر هفته» با تغییر نسبت به دوره‌ی قبل (پایه‌ی خالی = «—») */
  tiles(cur: KpiCalc, prev: KpiCalc | null, atRisk: number | null, problems: Problem[], t: number): KpiTile[] {
    const pctDelta = (x: number, y: number | null, upGood: boolean): Pick<KpiTile, 'delta' | 'deltaTone'> => {
      if (!prev || !prev.has || y === null || y === 0) return { delta: '—', deltaTone: 'none' };
      const d = ((x - y) / Math.abs(y)) * 100;
      if (Math.abs(d) < 0.5) return { delta: '＝ بدون تغییر', deltaTone: 'flat' };
      return { delta: `${d > 0 ? '▲' : '▼'} ${faPct(Math.abs(d), 0)}`, deltaTone: d > 0 === upGood ? 'good' : 'bad' };
    };
    const ppDelta = (x: number | null, y: number | null, upGood: boolean): Pick<KpiTile, 'delta' | 'deltaTone'> => {
      if (!prev || !prev.has || x === null || y === null) return { delta: '—', deltaTone: 'none' };
      const d = x - y;
      if (Math.abs(d) < 0.05) return { delta: '＝ بدون تغییر', deltaTone: 'flat' };
      return { delta: `${d > 0 ? '▲' : '▼'} ${faNum(Math.abs(d), 1)} واحد درصد`, deltaTone: d > 0 === upGood ? 'good' : 'bad' };
    };
    const mainUnit = [...cur.good.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'قرص';
    const wp = (k: KpiCalc | null, u: string): number | null => {
      if (!k) return null;
      const w = k.waste.get(u) ?? 0;
      const g = k.good.get(u) ?? 0;
      return w + g > 0 ? (w / (w + g)) * 100 : null;
    };
    const wasteSub = [...cur.waste.keys()].filter((u) => u !== mainUnit).map((u) => `${u}: ${faPct(wp(cur, u), 1)}`).join(' · ');
    const crit = problems.filter((p) => p.sev >= 3).length;
    return [
      {
        key: 'good', label: 'خروجی سالم', value: faNum(cur.earnedH, 1), unit: 'ساعت استاندارد', sub: unitsText(cur.good), tone: 'info',
        hint: 'مقدار گزارش‌شده‌ی آخرین عملیات خروجی‌دار هر دستور ÷ مقدار دستور × دقیقه‌ی استاندارد کل دستور (واحد مشترک برای قرص و کیلوگرم).',
        ...pctDelta(cur.earnedH, prev ? prev.earnedH : null, true),
      },
      {
        key: 'avail', label: 'دسترس‌پذیری تقریبی', value: cur.avail === null ? '—' : faPct(cur.avail, 1), unit: '', sub: `کار ${faDur(cur.run)} · توقف ${faDur(cur.stop)}`,
        tone: cur.avail !== null && cur.avail < 85 ? 'warning' : 'success', hint: 'دقیقه‌ی کار گزارش‌شده ÷ (کار + توقف) — جایگزین ساده‌ی Availability.',
        ...ppDelta(cur.avail, prev ? prev.avail : null, true),
      },
      {
        key: 'waste', label: `ضایعات (${mainUnit})`, value: wp(cur, mainUnit) === null ? '—' : faPct(wp(cur, mainUnit), 2), unit: '', sub: wasteSub || unitsText(cur.waste),
        tone: (wp(cur, mainUnit) ?? 0) > 1.5 ? 'danger' : 'warning', hint: 'اسقاط + قابل بازیافت + درجه‌دو ÷ (همان + خروجی سالم)؛ دوباره‌کاری جدا شمرده می‌شود.',
        ...ppDelta(wp(cur, mainUnit), wp(prev, mainUnit), false),
      },
      {
        key: 'copq', label: 'هزینه‌ی کیفیت', value: faNum(cur.ncCost / 1e6, 1), unit: 'میلیون ریال', sub: `دوباره‌کاری: ${unitsText(cur.rework)}`, tone: 'danger',
        hint: 'جمع CostAmount عدم‌انطباق‌های ثبت‌شده در بازه (هم‌زمان با رویداد NC).', ...pctDelta(cur.ncCost, prev ? prev.ncCost : null, false),
      },
      {
        key: 'orders', label: 'دستورها', value: faInt(cur.completed), unit: 'تکمیل', sub: `دیر ${faInt(cur.late)} · در خطر ${atRisk === null ? '— (فقط اکنون)' : faInt(atRisk)} · در جریان ${faInt(cur.wip)}`,
        tone: cur.late || (atRisk ?? 0) ? 'danger' : 'success', hint: 'دیر = سررسید گذشته و تکمیل‌نشده (یا دیر تکمیل‌شده)؛ در خطر = پیش‌بینی مدل «اگر…» پس از سررسید.',
        ...pctDelta(cur.completed, prev ? prev.completed : null, true),
      },
      {
        key: 'problems', label: 'مشکلات باز', value: faInt(problems.length), unit: 'مورد', sub: `${faInt(crit)} بحرانی · تا ${faDMT(t)}`, tone: crit ? 'danger' : 'warning',
        hint: 'همه‌ی منبع‌های رادار مشکلات که تا لحظه‌ی نوار زمان رخ داده‌اند.', delta: '—', deltaTone: 'none',
      },
    ];
  }

  lineTiles(cur: KpiCalc, c: Ctx): LineTile[] {
    return this.lines
      .filter((l) => !c.s.lines.length || c.s.lines.includes(l.id))
      .map((l) => {
        const x = cur.perLine.get(l.id) ?? { earned: 0, good: new Map<string, number>(), run: 0, stop: 0 };
        const av = x.run + x.stop > 0 ? (x.run / (x.run + x.stop)) * 100 : null;
        return { lineId: l.id, line: l.short, earned: faNum(x.earned, 1), good: unitsText(x.good), avail: av, availLabel: av === null ? '—' : faPct(av, 0), run: faDur(x.run), stop: faDur(x.stop) };
      });
  }

  // ───────── نقشه‌ی حرارتی خط × روز ─────────

  heat(c: Ctx, metric: HeatMetric, t: number): { days: HeatDay[]; rows: HeatRow[] } {
    const days: HeatDay[] = [];
    for (let d = dayStart(c.s.from); d < c.s.to && days.length < 62; d += DAY) days.push({ t: d, label: faDM(d), weekday: faWeekday(d), today: d === dayStart(NOW) });
    const lines = this.lines.filter((l) => !c.s.lines.length || c.s.lines.includes(l.id));
    const val = new Map<string, number>();
    const key = (l: number, d: number) => `${l}:${d}`;
    if (metric === 'prod') {
      for (const f of c.orders)
        for (const p of this.outputs.get(f.id) ?? []) {
          if (p.t > t || p.t < c.s.from || p.t >= c.s.to) continue;
          const k = key(p.lineId ?? f.lineId, dayStart(p.t));
          val.set(k, (val.get(k) ?? 0) + (f.qty > 0 ? (p.qty / f.qty) * f.stdMin / 60 : 0));
        }
    } else {
      for (const r of this.b.daily) {
        if (r.t < c.s.from || r.t >= c.s.to) continue;
        const v = metric === 'stop' ? r.stopMin : metric === 'copq' ? r.ncCost : metric === 'reports' ? r.reports : r.completed + r.wasted > 0 ? (r.wasted / (r.completed + r.wasted)) * 100 : 0;
        val.set(key(r.lineId, dayStart(r.t)), v);
      }
    }
    const max = Math.max(0, ...val.values());
    const fmt = (v: number): string =>
      metric === 'prod' ? `${faNum(v, 1)} س` : metric === 'stop' ? `${faInt(v)} د` : metric === 'copq' ? `${faNum(v / 1e6, 1)} م` : metric === 'waste' ? faPct(v, 2) : faInt(v);
    const single = c.s.to - c.s.from === DAY && c.s.lines.length === 1;
    const rows = lines.map((l) => {
      let tot = 0;
      const cells = days.map((d) => {
        const v = val.get(key(l.id, d.t)) ?? 0;
        tot += v;
        return { day: d.t, lineId: l.id, value: v, label: v ? fmt(v) : '·', level: max > 0 ? v / max : 0, future: d.t > t, on: single && c.s.from === d.t && c.s.lines[0] === l.id };
      });
      return { lineId: l.id, line: l.short, cells, total: metric === 'waste' ? '' : fmt(tot) };
    });
    return { days, rows };
  }

  // ───────── DNA سفارش‌ها ─────────

  dna(c: Ctx, t: number): DnaRow[] {
    const span = Math.max(HOUR, c.s.to - c.s.from);
    const x = (v: number) => clamp(((v - c.s.from) / span) * 100, 0, 100);
    return c.orders
      .map((f) => {
        const evs = (this.evByWo.get(f.id) ?? []).filter((e) => e.t >= c.s.from && e.t < c.s.to && e.kind !== 'OP_START' && e.kind !== 'OP_END');
        const ticks: DnaTick[] = evs.map((e) => ({
          x: x(e.t), w: e.kind === 'STOP' ? Math.max(0.35, (((e.min ?? 0) * MIN) / span) * 100) : e.kind === 'REPORT' ? 0.18 : 0.32, color: KIND_COLOR[e.kind], t: e.t,
          tip: `${faDMT(e.t)} · ${KIND_LABEL[e.kind]} · ${e.title}${e.detail ? ' — ' + e.detail : ''}${e.min ? ' (' + faDur(e.min) + ')' : ''}`, tall: e.sev >= 2 || e.kind === 'STOP',
        }));
        const cnt = (k: EvKind) => evs.filter((e) => e.kind === k).length;
        const stopMin = evs.filter((e) => e.kind === 'STOP').reduce((sum, e) => sum + (e.min ?? 0), 0);
        const rough = stopMin + 20 * cnt('NC') + 45 * cnt('PARAM') + 60 * cnt('DEVIATION') + 30 * cnt('CHANGE') + 15 * cnt('EXCESS');
        const ps = f.planRelease ?? f.actRelease;
        const pe = f.planComplete ?? f.due;
        const parts = [stopMin ? `${faDur(stopMin)} توقف` : '', cnt('NC') ? `${faInt(cnt('NC'))} NC` : '', cnt('PARAM') ? `${faInt(cnt('PARAM'))} پارامتر` : '', cnt('CHANGE') ? `${faInt(cnt('CHANGE'))} تغییر` : ''].filter((p) => !!p);
        return {
          id: f.id, wo: f.wo, label: f.title, line: shortLine(f.line), status: WO_STATUS[f.status] ?? '', planX: ps !== null ? x(ps) : 0,
          planW: ps !== null && pe !== null ? Math.max(0.3, x(pe) - x(ps)) : 0, dueX: f.due !== null && f.due >= c.s.from && f.due < c.s.to ? x(f.due) : null,
          dueOut: (f.due === null ? '' : f.due < c.s.from ? 'before' : f.due >= c.s.to ? 'after' : '') as DnaRow['dueOut'], dueLabel: f.due !== null ? `سررسید ${faDM(f.due)}` : '', ticks, rough,
          roughLabel: parts.join(' · ') || 'هفته‌ی آرام', progress: Math.round(this.progressAt(f, t) * 100),
          late: f.status !== 6 && f.due !== null && f.due < t && (f.actComplete === null || f.actComplete > f.due), focus: c.s.woId === f.id,
        };
      })
      .sort((p, q) => q.rough - p.rough || p.wo.localeCompare(q.wo));
  }

  // ───────── آبشار برنامه ← واقعی (ساعت استاندارد) ─────────

  waterfall(c: Ctx, t: number): { steps: WaterStep[]; planH: number; actualH: number; count: number; narrative: string } {
    const set = c.orders.filter((f) => f.status !== 6 && f.planComplete !== null && f.planComplete >= c.s.from && f.planComplete < c.s.to && f.stdMin > 0);
    let plan = 0, notStarted = 0, notYet = 0, stops = 0, waste = 0, rework = 0, residual = 0, actual = 0;
    let nsCount = 0, nyCount = 0;
    for (const f of set) {
      const avail = f.stdMin / 60;
      plan += avail;
      const start = f.firstStart ?? (this.outputs.get(f.id)?.[0]?.t ?? null);
      if (start === null || start > t) {
        if ((f.planRelease ?? 0) > t) {
          notYet += avail;
          nyCount++;
        } else {
          notStarted += avail;
          nsCount++;
        }
        continue;
      }
      const rate = avail / Math.max(1, f.qty);
      const act = Math.min(avail, this.goodAt(f, t) * rate);
      let rest = avail - act;
      const st = Math.min(rest, this.stops.filter((iv) => iv.woId === f.id).reduce((s0, iv) => s0 + this.stopMinutes(iv, 0, t), 0) / 60);
      rest -= st;
      const ds = this.b.dispositions.filter((d) => d.woId === f.id && (this.dispTime.get(d.number) ?? Infinity) <= t);
      const w = Math.min(rest, ds.filter((d) => d.ncType !== 3).reduce((s0, d) => s0 + d.qty, 0) * rate);
      rest -= w;
      const rw = Math.min(rest, ds.filter((d) => d.ncType === 3).reduce((s0, d) => s0 + d.qty, 0) * rate);
      rest -= rw;
      actual += act; stops += st; waste += w; rework += rw; residual += rest;
    }
    let base = plan;
    const step = (label: string, v: number, hint: string): WaterStep => {
      base -= v;
      return { label, value: v, base, kind: 'loss', text: `−${faNum(v, 1)}`, hint };
    };
    const steps: WaterStep[] = [
      { label: 'برنامه‌ی سررسید در بازه', value: plan, base: 0, kind: 'total', text: faNum(plan, 1), hint: `${faInt(set.length)} دستور با پایان برنامه‌ای در بازه (ساعت استاندارد)` },
      step('نوبت نرسیده', notYet, `${faInt(nyCount)} دستور که آزادسازی برنامه‌ای‌شان پس از این لحظه است`),
      step('شروع‌نشده (دیر)', notStarted, `${faInt(nsCount)} دستور که زمان شروعشان گذشته ولی شروع نشده‌اند`),
      step('توقف', stops, 'دقیقه‌ی توقف ثبت‌شده × نرخ استاندارد (هر دقیقه‌ی توقف = یک دقیقه‌ی استاندارد ازدست‌رفته)'),
      step('کندی / کار مانده', residual, 'باقی‌مانده‌ی برنامه‌ی دستورهای شروع‌شده پس از کسر توقف و ضایعات؛ کندتر از استاندارد یا هنوز انجام‌نشده'),
      step('ضایعات', waste, 'اسقاط، قابل بازیافت و درجه‌دو به نسبت مقدار دستور'),
      step('دوباره‌کاری', rework, 'مقدار دوباره‌کاری به نسبت مقدار دستور'),
      { label: 'خروجی سالم', value: actual, base: 0, kind: 'result', text: faNum(actual, 1), hint: 'خروجی سالم آخرین عملیات به ساعت استاندارد' },
    ];
    const losses = steps.filter((x) => x.kind === 'loss').sort((x, y) => y.value - x.value);
    const narrative = plan
      ? `از ${faNum(plan, 1)} ساعت استاندارد کارِ سررسید این بازه، ${faPct((actual / plan) * 100, 0)} به خروجی سالم رسیده است. بزرگ‌ترین شکاف «${losses[0].label}» با ${faNum(losses[0].value, 1)} ساعت و پس از آن «${losses[1].label}» با ${faNum(losses[1].value, 1)} ساعت است.${stops > 0 ? ` توقف‌ها ${faPct((stops / plan) * 100, 1)} برنامه را گرفته‌اند.` : ''}`
      : 'در این بازه دستوری با پایان برنامه‌ای نیست.';
    return { steps, planH: plan, actualH: actual, count: set.length, narrative };
  }

  // ───────── پیش‌بینی پایان و «اگر…» ─────────

  private remStd(o: OperationRow): number {
    return o.std * (o.toComplete > 0 ? Math.max(0, 1 - o.completed / o.toComplete) : 1);
  }

  private excessPending(f: Fact): boolean {
    return (this.evByWo.get(f.id) ?? []).some((e) => e.kind === 'EXCESS' && e.t >= NOW - DAY);
  }

  forecast(c: Ctx, p: WhatIfParams): ForecastRow[] {
    const active = c.orders.filter((f) => [1, 2, 3, 7].includes(f.status));
    const capOf = (lineId: number) => (1 + (p.rates[lineId] ?? 0) / 100) * (p.extraShift[lineId] ? 1.5 : 1);
    return active.map((f) => {
      const reasons: string[] = [];
      let end: number;
      let blocked = false;
      const noStd = f.stdMin <= 0;
      if (noStd) {
        end = f.planComplete ?? f.due ?? NOW;
        reasons.push('بدون زمان استاندارد — پایان برنامه‌ای');
      } else {
        const start = f.actRelease !== null && f.actRelease <= NOW ? NOW : Math.max(NOW, f.planRelease ?? NOW);
        if (start > NOW) reasons.push(`شروع برنامه‌ای ${faDMT(start)}`);
        const cap = capOf(f.lineId);
        const ops = (this.opsByWo.get(f.id) ?? []).filter((o) => o.status !== 5);
        const outs = ops.filter((o) => o.outsourced);
        const internal = ops.filter((o) => !o.outsourced);
        let from = start;
        if (outs.length) {
          const sub = this.b.subcontract.find((x) => x.woId === f.id);
          const ready = sub?.expectedReady ?? f.contractorReady ?? sub?.expectedReturn ?? NOW;
          from = Math.max(from, ready);
          reasons.push(`پیمانکار تا ${faDM(ready)}`);
        }
        let bott = 0;
        let bottOp: OperationRow | null = null;
        for (const o of internal) if (this.remStd(o) > bott) { bott = this.remStd(o); bottOp = o; }
        end = from + (bott / cap) * MIN;
        if (bottOp) reasons.push(`گلوگاه ${bottOp.title} ${faDur(bott / cap)}`);
        if (this.stops.some((iv) => iv.woId === f.id && iv.open)) {
          end += p.repairH * HOUR;
          reasons.push(`توقف باز +${faHours(p.repairH)}`);
        }
        for (const o of internal.filter((x) => x.status === 4 && x.resource)) {
          if (this.stops.some((iv) => iv.woId === f.id && iv.open && iv.ev.seq === o.seq)) continue;
          const holder = this.b.operations.find((h) => h.woId !== f.id && h.resource === o.resource && (h.status === 3 || h.status === 4));
          if (!holder) continue;
          const hf = this.byId.get(holder.woId);
          const wait = (this.remStd(holder) / capOf(hf?.lineId ?? f.lineId)) * MIN + (this.stops.some((iv) => iv.woId === holder.woId && iv.open && iv.ev.seq === holder.seq) ? p.repairH * HOUR : 0);
          const fin = NOW + wait + (this.remStd(o) / cap) * MIN;
          if (fin > end) end = fin;
          reasons.push(`منبع ${o.resource} در اختیار ${hf?.wo ?? ''} (${faDur(wait / MIN)})`);
        }
        if ((f.ncPending > 0 || this.excessPending(f)) && !p.approveAll && p.decisionWaitH > 0) {
          end += p.decisionWaitH * HOUR;
          reasons.push(`تصمیم معوق +${faHours(p.decisionWaitH)}`);
        }
        if (p.materialGate) {
          for (const g of this.gates.filter((x) => x.woId === f.id && x.short > 0)) {
            if (g.arrival === null) {
              blocked = true;
              reasons.push(`کسری ${g.product} بدون تاریخ رسیدن`);
              continue;
            }
            const gt = g.arrival + HOUR;
            if (gt > end) end = gt;
            reasons.push(`کسری ${g.product} تا ${faDM(g.arrival)}`);
          }
        }
      }
      const slackH = f.due !== null ? (f.due - end) / HOUR : 999;
      return {
        id: f.id, wo: f.wo, line: shortLine(f.line), lineId: f.lineId, due: f.due, end, slackH, late: f.due !== null && (end > f.due || blocked),
        remainingPct: Math.round((1 - this.progressAt(f, NOW)) * 100), noStd, reasons, api: f.forecastEnd,
      };
    });
  }

  whatIfRows(base: ForecastRow[], scen: ForecastRow[]): WhatIfRow[] {
    return scen
      .map((r) => {
        const b0 = base.find((x) => x.id === r.id) ?? r;
        const dh = (r.end - b0.end) / HOUR;
        return {
          id: r.id, wo: r.wo, line: r.line, due: r.due !== null ? faDMT(r.due) : '—', before: faDMT(b0.end), after: faDMT(r.end), deltaH: dh,
          deltaLabel: Math.abs(dh) < 0.05 ? '＝' : `${dh < 0 ? '▼' : '▲'} ${faHours(Math.abs(dh))}`,
          flip: (b0.late && !r.late ? 'saved' : !b0.late && r.late ? 'broken' : '') as WhatIfRow['flip'], lateAfter: r.late, reasons: r.reasons.join(' · '),
        };
      })
      .sort((x, y) => Number(y.lateAfter) - Number(x.lateAfter) || x.wo.localeCompare(y.wo));
  }

  risk(rows: ForecastRow[]): RiskPoint[] {
    const pts = rows.filter((r) => r.due !== null);
    const maxV = Math.max(Math.sqrt(24), ...pts.map((r) => Math.sqrt(Math.min(400, Math.abs(r.slackH)))));
    return pts.map((r) => {
      const f = this.byId.get(r.id);
      const v = Math.sign(r.slackH) * Math.sqrt(Math.min(400, Math.abs(r.slackH)));
      return {
        id: r.id, wo: r.wo, x: 50 - (v / maxV) * 44, y: 92 - r.remainingPct * 0.84, r: 2.2 + Math.sqrt(Math.max(0, f?.stdMin ?? 0) / 60) * 0.9, slackH: r.slackH,
        remaining: r.remainingPct, late: r.late, label: r.wo.slice(-4),
        tip: `${r.wo} · حاشیه ${faHours(r.slackH)} · ${faPct(r.remainingPct, 0)} کار مانده · پیش‌بینی ${faDMT(r.end)}${r.reasons.length ? ' · ' + r.reasons.join('، ') : ''}`,
      };
    });
  }

  // ───────── هزینه‌ی کیفیت، مواد، بیرون ─────────

  copq(c: Ctx, groupBy: 'reason' | 'line' | 'type') {
    const NC_T: Record<number, string> = { 1: 'اسقاط', 2: 'قابل بازیافت', 3: 'دوباره‌کاری', 4: 'درجه‌دو' };
    const rows = this.b.copq.filter((r) => {
      const f = this.byWo.get(r.wo);
      if (!f || !c.ids.has(f.id)) return false;
      return r.decidedAt === null || (r.decidedAt >= c.s.from && r.decidedAt < c.s.to);
    });
    const g = new Map<string, { cost: number; recovered: number; penalty: number; cases: number }>();
    for (const r of rows) {
      const k = groupBy === 'line' ? shortLine(r.line) : groupBy === 'type' ? NC_T[r.ncType] ?? '' : r.reason;
      const x = g.get(k) ?? { cost: 0, recovered: 0, penalty: 0, cases: 0 };
      x.cost += r.cost; x.recovered += r.recovered; x.penalty += r.penalty; x.cases += r.cases;
      g.set(k, x);
    }
    const groups = [...g.entries()].map(([k, v]) => ({ key: k, ...v, net: v.cost - v.recovered - v.penalty })).sort((a, b) => b.cost - a.cost);
    const max = Math.max(1, ...groups.map((x) => x.cost));
    const bars = groups.map((x) => ({ ...x, pct: (x.cost / max) * 100, netPct: (Math.max(0, x.net) / max) * 100, costLabel: faMoney(x.cost) }));
    const days: { label: string; v: number; pct: number }[] = [];
    for (let d = dayStart(c.s.from); d < c.s.to && days.length < 62; d += DAY) days.push({ label: faDM(d), v: rows.filter((r) => r.decidedAt !== null && dayStart(r.decidedAt) === d).reduce((s0, r) => s0 + r.cost, 0), pct: 0 });
    const undated = rows.filter((r) => r.decidedAt === null).reduce((s0, r) => s0 + r.cost, 0);
    const dmax = Math.max(1, ...days.map((d) => d.v), undated);
    for (const d of days) d.pct = (d.v / dmax) * 100;
    const pending = this.b.dispositions.filter((d) => c.ids.has(d.woId) && d.decision === 1);
    const total = rows.reduce((s0, r) => s0 + r.cost, 0);
    const recovered = rows.reduce((s0, r) => s0 + r.recovered, 0);
    const penalty = rows.reduce((s0, r) => s0 + r.penalty, 0);
    const pendingCost = pending.reduce((s0, d) => s0 + d.cost + d.penalty, 0);
    const top = groups[0];
    const narrative = total
      ? `هزینه‌ی کیفیت این بازه ${faMoney(total)} است که ${faMoney(recovered)} آن بازیافت و ${faMoney(penalty)} به‌عنوان جریمه از پیمانکار قابل‌وصول است. «${top.key}» با ${faPct((top.cost / total) * 100, 0)} بزرگ‌ترین سهم را دارد. ${faInt(pending.length)} تصمیم معوق به ارزش ${faMoney(pendingCost)} روی میز است.`
      : 'در این بازه هزینه‌ی کیفیتی ثبت نشده است.';
    return { bars, days, undated, undatedPct: (undated / dmax) * 100, total, recovered, penalty, net: total - recovered - penalty, pending, pendingCost, narrative };
  }

  materials(c: Ctx) {
    const gates = this.gates.filter((g) => c.ids.has(g.woId));
    const variance = this.b.variance
      .filter((v) => c.ids.has(v.woId) && v.standard > 0 && v.actual > 0 && v.min !== null && v.max !== null)
      .map((v) => ({ ...v, pct: (v.actual / v.standard) * 100, wo: this.byId.get(v.woId)?.wo ?? '' }))
      .filter((v) => v.pct < (v.min ?? 0) || v.pct > (v.max ?? 0))
      .map((v) => ({ ...v, label: `${faPct(v.pct, 1)} (مجاز ${faNum(v.min, 1)}–${faNum(v.max, 1)})`, over: v.pct > (v.max ?? 0) }));
    const excess = this.b.events.filter((e) => e.kind === 'EXCESS' && e.woId !== null && c.ids.has(e.woId) && e.t >= c.s.from && e.t < c.s.to);
    const unreturned = this.b.readiness.filter((r) => c.ids.has(r.woId) && r.excessNotReturned > 0);
    const recon = [
      ...this.b.reconReports.filter((r) => c.ids.has(r.woId) && r.exception && r.exception !== 5).map((r) => ({ wo: r.wo, what: `${r.report} — ${RECON_EXCEPTION[r.exception] ?? r.exception}`, detail: `گزارش ${faNum(r.reported)} · رسید ${faNum(r.received)} ${r.unit}`, woId: r.woId })),
      ...this.b.reconOutputs.filter((r) => c.ids.has(r.woId) && r.exception).map((r) => ({ wo: r.wo, what: `${r.product} — ${RECON_EXCEPTION[r.exception] ?? r.exception}`, detail: `انتظار ${faNum(r.expected)} · رسید ${faNum(r.received)} ${r.unit}`, woId: r.woId })),
    ];
    const proj = gates.filter((g) => g.projected);
    const narrative = [
      gates.length ? `${faInt(gates.length)} کسری مواد (${faInt(proj.length)} پیش‌بینی‌شده برای دستورهای کیت‌نشده)${gates[0] ? `؛ مهم‌ترین «${gates[0].product}» برای ${gates[0].wo} تا ${faDM(gates[0].arrival)} نمی‌رسد` : ''}.` : 'کسری مواد ثبت نشده است.',
      variance.length ? `${faInt(variance.length)} مصرف خارج از محدوده.` : '',
      excess.length ? `${faInt(excess.length)} درخواست مازاد در بازه.` : '',
      recon.length ? `${faInt(recon.length)} مغایرت رسید/خروجی.` : '',
    ].filter((x) => !!x).join(' ');
    return { gates, variance, excess, unreturned, recon, narrative };
  }

  outside(c: Ctx) {
    const subs = this.b.subcontract.filter((s0) => c.ids.has(s0.woId)).map((s0) => {
      const ctr = (this.evByWo.get(s0.woId) ?? []).filter((e) => e.kind === 'CTR' && (e.qty ?? 0) > 0);
      const drops: string[] = [];
      for (let i = 1; i < ctr.length; i++) if ((ctr[i].qty ?? 0) < (ctr[i - 1].qty ?? 0)) drops.push(`پیشرفت اعلامی از ${faInt(ctr[i - 1].qty)} به ${faInt(ctr[i].qty)} کاهش یافت (${faDM(ctr[i].t)})`);
      const gap = s0.progressWasted - s0.declaredWaste;
      return {
        ...s0, pct: s0.toComplete ? (s0.progressCompleted / s0.toComplete) * 100 : 0, recvPct: s0.toComplete ? (s0.receivedGood / s0.toComplete) * 100 : 0, drops,
        gap, gapLabel: gap ? `ضایعات اعلامی در پیشرفت ${faInt(s0.progressWasted)} ولی ضایعات اظهارشده ${faInt(s0.declaredWaste)} — ${faInt(Math.abs(gap))} قرص توضیح‌داده‌نشده` : '',
        ctr: ctr.map((e) => ({ t: faDMT(e.t), qty: faInt(e.qty), detail: e.detail })),
      };
    });
    const toll = c.orders.filter((f) => f.type === 6).map((f) => {
      const pend = this.b.dispositions.filter((d) => d.woId === f.id && d.decision === 1);
      return { id: f.id, wo: f.wo, customer: f.customer, pending: pend.length, pendingQty: pend.reduce((s0, d) => s0 + d.qty, 0), unit: f.unit, delay: f.forecastDelay };
    });
    const s0 = subs[0];
    const narrative = s0
      ? `${s0.contractor} برای ${s0.wo} ${faPct(s0.pct, 0)} کار را اعلام کرده و ${faInt(s0.receivedGood)} قرص سالم برگشته است؛ آمادگی ${faDM(s0.expectedReady)} یعنی ${faInt(s0.delayDays)} روز دیرتر از بازگشت قراردادی ${faDM(s0.expectedReturn)}.${s0.gap ? ' ' + faInt(Math.abs(s0.gap)) + ' قرص اختلاف ضایعات توضیح داده نشده است.' : ''}${toll.length ? ` ${faInt(toll.reduce((a, x) => a + x.pending, 0))} تصمیم کارمزدی به موافقت مشتری وابسته است.` : ''}`
      : toll.length ? `${faInt(toll.length)} دستور کارمزدی در دامنه است.` : 'در این دامنه کار بیرون از کارخانه نیست.';
    return { subs, toll, narrative };
  }

  // ───────── رادار مشکلات ─────────

  problems(c: Ctx, t: number, base: ForecastRow[]): Problem[] {
    const out: Problem[] = [];
    const seen = new Set<string>();
    const evid = (woId: number | null, kinds: EvKind[]) => (woId === null ? [] : (this.evByWo.get(woId) ?? []).filter((e) => e.t <= t && kinds.includes(e.kind)).slice(-5));
    const push = (p: Omit<Problem, 'score' | 'scoreTip' | 'ageH' | 'line' | 'lineId' | 'customer'> & { lineId?: number | null; customer?: string }) => {
      if (seen.has(p.key) || p.raisedAt > t) return;
      if (p.woId !== null && !c.ids.has(p.woId)) return;
      if (p.woId === null && c.filtered) return;
      seen.add(p.key);
      const f = p.woId !== null ? this.byId.get(p.woId) : undefined;
      const customer = p.customer ?? f?.customer ?? '';
      const ageH = Math.max(0, (t - p.raisedAt) / HOUR);
      const parts = [10 * p.sev, Math.min(30, p.money / 1e6), Math.min(30, (p.delayMin / 60) * 2), customer ? 10 : 0, Math.min(10, ageH / 6)];
      const score = Math.round(parts.reduce((a, b) => a + b, 0));
      out.push({
        ...p, lineId: p.lineId ?? f?.lineId ?? null, line: f ? shortLine(f.line) : '', customer, ageH, score,
        scoreTip: `شدت ${faInt(parts[0])} + پول ${faNum(parts[1], 1)} + تأخیر ${faNum(parts[2], 1)} + مشتری ${faInt(parts[3])} + سن ${faNum(parts[4], 1)} = ${faInt(score)}`,
      });
    };
    const meta: Record<number, { area: Area; m6: SixM; kinds: EvKind[]; decision: string; key: string }> = {
      1: { area: 'material', m6: 'material', kinds: ['EXCESS', 'KIT', 'REPORT'], decision: 'تأیید یا رد مصرف اضافه با علت ثبت‌شده؛ بازبینی تصحیح عیار', key: 'cons' },
      2: { area: 'plan', m6: 'method', kinds: ['STOP', 'CHANGE', 'DEVIATION'], decision: 'جابه‌جایی منبع یا اطلاع رسمی تأخیر به ذی‌نفع', key: 'late' },
      3: { area: 'quality', m6: 'method', kinds: ['NC', 'REPORT'], decision: 'بازبینی علت ضایعات و تصمیم درباره‌ی دوباره‌کاری مجدد', key: 'waste' },
      4: { area: 'prod', m6: 'machine', kinds: ['STOP', 'PARAM'], decision: 'تأمین فوری ست یدک یا انتقال کار به پرس دیگر', key: 'stop' },
      5: { area: 'material', m6: 'material', kinds: ['EXCESS', 'KIT', 'SHIFT'], decision: 'تأمین فوری از انبار/در راه یا تغییر توالی بسته‌بندی', key: 'short' },
      6: { area: 'plan', m6: 'machine', kinds: ['OP_START', 'STOP'], decision: 'حل هم‌پوشانی ایستگاه — جابه‌جایی یکی از دو دستور', key: 'ovl' },
      7: { area: 'data', m6: 'method', kinds: ['RECEIPT'], decision: 'بازبینی کندانسور و ثبت نرخ واقعی بازیابی', key: 'recov' },
      8: { area: 'data', m6: 'measure', kinds: ['RECEIPT', 'REPORT'], decision: 'تطبیق رسید و گزارش و اصلاح سند', key: 'rcpt' },
      9: { area: 'outside', m6: 'method', kinds: ['CTR', 'SHIP'], decision: 'پیگیری با پیمانکار و تصمیم درباره‌ی پیمانکار جایگزین', key: 'ctr' },
      10: { area: 'data', m6: 'measure', kinds: ['REPORT', 'RECEIPT'], decision: 'بازبینی موازنه‌ی جرم و اصلاح گزارش', key: 'bal' },
      11: { area: 'data', m6: 'measure', kinds: [], decision: 'همگام‌سازی ترمینال و بازبینی رکوردهای معوق', key: 'trm' },
    };
    for (const a of this.b.alerts) {
      const m = meta[a.ruleType] ?? { area: 'prod' as Area, m6: 'method' as SixM, kinds: [], decision: 'بررسی', key: 'al' };
      const prod = a.subject.split(' — ')[0];
      const key = a.ruleType === 5 || a.ruleType === 1 ? `${m.key}:${a.woId}:${prod}` : `${m.key}:${a.woId ?? a.key}`;
      push({
        key, source: `هشدار ${a.ruleCode}`, area: m.area, m6: m.m6, title: `${a.ruleTitle}: ${a.subject}`,
        story: `${a.wo || a.line || 'سامانه'} — ${a.detail}؛ اندازه ${faNum(a.measured, 1)} در برابر حد ${faNum(a.limit, 1)} ${a.unit}${a.escalated ? '؛ تشدید شده به ' + a.escOwner : ''}.`,
        owner: a.escalated ? a.escOwner : a.owner, decision: m.decision, woId: a.woId, wo: a.wo, sev: a.severity, money: 0,
        delayMin: a.ruleType === 2 || a.ruleType === 4 ? a.measured ?? 0 : a.ruleType === 9 ? (a.measured ?? 0) * 1440 : 0, raisedAt: a.raisedAt,
        evidence: evid(a.woId, m.kinds), escalated: a.escalated, lineId: null,
      });
    }
    for (const iv of this.stops.filter((x) => this.stopOpenAt(x, t))) {
      const f = this.byId.get(iv.woId);
      const mins = (Math.min(t, this.stopEnd(iv)) - iv.start) / MIN;
      push({
        key: `stop:${iv.woId}`, source: 'توقف باز', area: 'prod', m6: 'machine', title: `توقف ${iv.ev.wo}/${faInt(iv.ev.seq)}: ${iv.ev.detail}`,
        story: `${iv.ev.wo} از ${faHM(iv.start)} متوقف است (${faDur(mins)} تا این لحظه): ${iv.ev.detail}.`, owner: 'سرپرست نگهداری', decision: 'تعیین زمان رفع و مسیر جایگزین',
        woId: iv.woId, wo: f?.wo ?? '', sev: mins >= 30 ? 3 : 2, money: 0, delayMin: mins, raisedAt: iv.start, evidence: evid(iv.woId, ['STOP', 'PARAM']), escalated: false, lineId: iv.lineId,
      });
    }
    for (const d of this.b.deviations.filter((x) => x.caStatus !== 3)) {
      const overdue = d.caDue !== null && d.caDue < t;
      push({
        key: `dev:${d.id}`, source: 'انحراف / اقدام اصلاحی', area: d.typeCode === 1 ? 'quality' : 'plan', m6: 'method', title: `${d.cause} — ${d.wo}`,
        story: `برنامه ${d.planned}، واقعی ${d.actual}. اقدام «${d.caTitle}» (${d.caOwner}) ${CA_STATUS[d.caStatus ?? 1] ?? ''}${overdue ? '، سررسید ' + faDM(d.caDue) + ' گذشته' : d.caDue ? '، سررسید ' + faDM(d.caDue) : ''}.`,
        owner: d.caOwner, decision: overdue ? 'تعیین سررسید جدید اقدام اصلاحی و پاسخ‌گویی مسئول' : 'پیگیری اقدام اصلاحی', woId: d.woId, wo: d.wo, sev: overdue ? 3 : 2, money: 0,
        delayMin: overdue && d.caDue !== null ? (t - d.caDue) / MIN : 0, raisedAt: d.recordedAt, evidence: evid(d.woId, ['DEVIATION', 'STOP', 'NC']), escalated: false, lineId: null,
      });
    }
    for (const r of this.b.readiness.filter((x) => !x.canClose && x.status === 4)) {
      const why = [r.excessNotReturned ? `${faInt(r.excessNotReturned)} مازاد برنگشته` : '', r.unexecutedDispositions ? `${faInt(r.unexecutedDispositions)} تصمیم NC اجرانشده` : '', r.outputsNotReceived ? `${faInt(r.outputsNotReceived)} خروجی رسیدنشده` : '', r.pendingDispositions ? `${faInt(r.pendingDispositions)} NC منتظر تصمیم` : '', r.qcPending ? 'QC معوق' : '', r.consumptionMissing ? 'مصرف ثبت‌نشده' : '', r.opsOpen ? 'عملیات باز' : ''].filter((x) => !!x);
      push({
        key: `close:${r.woId}`, source: 'آمادگی بستن', area: 'data', m6: 'method', title: `${r.wo} تکمیل شده ولی قابل بستن نیست`, story: `${r.wo} از ${faDM(r.completedAt)} تکمیل شده؛ مانع: ${why.join('، ')}.`,
        owner: 'برنامه‌ریز تولید', decision: 'رفع مانع‌ها تا بستن دستور در همین هفته', woId: r.woId, wo: r.wo, sev: 1, money: 0, delayMin: 0, raisedAt: r.completedAt ?? NOW,
        evidence: evid(r.woId, ['COMPLETE', 'RECEIPT', 'NC']), escalated: false, lineId: null,
      });
    }
    for (const r of this.b.reconReports.filter((x) => x.exception && x.exception !== 5)) {
      push({
        key: `rcpt:${r.woId}`, source: 'تطبیق رسید', area: 'data', m6: 'measure', title: `${r.report}: ${RECON_EXCEPTION[r.exception] ?? ''}`,
        story: `گزارش ${faNum(r.reported)} ${r.unit} ولی رسید ${faNum(r.received)} — اختلاف ${faNum(Math.abs(r.difference))}.`, owner: 'کنترل موجودی', decision: 'اصلاح رسید یا گزارش',
        woId: r.woId, wo: r.wo, sev: 2, money: 0, delayMin: 0, raisedAt: r.reportedAt ?? NOW, evidence: evid(r.woId, ['RECEIPT', 'REPORT']), escalated: false, lineId: null,
      });
    }
    const outByWo = new Map<number, ReconOutputRow[]>();
    for (const r of this.b.reconOutputs.filter((x) => x.exception)) outByWo.set(r.woId, [...(outByWo.get(r.woId) ?? []), r]);
    for (const [woId, rs] of outByWo) {
      push({
        key: `rout:${woId}`, source: 'تطبیق خروجی', area: 'data', m6: 'measure', title: `${rs[0].wo}: ${faInt(rs.length)} خروجی جانبی رسید نشده`,
        story: `${RECON_EXCEPTION[rs[0].exception] ?? ''}: ${rs.map((r) => `${r.product} (انتظار ${faNum(r.expected)} ${r.unit})`).join('، ')}.`, owner: 'کنترل موجودی',
        decision: 'صدور رسید خروجی جانبی یا ثبت تلفات', woId, wo: rs[0].wo, sev: 1, money: 0, delayMin: 0, raisedAt: this.byId.get(woId)?.actComplete ?? NOW,
        evidence: evid(woId, ['RECEIPT', 'COMPLETE']), escalated: false, lineId: null,
      });
    }
    const pendByWo = new Map<number, DispositionRow[]>();
    for (const d of this.b.dispositions.filter((x) => x.decision === 1 && (this.dispTime.get(x.number) ?? NOW) <= t)) {
      const l = pendByWo.get(d.woId) ?? [];
      l.push(d);
      pendByWo.set(d.woId, l);
    }
    for (const [woId, ds] of pendByWo) {
      const f = this.byId.get(woId);
      const money = ds.reduce((a, d) => a + d.cost + d.penalty, 0);
      const cust = ds.some((d) => d.customerOwned) || f?.type === 6;
      push({
        key: `nc:${woId}`, source: 'عدم‌انطباق منتظر تصمیم', area: 'quality', m6: 'method', title: `${faInt(ds.length)} تصمیم NC معوق — ${f?.wo ?? ''}`,
        story: `${ds.map((d) => d.number).slice(0, 4).join('، ')}${ds.length > 4 ? '…' : ''} به ارزش ${faMoney(money)} منتظر تصمیم‌اند${cust ? '؛ بازیافت ماده‌ی مشتری فقط با موافقت مشتری' : ''}.`,
        owner: cust ? 'مدیر بازرگانی (موافقت مشتری)' : 'سرپرست کیفیت خط', decision: cust ? 'گرفتن موافقت کتبی مشتری برای بازیافت' : 'تصمیم: بازیافت، دوباره‌کاری یا اسقاط',
        woId, wo: f?.wo ?? '', sev: cust || money > 5e6 ? 2 : 1, money, delayMin: 0, raisedAt: Math.min(...ds.map((d) => this.dispTime.get(d.number) ?? NOW)),
        evidence: evid(woId, ['NC']), escalated: false, lineId: null,
      });
    }
    for (const v of this.materials(c).variance) {
      push({
        key: `cons:${v.woId}:${v.product.split(' — ')[0]}`, source: 'انحراف مصرف', area: 'material', m6: 'material', title: `مصرف ${v.product} ${v.over ? 'بیش' : 'کم'} از محدوده — ${v.wo}`,
        story: `مصرف واقعی ${faNum(v.actual, 2)} ${v.unit} در برابر استاندارد ${faNum(v.standard, 2)}: ${v.label}.`, owner: 'سرپرست تولید',
        decision: v.over ? 'بررسی علت مصرف اضافه' : 'بررسی کم‌مصرفی (کیفیت محصول یا ثبت ناقص مصرف)', woId: v.woId, wo: v.wo, sev: v.activeIngredient ? 3 : 2, money: 0, delayMin: 0,
        raisedAt: this.byId.get(v.woId)?.lastReportAt ?? NOW, evidence: evid(v.woId, ['REPORT', 'KIT', 'EXCESS']), escalated: false, lineId: null,
      });
    }
    for (const g of this.gates.filter((x) => !x.projected)) {
      const fr = base.find((r) => r.id === g.woId);
      push({
        key: `short:${g.woId}:${g.productCode}`, source: 'کسری مواد', area: 'material', m6: 'material', title: `کسری ${g.product} — ${g.wo}`,
        story: `${g.wo} ${faNum(g.need, 1)} ${g.unit} ${g.product} کسری ثبت‌شده دارد؛ رسیدن بعدی ${faDM(g.arrival)}${fr && fr.late ? ' — دستور را از سررسید عبور می‌دهد' : ''}.`,
        owner: 'برنامه‌ریز مواد', decision: 'تأمین فوری از انبار/در راه یا تغییر توالی', woId: g.woId, wo: g.wo, sev: fr && fr.late ? 3 : 2, money: 0,
        delayMin: fr && fr.late ? Math.max(0, -fr.slackH * 60) : 0, raisedAt: NOW, evidence: evid(g.woId, ['KIT', 'EXCESS', 'SHIFT']), escalated: false, lineId: null,
      });
    }
    const projByWo = new Map<number, MatGate[]>();
    for (const g of this.gates.filter((x) => x.projected)) projByWo.set(g.woId, [...(projByWo.get(g.woId) ?? []), g]);
    for (const [woId, gs] of projByWo) {
      const fr = base.find((r) => r.id === woId);
      const f = this.byId.get(woId);
      push({
        key: `proj:${woId}`, source: 'کسری پیش‌بینی‌شده', area: 'material', m6: 'material', title: `کسری پیش‌رو ${faInt(gs.length)} ماده برای ${gs[0].wo}`,
        story: `${gs[0].wo} (آزادسازی ${faDMT(f?.planRelease ?? null)}) هنوز کیت نشده و موجودی آزاد + رزرو کافی نیست: ${gs.map((g) => `${g.product} کم ${faNum(g.short, 1)} ${g.unit} (${g.arrival !== null ? 'رسیدن ' + faDM(g.arrival) : 'بدون تاریخ رسیدن'})`).join('، ')}${fr && fr.late ? ' — دستور از سررسید عبور می‌کند' : ''}.`,
        owner: 'برنامه‌ریز مواد', decision: 'تأمین فوری یا تعویق/ادغام دستورهای پیوسته تا رسیدن مواد', woId, wo: gs[0].wo, sev: fr && fr.late ? 3 : 2, money: 0,
        delayMin: fr && fr.late ? Math.max(0, -fr.slackH * 60) : 0, raisedAt: NOW,
        evidence: [...evid(woId, ['KIT', 'RELEASE']), ...this.b.events.filter((e) => e.kind === 'SHIFT' && e.t <= t && gs.some((g) => e.detail.includes(g.product.split(' ')[0])))],
        escalated: false, lineId: null,
      });
    }
    for (const s0 of this.b.subcontract.filter((x) => x.delayDays > 0 || x.overdue)) {
      push({
        key: `ctr:${s0.woId}`, source: 'پیمانکار', area: 'outside', m6: 'method', title: `${s0.contractor} — ${faInt(s0.delayDays)} روز تأخیر`,
        story: `آمادگی ${faDM(s0.expectedReady)} در برابر بازگشت ${faDM(s0.expectedReturn)}.`, owner: 'کارشناس برون‌سپاری', decision: 'پیگیری و تصمیم پیمانکار جایگزین',
        woId: s0.woId, wo: s0.wo, sev: 2, money: 0, delayMin: s0.delayDays * 1440, raisedAt: s0.progressAt ?? NOW, evidence: evid(s0.woId, ['CTR', 'SHIP']), escalated: false, lineId: null,
      });
    }
    for (const r of base.filter((x) => x.late)) {
      push({
        key: `due:${r.id}`, source: 'خطر تحویل', area: 'plan', m6: 'method', title: `${r.wo} پس از سررسید تمام می‌شود`,
        story: `پیش‌بینی مدل ${faDMT(r.end)} در برابر سررسید ${faDMT(r.due)} (${faHours(-r.slackH)} دیر): ${r.reasons.join('، ')}.`, owner: 'برنامه‌ریز تولید',
        decision: 'اولویت‌دهی منبع یا هماهنگی تاریخ تحویل جدید', woId: r.id, wo: r.wo, sev: -r.slackH > 24 ? 3 : 2, money: 0, delayMin: -r.slackH * 60, raisedAt: NOW,
        evidence: evid(r.id, ['STOP', 'CHANGE', 'RELEASE']), escalated: false, lineId: null,
      });
    }
    for (const e of this.b.events.filter((x) => x.kind === 'EXCESS' && x.sev >= 2)) {
      push({
        key: `exc:${e.woId}:${e.i}`, source: 'درخواست مازاد', area: 'material', m6: 'material', title: e.title, story: `${e.detail} — ${faNum(e.qty, 1)} واحد؛ ${faDMT(e.t)}.`,
        owner: 'سرپرست تولید', decision: 'تأیید یا رد درخواست مازاد', woId: e.woId, wo: e.wo, sev: e.sev, money: 0, delayMin: 0, raisedAt: e.t, evidence: [e], escalated: false, lineId: null,
      });
    }
    for (const ce of this.b.closeEvents.filter((x) => x.type === 3 && x.approval === 1)) {
      push({
        key: `reopen:${ce.id}`, source: 'درخواست بازگشایی', area: 'data', m6: 'method', title: `بازگشایی ${ce.wo} منتظر تأیید`, story: `${ce.by}: ${ce.reason} — منتظر ${ce.approver}.`,
        owner: ce.approver, decision: 'تأیید یا رد بازگشایی دستور بسته‌شده', woId: ce.woId, wo: ce.wo, sev: 2, money: 0, delayMin: 0, raisedAt: ce.at, evidence: evid(ce.woId, ['CLOSE']),
        escalated: false, lineId: null,
      });
    }
    for (const r of this.b.requests) {
      const issue = r.status === 2 ? 'منتظر تأیید' : r.status === 3 && r.ordered <= 0 ? 'تأییدشده ولی بدون دستور تولید' : r.status === 1 ? `پیش‌نویس مانده${r.description ? ' — ' + r.description : ''}` : '';
      if (!issue) continue;
      const soon = r.need !== null && r.need - NOW < 7 * DAY;
      push({
        key: `req:${r.id}`, source: 'درخواست تولید', area: 'plan', m6: 'method', title: `${r.number} — ${issue}`,
        story: `${r.product} ${faNum(r.qty)} ${r.unit} برای ${faDM(r.need)}${r.customer ? ' (' + r.customer + ')' : ''}؛ ${issue}.`, owner: 'سرپرست برنامه‌ریزی تولید',
        decision: r.status === 3 ? 'صدور دستور تولید یا تجمیع با دستور جاری' : r.status === 2 ? 'تأیید یا رد درخواست' : 'تصمیم درباره‌ی امکان‌پذیری', woId: null, wo: r.number,
        sev: soon ? 2 : 1, money: 0, delayMin: 0, raisedAt: r.date ?? NOW, customer: r.customer, evidence: this.b.events.filter((e) => e.ref === r.number && e.t <= t).slice(-4),
        escalated: false, lineId: null,
      });
    }
    return out.sort((x, y) => y.score - x.score);
  }

  groupProblems(ps: Problem[], by: 'area' | 'line' | 'order' | 'owner'): ProblemGroup[] {
    const g = new Map<string, Problem[]>();
    for (const p of ps) {
      const k = by === 'area' ? AREA_LABEL[p.area] : by === 'line' ? p.line || 'بدون خط' : by === 'order' ? p.wo || 'بدون دستور' : p.owner || '—';
      const l = g.get(k) ?? [];
      l.push(p);
      g.set(k, l);
    }
    return [...g.entries()].map(([key, items]) => ({ key, title: key, items, score: items.reduce((a, p) => a + p.score, 0) })).sort((a, b) => b.score - a.score);
  }

  // ───────── دستور جلسه ─────────

  agenda(c: Ctx, k: KpiCalc, wf: { planH: number; actualH: number }, problems: Problem[], base: ForecastRow[]): AgendaItem[] {
    const L = (text: string, tone: AgendaLine['tone'], woId: number | null = null, meta = ''): AgendaLine => ({ text, tone, woId, meta });
    const devs = this.b.deviations.filter((d) => c.ids.has(d.woId));
    const nextFrom = c.s.to;
    const watch = this.facts.filter((f) => f.status !== 6 && f.status !== 5 && f.due !== null && f.due >= nextFrom && f.due < nextFrom + 7 * DAY && (!c.filtered || c.ids.has(f.id)));
    const reqs = this.b.requests.filter((r) => r.need !== null && r.need >= nextFrom && r.need < nextFrom + 7 * DAY && r.status <= 3);
    const pend = this.b.dispositions.filter((d) => c.ids.has(d.woId) && d.decision === 1);
    const reopen = this.b.closeEvents.filter((x) => x.type === 3 && x.approval === 1 && c.ids.has(x.woId));
    const excess = this.b.events.filter((e) => e.kind === 'EXCESS' && e.woId !== null && c.ids.has(e.woId) && e.t >= c.s.from && e.t < c.s.to);
    const pendReq = this.b.requests.filter((r) => r.status === 2 || (r.status === 3 && r.ordered <= 0));
    const risky = base.filter((r) => r.late || r.slackH < 12).sort((a, b) => a.slackH - b.slackH);
    return [
      {
        id: 'week', no: 1, title: 'تصویر هفته در سه عدد', minutes: 5, visual: 'kpi', empty: '',
        lines: [
          L(`خروجی سالم ${faNum(k.earnedH, 1)} ساعت استاندارد${wf.planH ? ` — ${faPct((wf.actualH / wf.planH) * 100, 0)} برنامه‌ی سررسید بازه` : ''}`, 'info'),
          L(`دسترس‌پذیری تقریبی ${k.avail === null ? '—' : faPct(k.avail, 1)} (توقف ${faDur(k.stop)})`, k.avail !== null && k.avail < 85 ? 'warning' : 'success'),
          L(`هزینه‌ی کیفیت ${faMoney(k.ncCost)}`, 'danger'),
        ],
      },
      {
        id: 'problems', no: 2, title: 'مهم‌ترین مشکلات (بر پایه‌ی امتیاز اثر)', minutes: 15, visual: 'problems', empty: 'مشکلی نیست.',
        lines: distinctByOrder(problems, 5).map((p) => L(`${p.title}`, p.sev >= 3 ? 'danger' : 'warning', p.woId, `${p.owner} · پیشنهاد: ${p.decision} · امتیاز ${faInt(p.score)}`)),
      },
      {
        id: 'orders', no: 3, title: 'دستورهای دیر یا در خطر', minutes: 10, visual: 'risk', empty: 'همه‌ی دستورهای فعال پیش از سررسید تمام می‌شوند.',
        lines: risky.map((r) => L(`${r.wo} — پیش‌بینی ${faDMT(r.end)}، سررسید ${faDMT(r.due)}`, r.late ? 'danger' : 'warning', r.id, `حاشیه ${faHours(r.slackH)} · ${r.reasons.slice(-2).join('، ')}`)),
      },
      {
        id: 'ca', no: 4, title: 'اقدام‌های اصلاحی باز و معوق', minutes: 5, visual: 'ca', empty: 'اقدام اصلاحی بازی نیست.',
        lines: devs.map((d) => {
          const overdue = d.caStatus !== 3 && d.caDue !== null && d.caDue < NOW;
          return L(`${d.caTitle} (${d.wo})`, d.caStatus === 3 ? 'success' : overdue ? 'danger' : 'info', d.woId, `${d.caOwner} · ${CA_STATUS[d.caStatus ?? 1] ?? ''} · سررسید ${faDM(d.caDue)}${overdue ? ' — معوق' : ''}${d.caRef ? ' · ' + d.caRef : ''}`);
        }),
      },
      {
        id: 'decisions', no: 5, title: 'تصمیم‌های منتظر', minutes: 10, visual: 'decisions', empty: 'تصمیم معوقی نیست.',
        lines: [
          ...reopen.map((x) => L(`بازگشایی ${x.wo}: ${x.reason}`, 'warning', x.woId, `منتظر ${x.approver}`)),
          ...[...new Set(pend.map((d) => d.woId))].map((w) => {
            const ds = pend.filter((d) => d.woId === w);
            return L(`${faInt(ds.length)} تصمیم NC برای ${ds[0].wo}`, 'warning', w, `${faMoney(ds.reduce((a, d) => a + d.cost + d.penalty, 0))}${ds.some((d) => d.customerOwned) ? ' · نیاز به موافقت مشتری' : ''}`);
          }),
          ...excess.map((e) => L(`${e.title}`, e.sev >= 2 ? 'warning' : 'info', e.woId, `${e.detail} · ${faDMT(e.t)}`)),
          ...pendReq.map((r) => L(`${r.number} — ${REQ_ISSUE(r.status, r.ordered)}`, 'info', null, `${r.product} · نیاز ${faDM(r.need)}`)),
        ],
      },
      {
        id: 'watch', no: 6, title: 'فهرست پایش هفته‌ی بعد', minutes: 5, visual: 'watch', empty: 'سررسیدی در هفته‌ی بعد نیست.',
        lines: [
          ...watch.sort((a, b) => (a.due ?? 0) - (b.due ?? 0)).map((f) => {
            const r = base.find((x) => x.id === f.id);
            return L(`${f.wo} — ${f.title}`, r && r.late ? 'danger' : 'info', f.id, `سررسید ${faDMT(f.due)} · ${WO_STATUS[f.status]}${r ? ' · پیش‌بینی ' + faDMT(r.end) : ''}`);
          }),
          ...reqs.map((r) => L(`${r.number} — ${r.product}`, 'muted', null, `نیاز ${faDM(r.need)} · ${REQ_ISSUE(r.status, r.ordered)}`)),
        ],
      },
    ];
  }

  // ───────── مسیر سفارش ─────────

  journey(f: Fact, t: number): { lanes: JLane[]; ticks: JAxisTick[]; playX: number; nowX: number; dueX: number | null; dueOut: string; planX: number; planW: number; from: number; to: number } {
    const evs = this.evByWo.get(f.id) ?? [];
    const ops = this.opsByWo.get(f.id) ?? [];
    const starts = [f.planRelease, f.actRelease, f.firstStart, evs[0]?.t ?? null, ...ops.map((o) => o.planStart)].filter((x): x is number => x !== null);
    const ends = [f.planComplete, evs[evs.length - 1]?.t ?? null, NOW, ...ops.map((o) => o.planEnd)].filter((x): x is number => x !== null);
    let a = (starts.length ? Math.min(...starts) : NOW - DAY) - 2 * HOUR;
    let b = (ends.length ? Math.max(...ends) : NOW) + 3 * HOUR;
    // سررسید و پیش‌بینی فقط اگر نزدیک باشند پنجره را کش می‌دهند؛ وگرنه برچسب لبه می‌گیرند
    for (const v of [f.due, f.forecastEnd]) if (v !== null && v > b && v - b < DAY) b = v + 2 * HOUR;
    if (b - a < 6 * HOUR) b = a + 6 * HOUR;
    if (b - a > 30 * DAY) a = Math.max(a, b - 30 * DAY);
    const span = b - a;
    const x = (v: number) => clamp(((v - a) / span) * 100, 0, 100);
    const bar = (s0: number, e0: number, label: string, cls: string, tip: string, ev: Ev | null = null): JBar => ({ x: x(s0), w: Math.max(0.25, x(e0) - x(s0)), label, cls, tip, ev, point: false });
    const pt = (e: Ev): JBar => ({ x: x(e.t), w: 0, label: '', cls: `k-${e.kind.toLowerCase()}${e.t > t ? ' future' : ''}${e.sev >= 2 ? ' hot' : ''}`, tip: `${faDMT(e.t)} · ${e.title}`, ev: e, point: true });
    const plan: JBar[][] = ops.filter((o) => o.planStart !== null && o.planEnd !== null).map((o) => [bar(o.planStart ?? 0, o.planEnd ?? 0, `${faInt(o.seq)} ${o.title}`, 'plan', `برنامه ${faInt(o.seq)} ${o.title}: ${faDMT(o.planStart)} تا ${faDMT(o.planEnd)}`)]);
    const act: JBar[][] = ops.map((o) => {
      if (o.start === null || o.start > t) return [];
      const e0 = o.end !== null && o.end <= t ? o.end : Math.min(t, NOW);
      const cls = o.outsourced ? 'out' : o.end !== null && o.end <= t ? 'done' : o.status === 4 ? 'paused' : 'run';
      const st = o.outsourced ? 'برون‌سپاری' : o.end !== null && o.end <= t ? 'تکمیل' : o.status === 4 ? 'متوقف' : 'در جریان';
      return [bar(o.start, Math.max(e0, o.start + 10 * MIN), `${faInt(o.seq)} ${o.title}`, cls, `${faInt(o.seq)} ${o.title} (${o.resource || '—'}): ${faDMT(o.start)} تا ${o.end !== null && o.end <= t ? faDMT(o.end) : '…'} — ${st} · ${faNum(o.completed)} از ${faNum(o.toComplete)}`)];
    });
    const stops = evs.filter((e) => e.kind === 'STOP').map((e) => bar(e.t, e.t + (e.min ?? 0) * MIN, '', `stop${e.t > t ? ' future' : ''}`, `${faDMT(e.t)} توقف ${faDur(e.min ?? 0)}: ${e.detail}`, e));
    const lane = (kinds: EvKind[]) => [evs.filter((e) => kinds.includes(e.kind)).map(pt)];
    const lanes: JLane[] = [
      { key: 'plan', title: 'برنامه', rows: plan.length ? plan : [[]] },
      { key: 'ops', title: 'عملیات', rows: act.length ? act : [[]] },
      { key: 'evt', title: 'رخدادها', rows: [[...stops, ...evs.filter((e) => ['PARAM', 'CHANGE', 'DEVIATION', 'NC'].includes(e.kind)).map(pt)]] },
      { key: 'mat', title: 'مواد', rows: lane(['KIT', 'EXCESS']) },
      { key: 'qc', title: 'کیفیت و رسید', rows: lane(['RECEIPT', 'RELEASE', 'COMPLETE', 'CLOSE']) },
      { key: 'out', title: 'بیرون', rows: lane(['SHIP', 'CTR']) },
    ];
    const ticks: JAxisTick[] = [];
    const step = span <= 4 * DAY ? 6 * HOUR : DAY;
    for (let v = Math.ceil(a / step) * step; v <= b && ticks.length < 200; v += step) ticks.push({ x: x(v), label: v % DAY === 0 ? faDM(v) : faHM(v), major: v % DAY === 0 });
    const ps = f.planRelease;
    const pe = f.planComplete;
    return {
      lanes, ticks, playX: x(t), nowX: x(NOW), dueX: f.due !== null && f.due >= a && f.due <= b ? x(f.due) : null,
      dueOut: f.due !== null && f.due > b ? `سررسید ${faDMT(f.due)} ←` : f.due !== null && f.due < a ? `→ سررسید ${faDMT(f.due)}` : '', planX: ps !== null ? x(ps) : 0,
      planW: ps !== null && pe !== null ? Math.max(0, x(pe) - x(ps)) : 0, from: a, to: b,
    };
  }

  story(f: Fact, t: number, fr: ForecastRow | undefined): string[] {
    const evs = (this.evByWo.get(f.id) ?? []).filter((e) => e.t <= t);
    const out: string[] = [];
    out.push(`${f.wo} «${f.title}» — ${f.product}، ${faInt(f.qty)} ${f.unit}${f.customer ? ' برای ' + f.customer : ''}، ${shortLine(f.line)}، ${WO_TYPE[f.type] ?? ''}، سررسید ${faDMT(f.due)}.`);
    const rel = evs.find((e) => e.kind === 'RELEASE');
    if (rel) {
      const diff = f.planRelease !== null ? (rel.t - f.planRelease) / MIN : 0;
      out.push(`ساعت ${faHM(rel.t)} ${faDM(rel.t)} آزاد شد${Math.abs(diff) >= 30 ? ` (${faDur(Math.abs(diff))} ${diff > 0 ? 'دیرتر' : 'زودتر'} از برنامه)` : ''}.`);
    } else out.push(`تا ${faDMT(t)} آزاد نشده است${f.planRelease !== null ? `؛ آزادسازی برنامه‌ای ${faDMT(f.planRelease)}` : ''}.`);
    const ended = evs.filter((e) => e.kind === 'OP_END').length;
    const started = evs.filter((e) => e.kind === 'OP_START').length;
    if (started) out.push(`تا ${faDMT(t)} ${faInt(ended)} عملیات تمام شده و ${faInt(Math.max(0, started - ended))} عملیات باز است.`);
    const stops = evs.filter((e) => e.kind === 'STOP');
    if (stops.length) {
      const big = [...stops].sort((p, q) => (q.min ?? 0) - (p.min ?? 0))[0];
      const iv = this.stops.find((s0) => s0.ev === big);
      out.push(`${faInt(stops.length)} توقف با جمع ${faDur(stops.reduce((a, e) => a + (e.min ?? 0), 0))}؛ بزرگ‌ترین «${big.detail}» ${faDur(big.min ?? 0)} در عملیات ${faInt(big.seq)} ساعت ${faHM(big.t)}${iv && this.stopOpenAt(iv, t) ? ' — هنوز باز' : ''}.`);
    }
    const ds = this.b.dispositions.filter((d) => d.woId === f.id && (this.dispTime.get(d.number) ?? Infinity) <= t);
    if (ds.length) out.push(`${faInt(ds.length)} عدم‌انطباق به ارزش ${faMoney(ds.reduce((a, d) => a + d.cost, 0))} ثبت شد${ds.filter((d) => d.decision === 1).length ? `؛ ${faInt(ds.filter((d) => d.decision === 1).length)} مورد منتظر تصمیم` : ''}.`);
    const params = evs.filter((e) => e.kind === 'PARAM');
    if (params.length) out.push(`${faInt(params.length)} بار پارامتر از حد خارج شد (${params.map((e) => e.detail).join('؛ ')}).`);
    for (const e of evs.filter((x) => x.kind === 'CHANGE')) out.push(`${faDMT(e.t)}: ${e.title.split(' — ')[1] ?? e.title} (${e.detail}).`);
    for (const e of evs.filter((x) => x.kind === 'DEVIATION')) out.push(`انحراف ثبت شد: ${e.title.split('انحراف: ')[1] ?? e.title} — اقدام: ${e.detail}.`);
    const rc = evs.filter((e) => e.kind === 'RECEIPT');
    if (rc.length) out.push(`${faInt(rc.length)} رسید انبار صادر شد${rc.some((e) => e.detail.includes('قرنطینه')) ? ' (بخشی در قرنطینه)' : ''}.`);
    const ctr = evs.filter((e) => e.kind === 'CTR');
    if (ctr.length) out.push(`آخرین گزارش پیمانکار ${faDMT(ctr[ctr.length - 1].t)}: ${faInt(ctr[ctr.length - 1].qty)}${ctr[ctr.length - 1].detail ? ' — ' + ctr[ctr.length - 1].detail : ''}.`);
    const g = this.goodAt(f, t);
    out.push(`خروجی سالم تا این لحظه ${faNum(g)} ${f.unit} (${faPct((g / Math.max(1, f.qty)) * 100, 0)}).`);
    if (fr && Math.abs(t - NOW) < MIN) out.push(`پیش‌بینی مدل: پایان ${faDMT(fr.end)}، ${fr.late ? `${faHours(-fr.slackH)} پس از سررسید` : `${faHours(fr.slackH)} پیش از سررسید`}${fr.api !== null ? ` (پیش‌بینی سامانه ${faDMT(fr.api)})` : ''}.`);
    return out;
  }

  related(f: Fact): { parent: Fact | null; children: Fact[]; requests: { number: string; text: string }[] } {
    return {
      parent: f.refId !== null ? this.byId.get(f.refId) ?? null : null,
      children: this.facts.filter((x) => x.refId === f.id),
      requests: f.requests.map((no) => {
        const r = this.b.requests.find((x) => x.number === no);
        return { number: no, text: r ? `${faNum(r.qty)} ${r.unit} · نیاز ${faDM(r.need)}${r.customer ? ' · ' + r.customer : ''}` : '' };
      }),
    };
  }

  /** نوار چگالی رویداد (ساعتی، انباشته بر پایه‌ی شدت) */
  density(c: Ctx): { x: number; w: number; h: number[] }[] {
    const span = c.s.to - c.s.from;
    if (span <= 0) return [];
    const n = clamp(Math.ceil(span / HOUR), 1, 1500);
    const size = span / n;
    const buckets = Array.from({ length: n }, () => [0, 0, 0, 0]);
    for (const e of this.eventsIn(c, c.s.from, c.s.to - 1)) {
      const i = clamp(Math.floor((e.t - c.s.from) / size), 0, n - 1);
      buckets[i][clamp(e.sev, 0, 3)]++;
    }
    const max = Math.max(1, ...buckets.map((b0) => b0[0] + b0[1] + b0[2] + b0[3]));
    // ارتفاع کل = ریشه‌ی دوم چگالی (تا ساعت‌های کم‌رویداد هم دیده شوند)؛ سهم هر شدت متناسب
    return buckets.map((b0, i) => {
      const tot = b0[0] + b0[1] + b0[2] + b0[3];
      const hh = tot ? Math.sqrt(tot / max) * 100 : 0;
      return { x: (i / n) * 100, w: 100 / n, h: b0.map((v) => (tot ? (v / tot) * hh : 0)) };
    });
  }
}

/** پرامتیازترین مشکل هر دستور (برای دستور جلسه و ارائه: تنوع به‌جای تکرار یک دستور) */
export function distinctByOrder(ps: Problem[], n: number): Problem[] {
  const seen = new Set<string>();
  const out: Problem[] = [];
  for (const p of ps) {
    const k = p.wo || p.key;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= n) break;
  }
  return out;
}

const REQ_ISSUE = (status: number, ordered: number): string => (status === 2 ? 'منتظر تأیید' : status === 3 && ordered <= 0 ? 'بدون دستور تولید' : status === 1 ? 'پیش‌نویس' : '');

