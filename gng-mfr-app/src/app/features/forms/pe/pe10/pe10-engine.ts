/**
 * موتور محاسبه‌ی FRM-PE-10 — تابع خالص روی بسته‌ی داده؛ بدون Angular. همه‌ی فضاها (سلامت، بسط، موج اثر، دقت، ECO، بدهی)
 * از همین شاخص‌ها مشتق می‌شوند تا تغییر دامنه یا شبیه‌سازی بدون فراخوانی دوباره‌ی سرور باشد.
 */
import {
  CHECKS, COUNT_UNITS, DAY, ECO_POLICY, ECO_STATUS, NOW, Pe10Bundle, PeCheck, PeConsumption, PeEco, PeItem, PeProduct, PeStructure, faDM, healthColor, severityWeight,
} from '../frm-pe-10.data';
import { faInt, faNum } from '../../pc/pc-shared';

// ───────── شکل‌های خروجی ─────────
export interface Scope { groups: string[]; productId: number | null; types: number[]; statuses: number[] }
export interface CheckView { code: string; title: string; owner: string; why: string; form: string; passed: boolean; severity: number; detail: string; entity: string }
export interface Health { score: number | null; pass: number; fail: number; critical: number; checks: CheckView[] }

export interface StarNode {
  id: number; x: number; y: number; r: number; color: string; score: number | null; code: string; title: string; group: string; role: string;
  dim: boolean; critical: boolean; reach: number; tip: string;
}
export interface StarEdge { a: number; b: number; x1: number; y1: number; x2: number; y2: number }
export interface Cluster { label: string; x: number; y: number; r: number; ly: number }

export interface RiskFlags { stock: 0 | 1 | 2; single: boolean; noSub: boolean; quality: boolean; ai: boolean; customer: boolean }
export interface XNode {
  key: string; parentKey: string; level: number; productId: number; code: string; title: string; unit: string; req: number | null;
  phantom: boolean; child: string | null; cycle: boolean; leaf: boolean; seq: number; subGroup: string | null; flags: RiskFlags; risk: number; note: string;
}
export interface LeafReq { productId: number; code: string; title: string; unit: string; req: number; free: number; batches: number | null; tone: string }

export interface SubOption {
  groupId: number; groupCode: string; groupTitle: string; optionNo: number; title: string; priority: number | null;
  members: { productId: number; code: string; title: string; unit: string; ratio: number; onHand: number }[];
  linked: string[]; feasible: number; origRatio: number;
}
export interface RippleOpts { optionByGroup: Record<number, number | null>; acceptEcos: number[]; includeTransit: boolean }
export interface RippleRow {
  woId: number; wo: string; due: number | null; mainCode: string; mainTitle: string; structure: string; opSeq: number; need: number;
  fromStock: number; fromTransit: number; fromSub: number; subLabel: string; short: number; state: 'ok' | 'sub' | 'partial' | 'blocked';
}
export interface RippleLevel { level: number; structures: { id: number; code: string; title: string; product: string; openOrders: number }[] }
export interface RippleEco { eco: PeEco; why: string; effect: string; accepted: boolean }
export interface RippleResult {
  material: PeProduct; pool: number; transit: number; poolNote: string; daily: number; coverDays: number | null; openNeed: number; rows: RippleRow[];
  blocked: number; partial: number; levels: RippleLevel[];
  downstream: { wo: string; product: string; need: number; unit: string; state: 'risk' | 'ok'; reason: string }[];
  requests: { number: string; product: string; need: number | null; qty: number; unit: string; state: 'risk' | 'ok'; reason: string }[];
  options: SubOption[]; ecos: RippleEco[]; narrative: string;
}

export interface TruthSample { wo: string; ratio: number; corrected: boolean }
export interface TruthRow {
  key: string; structureCode: string; code: string; title: string; unit: string; roleTitle: string; stdQty: number; stdLabel: string; n: number;
  mean: number; min: number; max: number; sd: number; bias: number; lo: number | null; hi: number | null; samples: TruthSample[];
  verdict: 'over' | 'under' | 'ok' | 'noisy' | 'few' | 'gap'; w: number; suggested: number | null; confidence: 'زیاد' | 'متوسط' | 'کم'; gaps: string[];
  substituted: string[]; ai: boolean;
}
export interface YieldTruth {
  key: string; structureCode: string; product: string; type: number; std: number; min: number | null; max: number | null; samples: { wo: string; v: number }[]; missing: string[];
  mean: number; delta: number; verdict: 'over' | 'under' | 'ok' | 'none';
}

export interface EcoView {
  eco: PeEco; open: boolean; ageDays: number; waiting: string; effLabel: string; daysToEffect: number | null; policy: string;
  direct: { id: number; code: string; title: string }[]; structures: { id: number; code: string; level: number }[];
  orders: { wo: string; product: string }[]; stock: { code: string; title: string; qty: number; unit: string; atRisk: boolean }[]; issues: string[];
}

export interface Defect {
  key: string; code: string; title: string; owner: string; form: string; severity: number; entity: string; entityType: string; detail: string;
  impact: number; reach: number; reachNote: string; productId: number | null; structureId: number | null;
}
export interface DefectGroup { key: string; title: string; impact: number; items: Defect[] }

const EPS = 1e-6;
const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);

export class Pe10Engine {
  readonly prod = new Map<number, PeProduct>();
  readonly st = new Map<number, PeStructure>();
  readonly itemsBy = new Map<number, PeItem[]>();
  /** کالا ← ساختارهایی که در نسخه‌ی جاری مصرفش می‌کنند */
  readonly usedIn = new Map<number, Set<number>>();
  readonly structuresOf = new Map<number, PeStructure[]>();
  readonly groupOptions = new Map<number, Map<number, { title: string; priority: number | null; members: { productId: number; ratio: number }[] }>>();
  readonly groupInfo = new Map<number, { code: string; title: string; combinable: boolean }>();
  readonly groupsOfOriginal = new Map<number, number[]>();
  readonly groups: string[];
  private readonly wuCache = new Map<number, { id: number; level: number }[]>();
  private readonly healthCache = new Map<string, Health>();

  constructor(readonly b: Pe10Bundle) {
    for (const p of b.products) this.prod.set(p.id, p);
    for (const s of b.structures) {
      this.st.set(s.id, s);
      if (s.productId !== null) this.structuresOf.set(s.productId, [...(this.structuresOf.get(s.productId) ?? []), s]);
    }
    for (const it of b.items) {
      this.itemsBy.set(it.structureId, [...(this.itemsBy.get(it.structureId) ?? []), it]);
      if (!this.usedIn.has(it.productId)) this.usedIn.set(it.productId, new Set());
      this.usedIn.get(it.productId)?.add(it.structureId);
    }
    for (const m of b.substitutes) {
      if (!this.groupOptions.has(m.groupId)) this.groupOptions.set(m.groupId, new Map());
      this.groupInfo.set(m.groupId, { code: m.groupCode, title: m.groupTitle, combinable: m.combinable });
      const opts = this.groupOptions.get(m.groupId) ?? new Map();
      const o = opts.get(m.optionNo) ?? { title: m.optionTitle, priority: m.priority, members: [] };
      o.members.push({ productId: m.productId, ratio: m.ratio });
      opts.set(m.optionNo, o);
      if (m.optionNo === 0) this.groupsOfOriginal.set(m.productId, [...new Set([...(this.groupsOfOriginal.get(m.productId) ?? []), m.groupId])]);
    }
    const order = (g: string): number => Math.min(...b.products.filter((p) => p.group === g).map((p) => p.role ?? 9));
    this.groups = [...new Set(b.products.filter((p) => this.isStar(p)).map((p) => p.group))].sort((x, y) => order(x) - order(y) || x.localeCompare(y));
  }

  p(id: number | null | undefined): PeProduct | undefined {
    return id === null || id === undefined ? undefined : this.prod.get(id);
  }

  label(id: number | null | undefined): string {
    const p = this.p(id);
    return p ? `${p.code} ${p.title}` : '—';
  }

  /** ستاره‌ی صورت‌فلکی: کالای دارای نقش تولیدی یا به‌کاررفته در ساختار */
  isStar(p: PeProduct): boolean {
    return p.role !== null || this.usedIn.has(p.id) || this.structuresOf.has(p.id);
  }

  // ───────── دامنه ─────────
  isAll(s: Scope): boolean {
    return !s.groups.length && s.productId === null && !s.types.length && !s.statuses.length;
  }

  scopeStructures(s: Scope): PeStructure[] {
    return this.b.structures.filter(
      (x) =>
        (!s.groups.length || s.groups.includes(this.p(x.productId)?.group ?? '')) &&
        (s.productId === null || x.productId === s.productId) &&
        (!s.types.length || s.types.includes(x.type)) &&
        (!s.statuses.length || s.statuses.includes(x.status))
    );
  }

  /** کالاهای دامنه: محصول اصلی ساختارهای دامنه + همه‌ی اجزای بسط آن‌ها (+ کالاهای گروه انتخاب‌شده). null = همه */
  scopeProducts(s: Scope): Set<number> | null {
    if (this.isAll(s)) return null;
    const out = new Set<number>();
    const visit = (sid: number, seen: Set<number>): void => {
      if (seen.has(sid)) return;
      seen.add(sid);
      for (const it of this.itemsBy.get(sid) ?? []) {
        out.add(it.productId);
        if (it.childStructureId !== null) visit(it.childStructureId, seen);
      }
    };
    for (const x of this.scopeStructures(s)) {
      if (x.productId !== null) out.add(x.productId);
      visit(x.id, new Set());
    }
    if (s.groups.length && s.productId === null && !s.types.length && !s.statuses.length)
      for (const p of this.b.products) if (s.groups.includes(p.group)) out.add(p.id);
    if (s.productId !== null) out.add(s.productId);
    return out;
  }

  // ───────── کاربرد معکوس چندسطحی (نسخه‌ی جاری؛ همان منطق mes.GetWhereUsed) ─────────
  whereUsed(productId: number): { id: number; level: number }[] {
    const hit = this.wuCache.get(productId);
    if (hit) return hit;
    const res = new Map<number, number>();
    const seen = new Set<number>([productId]);
    let frontier = [productId];
    for (let lvl = 1; lvl <= 10 && frontier.length; lvl++) {
      const next: number[] = [];
      for (const pid of frontier)
        for (const sid of this.usedIn.get(pid) ?? []) {
          if (!res.has(sid)) res.set(sid, lvl);
          const main = this.st.get(sid)?.productId;
          if (main !== null && main !== undefined && !seen.has(main)) {
            seen.add(main);
            next.push(main);
          }
        }
      frontier = next;
    }
    const out = [...res.entries()].map(([id, level]) => ({ id, level })).sort((a, c) => a.level - c.level);
    this.wuCache.set(productId, out);
    return out;
  }

  // ───────── سلامت ─────────
  private view(c: PeCheck): CheckView {
    const d = CHECKS[c.code] ?? { title: c.code, owner: '—', why: '' };
    return { code: c.code, title: d.title, owner: d.owner, why: d.why, form: c.form, passed: c.passed, severity: c.severity, detail: c.detail, entity: `${c.entityCode} ${c.entityTitle}` };
  }

  private health(list: PeCheck[]): Health {
    const w = sum(list.map((c) => severityWeight(c.severity)));
    const ok = sum(list.filter((c) => c.passed).map((c) => severityWeight(c.severity)));
    const checks = list.map((c) => this.view(c)).sort((a, c) => Number(a.passed) - Number(c.passed) || c.severity - a.severity);
    return {
      score: w > 0 ? Math.round((100 * ok) / w) : null, pass: list.filter((c) => c.passed).length, fail: list.filter((c) => !c.passed).length,
      critical: list.filter((c) => !c.passed && c.severity >= 3).length, checks,
    };
  }

  productHealth(pid: number): Health {
    const k = `p${pid}`;
    const hit = this.healthCache.get(k);
    if (hit) return hit;
    const h = this.health(this.b.checks.filter((c) => c.productId === pid));
    this.healthCache.set(k, h);
    return h;
  }

  structureHealth(sid: number): Health {
    const k = `s${sid}`;
    const hit = this.healthCache.get(k);
    if (hit) return hit;
    const main = this.st.get(sid)?.productId ?? null;
    const h = this.health(this.b.checks.filter((c) => c.structureId === sid || (c.entityType === 'PRODUCT' && main !== null && c.productId === main)));
    this.healthCache.set(k, h);
    return h;
  }

  requestsOf(pid: number): number {
    return this.b.requests.filter((r) => r.productId === pid).length;
  }

  reachOf(pid: number): number {
    const p = this.p(pid);
    return this.whereUsed(pid).length + (p?.openOrders ?? 0) + this.requestsOf(pid) + (this.structuresOf.get(pid) ?? []).reduce((a, s) => a + s.openOrders, 0);
  }

  // ───────── ۱) صورت‌فلکی ─────────
  constellation(scope: Scope): { nodes: StarNode[]; edges: StarEdge[]; clusters: Cluster[] } {
    const inScope = this.scopeProducts(scope);
    const W = 1000;
    const H = 600;
    const groups = this.groups;
    const clusters: Cluster[] = [];
    const nodes: StarNode[] = [];
    const pos = new Map<number, StarNode>();
    groups.forEach((g, gi) => {
      // مراکز خوشه‌ها روی بیضی، از راست و ساعت‌گرد
      const ang = -Math.PI / 2 + Math.PI / 2 + (gi / groups.length) * 2 * Math.PI;
      const cx = W / 2 + Math.cos(ang) * 375;
      const cy = H / 2 + Math.sin(ang) * 205;
      const members = this.b.products.filter((p) => p.group === g && this.isStar(p)).sort((a, c) => this.reachOf(c.id) - this.reachOf(a.id) || a.code.localeCompare(c.code));
      const r = 30 + 15 * Math.sqrt(members.length);
      clusters.push({ label: g, x: cx, y: cy, r, ly: cy + r + 14 });
      members.forEach((p, k) => {
        // آرایش آفتابگردانی (زاویه‌ی طلایی): پرکاربردترها نزدیک مرکز خوشه
        const a = k * 2.39996;
        const d = k === 0 ? 0 : 17 * Math.sqrt(k + 0.4);
        const h = this.productHealth(p.id);
        const reach = this.reachOf(p.id);
        const n: StarNode = {
          id: p.id, x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: 3.4 + 1.9 * Math.sqrt(reach), color: healthColor(h.score), score: h.score, code: p.code,
          title: p.title, group: g, role: p.role !== null ? (ROLE_SHORT[p.role] ?? '') : 'بدون نقش', dim: inScope !== null && !inScope.has(p.id),
          critical: h.critical > 0, reach,
          tip: `${p.code} ${p.title} — سلامت ${h.score === null ? 'ارزیابی‌نشده' : faInt(h.score)} · ${faInt(h.fail)} نقص · دامنه‌ی اثر ${faInt(reach)}`,
        };
        nodes.push(n);
        pos.set(p.id, n);
      });
    });
    const edges: StarEdge[] = [];
    const seen = new Set<string>();
    for (const s of this.b.structures) {
      if (s.productId === null || s.type === 3) continue;
      const a = pos.get(s.productId);
      if (!a) continue;
      for (const it of this.itemsBy.get(s.id) ?? []) {
        const c = pos.get(it.productId);
        const k = `${s.productId}-${it.productId}`;
        if (!c || seen.has(k)) continue;
        seen.add(k);
        edges.push({ a: s.productId, b: it.productId, x1: a.x, y1: a.y, x2: c.x, y2: c.y });
      }
    }
    return { nodes, edges, clusters };
  }

  // ───────── ۲) پرتونگاری: بسط چندسطحی (همان قاعده‌ی mes.ExplodeStructure) ─────────
  explode(sid: number, qty: number, applyWaste = true): XNode[] {
    const out: XNode[] = [];
    const walk = (structureId: number, required: number, parentKey: string, level: number, path: number[]): void => {
      const s = this.st.get(structureId);
      const base = s?.baseQty ?? null;
      for (const it of [...(this.itemsBy.get(structureId) ?? [])].sort((a, c) => a.seq - c.seq)) {
        const p = this.p(it.productId);
        const f = base ? required / base : null;
        let req: number | null = null;
        if (it.qtyAtBase !== null && f !== null)
          req = it.qtyAtBase * f * (applyWaste ? 1 + (it.wastePct ?? 0) / 100 : 1) + (applyWaste ? (it.wasteQty ?? 0) * f : 0);
        if (req !== null && p && COUNT_UNITS.includes(p.unit)) req = Math.ceil(req - 1e-9);
        const cycle = path.includes(it.productId);
        const key = `${parentKey}/${it.productId}-${it.seq}`;
        const childId = it.childStructureId;
        const leaf = childId === null || cycle;
        const flags = this.flags(it, p, req);
        out.push({
          key, parentKey, level, productId: it.productId, code: p?.code ?? '?', title: p?.title ?? '?', unit: p?.unit ?? '', req, phantom: !!p?.phantom,
          child: childId !== null ? (this.st.get(childId)?.code ?? null) : null, cycle, leaf, seq: it.seq,
          subGroup: it.subGroupId !== null ? (this.groupInfo.get(it.subGroupId)?.code ?? null) : null, flags,
          risk: (flags.stock === 2 ? 3 : flags.stock) + Number(flags.single) + Number(flags.noSub) + Number(flags.quality),
          note: it.qtyType === 3 ? 'فرمولی' : it.qs ? 'q.s.' : it.qtyType === 4 ? `${faNum(it.qty, 2)}٪` : '',
        });
        if (!leaf && req !== null && level < 12) walk(childId as number, req, key, level + 1, [...path, it.productId]);
      }
    };
    const s = this.st.get(sid);
    walk(sid, qty, '', 1, s?.productId ? [s.productId] : []);
    return out;
  }

  private flags(it: PeItem, p: PeProduct | undefined, req: number | null): RiskFlags {
    const free = p ? Math.max(0, p.onHand - p.reserved) : 0;
    const cover = req && req > 0 ? free / req : 99;
    const purchased = p?.role === 3 || p?.role === 4;
    return {
      stock: cover < 1 ? 2 : cover < 2 ? 1 : 0,
      single: !!p && purchased && p.buy + p.outsource <= 1 && it.subGroupId === null && !p.hasRecovered,
      noSub: !!p && p.role === 3 && !it.ai && !it.qs && it.qty > 0 && it.subGroupId === null,
      quality: !!p && (p.quarantine + p.rejected + p.expired > 0 || (p.nearestExpiry !== null && p.nearestExpiry - NOW < 60 * DAY)),
      ai: it.ai,
      customer: !!p && p.customerOwned > 0,
    };
  }

  /**
   * جمع نیاز مواد برگ. net = true: نیمه‌ساخته‌ای که موجودی آزادش نیاز را می‌پوشاند خودش «برگ» حساب می‌شود و بسط نمی‌شود
   * (برای «چند بچ با موجودی امروز ساختنی است»)؛ net = false همان نیاز ناخالص mes.ExplodeStructure است.
   */
  leafTotals(nodes: XNode[], net = false): LeafReq[] {
    const m = new Map<number, number>();
    const kids = new Map<string, XNode[]>();
    for (const n of nodes) kids.set(n.parentKey, [...(kids.get(n.parentKey) ?? []), n]);
    const take = (n: XNode): void => {
      if (n.req === null) return;
      const p = this.p(n.productId);
      const covered = net && !n.leaf && !!p && !p.phantom && Math.max(0, p.onHand - p.reserved) >= n.req;
      if (n.leaf || covered) m.set(n.productId, (m.get(n.productId) ?? 0) + n.req);
      else for (const c of kids.get(n.key) ?? []) take(c);
    };
    for (const n of kids.get('') ?? []) take(n);
    return [...m.entries()]
      .map(([pid, req]) => {
        const p = this.p(pid);
        const free = p ? Math.max(0, p.onHand - p.reserved) : 0;
        const batches = req > 0 ? free / req : null;
        return {
          productId: pid, code: p?.code ?? '', title: p?.title ?? '', unit: p?.unit ?? '', req, free, batches,
          tone: batches === null ? 'muted' : batches < 1 ? 'danger' : batches < 2 ? 'warning' : 'success',
        };
      })
      .sort((a, c) => (a.batches ?? 1e9) - (c.batches ?? 1e9));
  }

  // ───────── ۳) اگر این ماده نرسد ─────────
  /** مواد قابل‌بررسی: اجزای ساختارها، به ترتیب کمترین پوشش روز */
  materialList(scope: Scope): { id: number; label: string; days: number | null; tone: string }[] {
    const inScope = this.scopeProducts(scope);
    return [...this.usedIn.keys()]
      .map((id) => this.p(id))
      .filter((p): p is PeProduct => !!p && (inScope === null || inScope.has(p.id)))
      .map((p) => {
        const days = this.coverDays(p);
        return { id: p.id, label: `${p.code} ${p.title}`, days, tone: days === null ? 'muted' : days < 3 ? 'danger' : days < 10 ? 'warning' : 'success' };
      })
      .sort((a, c) => (a.days ?? 1e9) - (c.days ?? 1e9) || a.label.localeCompare(c.label));
  }

  /** مصرف روزانه = بیشینه‌ی (مصرف ۱۴ روز گذشته ÷ ۱۴) و (نیاز باز ÷ افق تا آخرین سررسید، حداقل ۷ روز) */
  dailyDemand(p: PeProduct): number {
    const rows = this.b.orders.filter((r) => r.productId === p.id);
    const lastDue = Math.max(NOW, ...rows.map((r) => r.due ?? NOW));
    const horizon = Math.max(7, (lastDue - NOW) / DAY);
    return Math.max(p.consumed14 / 14, p.openReq / horizon);
  }

  coverDays(p: PeProduct): number | null {
    const d = this.dailyDemand(p);
    return d > EPS ? p.onHand / d : null;
  }

  ecosTouching(pid: number): { eco: PeEco; why: string }[] {
    const out: { eco: PeEco; why: string }[] = [];
    for (const e of this.b.ecos) {
      const its = this.b.ecoItems.filter((i) => i.ecoId === e.id);
      const why: string[] = [];
      if (its.some((i) => i.productId === pid)) why.push('خود کالا در دامنه است');
      for (const i of its) if (i.groupId !== null && (this.groupsOfOriginal.get(pid) ?? []).includes(i.groupId)) why.push(`گروه ${this.groupInfo.get(i.groupId)?.code ?? ''}`);
      for (const i of its) if (i.structureId !== null && this.usedIn.get(pid)?.has(i.structureId)) why.push(`ساختار ${this.st.get(i.structureId)?.code ?? ''}`);
      if (why.length) out.push({ eco: e, why: [...new Set(why)].join('، ') });
    }
    return out;
  }

  subOptions(pid: number): SubOption[] {
    const out: SubOption[] = [];
    for (const g of this.groupsOfOriginal.get(pid) ?? []) {
      const opts = this.groupOptions.get(g);
      const info = this.groupInfo.get(g);
      if (!opts || !info) continue;
      const origRatio = opts.get(0)?.members.find((m) => m.productId === pid)?.ratio ?? 1;
      const linked = this.b.items.filter((i) => i.productId === pid && i.subGroupId === g).map((i) => this.st.get(i.structureId)?.code ?? '');
      for (const [no, o] of [...opts.entries()].filter(([k]) => k > 0).sort((a, c) => (a[1].priority ?? 99) - (c[1].priority ?? 99) || a[0] - c[0])) {
        const members = o.members.map((m) => {
          const mp = this.p(m.productId);
          return { productId: m.productId, code: mp?.code ?? '', title: mp?.title ?? '', unit: mp?.unit ?? '', ratio: m.ratio, onHand: mp?.onHand ?? 0 };
        });
        const feasible = Math.min(...members.map((m) => (m.ratio > 0 ? m.onHand / m.ratio : 0))) * origRatio;
        out.push({ groupId: g, groupCode: info.code, groupTitle: info.title, optionNo: no, title: o.title, priority: o.priority, members, linked: [...new Set(linked)], feasible, origRatio });
      }
    }
    return out;
  }

  ripple(pid: number, opts: RippleOpts): RippleResult | null {
    const M = this.p(pid);
    if (!M) return null;
    const touching = this.ecosTouching(pid);
    const accepted = touching.filter((t) => opts.acceptEcos.includes(t.eco.id) && t.eco.status !== 5 && t.eco.status !== 6);
    const discard = accepted.some((t) => t.eco.policy === 2);
    const forced: Record<number, number> = {};
    for (const t of accepted)
      for (const i of this.b.ecoItems.filter((x) => x.ecoId === t.eco.id && x.groupId !== null)) {
        const g = i.groupId as number;
        if (!(this.groupsOfOriginal.get(pid) ?? []).includes(g)) continue;
        const top = [...(this.groupOptions.get(g)?.entries() ?? [])].filter(([k]) => k > 0).sort((a, c) => (a[1].priority ?? 99) - (c[1].priority ?? 99) || a[0] - c[0])[0];
        if (top) forced[g] = top[0];
      }
    let pool = discard ? 0 : M.onHand;
    let transit = opts.includeTransit ? M.inTransit : 0;
    const memberPool = new Map<number, number>();
    const rows: RippleRow[] = [];
    const demand = this.b.orders.filter((r) => r.productId === pid).sort((a, c) => (a.due ?? 9e15) - (c.due ?? 9e15) || a.wo.localeCompare(c.wo));
    for (const r of demand) {
      const need = r.remaining;
      const fromStock = Math.min(pool, need);
      pool -= fromStock;
      let rem = need - fromStock;
      let fromTransit = 0;
      if (rem > EPS && transit > EPS && M.nextArrival !== null && (r.due === null || M.nextArrival <= r.due)) {
        fromTransit = Math.min(transit, rem);
        transit -= fromTransit;
        rem -= fromTransit;
      }
      let fromSub = 0;
      let subLabel = '';
      const g = r.subGroupId;
      const optNo = g !== null ? (opts.optionByGroup[g] ?? forced[g] ?? null) : null;
      if (rem > EPS && g !== null && optNo !== null && (this.groupsOfOriginal.get(pid) ?? []).includes(g)) {
        const o = this.groupOptions.get(g)?.get(optNo);
        const origRatio = this.groupOptions.get(g)?.get(0)?.members.find((m) => m.productId === pid)?.ratio ?? 1;
        if (o) {
          const reqs = o.members.map((m) => ({ id: m.productId, q: (rem / origRatio) * m.ratio }));
          for (const q of reqs) if (!memberPool.has(q.id)) memberPool.set(q.id, this.p(q.id)?.onHand ?? 0);
          const frac = Math.min(1, ...reqs.map((q) => (q.q > EPS ? (memberPool.get(q.id) ?? 0) / q.q : 1)));
          for (const q of reqs) memberPool.set(q.id, (memberPool.get(q.id) ?? 0) - q.q * frac);
          fromSub = rem * frac;
          rem -= fromSub;
          subLabel = `${o.title}: ${reqs.map((q) => `${faNum(q.q * frac, 2)} ${this.p(q.id)?.unit ?? ''} ${this.p(q.id)?.code ?? ''}`).join(' + ')}`;
        }
      }
      const mp = this.p(r.mainProductId);
      rows.push({
        woId: r.woId, wo: r.wo, due: r.due, mainCode: mp?.code ?? '', mainTitle: mp?.title ?? '', structure: r.structureId !== null ? (this.st.get(r.structureId)?.code ?? '') : '—',
        opSeq: r.opSeq, need, fromStock, fromTransit, fromSub, subLabel, short: Math.max(0, rem),
        state: rem <= EPS ? (fromSub > EPS ? 'sub' : 'ok') : rem < need - EPS ? 'partial' : 'blocked',
      });
    }
    const blockedWo = new Set(rows.filter((x) => x.state === 'blocked').map((x) => x.woId));
    const partialWo = new Set(rows.filter((x) => x.state === 'partial').map((x) => x.woId));
    const hurt = new Set([...blockedWo, ...partialWo]);

    // موج بالادستی: ساختارهای مصرف‌کننده در هر سطح
    const levels = new Map<number, RippleLevel['structures']>();
    for (const w of this.whereUsed(pid)) {
      const s = this.st.get(w.id);
      if (!s) continue;
      levels.set(w.level, [...(levels.get(w.level) ?? []), { id: s.id, code: s.code, title: s.title, product: this.label(s.productId), openOrders: s.openOrders }]);
    }

    // اثر پایین‌دستی: دستورهایی که محصول دستورهای آسیب‌دیده را مصرف می‌کنند
    const hurtProducts = new Map<number, string>();
    for (const r of rows) if (hurt.has(r.woId)) hurtProducts.set(this.b.orders.find((o) => o.woId === r.woId)?.mainProductId ?? 0, r.wo);
    const downstream: RippleResult['downstream'] = [];
    for (const [hp, srcWo] of hurtProducts) {
      const P = this.p(hp);
      if (!P) continue;
      let pPool = P.onHand;
      for (const d of this.b.orders.filter((o) => o.productId === hp).sort((a, c) => (a.due ?? 9e15) - (c.due ?? 9e15))) {
        const ok = pPool >= d.remaining - EPS;
        pPool = Math.max(0, pPool - d.remaining);
        downstream.push({
          wo: d.wo, product: `${P.code} ${P.title}`, need: d.remaining, unit: P.unit, state: ok ? 'ok' : 'risk',
          reason: ok ? `از موجودی ${P.code} پوشش دارد` : `موجودی ${P.code} کم است و ${srcWo} مسدود/ناقص است`,
        });
      }
    }

    // درخواست‌های باز محصولات درگیر
    const ripplePids = new Set<number>([...hurtProducts.keys()]);
    for (const w of this.whereUsed(pid)) {
      const sp = this.st.get(w.id)?.productId;
      if (sp) ripplePids.add(sp);
    }
    const requests: RippleResult['requests'] = this.b.requests
      .filter((q) => ripplePids.has(q.productId))
      .map((q) => {
        const P = this.p(q.productId);
        const hurtHere = hurtProducts.has(q.productId) || downstream.some((d) => d.state === 'risk' && this.b.orders.some((o) => o.wo === d.wo && o.mainProductId === q.productId));
        return {
          number: q.number, product: `${P?.code ?? ''} ${P?.title ?? ''}`, need: q.need, qty: q.qty, unit: P?.unit ?? '', state: hurtHere ? ('risk' as const) : ('ok' as const),
          reason: hurtHere ? 'دستور تأمین‌کننده یا ورودی آن مسدود است' : q.linked ? 'دستور مرتبط پوشش دارد' : 'هنوز دستوری ندارد — در برنامه‌ریزی لحاظ شود',
        };
      });

    const daily = this.dailyDemand(M);
    const openNeed = sum(demand.map((r) => r.remaining));
    const coverDays = daily > EPS ? (discard ? 0 : M.onHand) / daily : null;
    const ecos: RippleEco[] = touching.map((t) => ({
      eco: t.eco, why: t.why, accepted: accepted.some((a) => a.eco.id === t.eco.id),
      effect:
        t.eco.status >= 5
          ? `${ECO_STATUS[t.eco.status]} — اثرش در ساختار جاری هست`
          : t.eco.policy === 2
            ? 'پذیرش = کنارگذاری موجودی فعلی این کالا'
            : Object.keys(forced).length || this.b.ecoItems.some((i) => i.ecoId === t.eco.id && i.groupId !== null)
              ? 'پذیرش = جایگزین اول گروه برای کسری فعال می‌شود'
              : `پذیرش = ${t.eco.policy ? ECO_POLICY[t.eco.policy] : 'سیاست موجودی نامعین'}`,
    }));
    const bl = blockedWo.size;
    const pa = partialWo.size;
    const narrative =
      `${M.code} ${M.title}: موجودی آزاد ${faNum(discard ? 0 : M.onHand, 2)} ${M.unit}${discard ? ' (کنار گذاشته شد)' : ''}، نیاز باز ${faNum(openNeed, 2)} در ${faInt(new Set(demand.map((d) => d.woId)).size)} دستور. ` +
      (coverDays !== null ? `با مصرف روزانه‌ی ${faNum(daily, 2)}، موجودی ${faNum(coverDays, 1)} روز کفایت می‌کند. ` : 'مصرف جاری ندارد. ') +
      (bl || pa ? `اگر چیزی نرسد ${faInt(bl)} دستور کاملاً و ${faInt(pa)} دستور تا حدی می‌خوابند` : 'همه‌ی دستورهای باز از موجودی پوشش دارند') +
      (downstream.some((d) => d.state === 'risk') ? ` و موج آن به ${faInt(downstream.filter((d) => d.state === 'risk').length)} دستور پایین‌دستی می‌رسد.` : '.') +
      ` ${faInt(this.whereUsed(pid).length)} ساختار در ${faInt(levels.size)} سطح به این ماده وابسته‌اند.`;
    return {
      material: M, pool: discard ? 0 : M.onHand, transit: opts.includeTransit ? M.inTransit : 0,
      poolNote: discard ? 'پذیرش ECO با سیاست کنارگذاری' : M.inTransit ? `در راه ${faNum(M.inTransit, 2)} تا ${faDM(M.nextArrival)}` : '',
      daily, coverDays, openNeed, rows, blocked: bl, partial: pa, levels: [...levels.entries()].sort((a, c) => a[0] - c[0]).map(([level, structures]) => ({ level, structures })),
      downstream, requests, options: this.subOptions(pid), ecos, narrative,
    };
  }

  // ───────── ۴) دقت ساختار در اجرا ─────────
  truth(scope: Scope, k: number): TruthRow[] {
    const inS = new Set(this.scopeStructures(scope).map((s) => s.id));
    const groups = new Map<string, PeConsumption[]>();
    for (const c of this.b.consumption) {
      if (c.structureId === null || !inS.has(c.structureId)) continue;
      const key = `${c.structureId}-${c.itemId}`;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    const out: TruthRow[] = [];
    for (const [key, list] of groups) {
      const first = list[0];
      const it = this.b.items.find((i) => i.structureId === first.structureId && i.itemId === first.itemId) ?? this.b.items.find((i) => i.itemId === first.itemId);
      const p = this.p(first.productId);
      // یک نمونه = یک دستور (ردیف‌های چند عملیات همان دستور جمع می‌شوند)
      const byWo = new Map<string, { std: number; act: number | null; pot: number | null; sub: boolean; ai: boolean }>();
      for (const c of list) {
        const o = byWo.get(c.wo) ?? { std: 0, act: null as number | null, pot: c.potency, sub: false, ai: c.ai };
        o.std += c.stdForProduced;
        if (c.actual !== null) o.act = (o.act ?? 0) + c.actual;
        o.sub = o.sub || c.substitutedId !== null;
        byWo.set(c.wo, o);
      }
      const samples: TruthSample[] = [];
      const gaps: string[] = [];
      const substituted: string[] = [];
      for (const [wo, o] of byWo) {
        if (o.sub) substituted.push(wo);
        else if (o.act === null) gaps.push(wo);
        else if (o.std > EPS) {
          const corrected = o.ai && o.pot !== null;
          samples.push({ wo, ratio: (o.act / o.std) * (corrected ? (o.pot as number) / 100 : 1), corrected });
        }
      }
      const n = samples.length;
      const rs = samples.map((x) => x.ratio);
      const mean = n ? sum(rs) / n : 1;
      const sd = n > 1 ? Math.sqrt(sum(rs.map((r) => (r - mean) ** 2)) / (n - 1)) : 0;
      const bias = (mean - 1) * 100;
      const lo = it?.minC !== null && it?.minC !== undefined ? it.minC - 100 : null;
      const hi = it?.maxC !== null && it?.maxC !== undefined ? it.maxC - 100 : null;
      // بدون حد مصرف در ساختار، باند پیش‌فرض ±۲٪
      const bLo = lo ?? -2;
      const bHi = hi ?? 2;
      const half = (bHi - bLo) / 2;
      const sameSign = n > 0 && (rs.every((r) => r > 1.002) || rs.every((r) => r < 0.998));
      const outside = bias < bLo || bias > bHi;
      let verdict: TruthRow['verdict'] = 'ok';
      if (!n) verdict = 'gap';
      else if (sd * 100 > half && n > 1) verdict = 'noisy';
      else if (n >= 2 && (outside || (sameSign && Math.abs(bias) > 0.5))) verdict = bias > 0 ? 'over' : 'under';
      else if (n < 2) verdict = outside ? (bias > 0 ? 'over' : 'under') : 'few';
      const w = n / (n + k);
      const stdQty = it?.qty ?? 0;
      const adj = w * bias;
      // پیشنهاد فقط با دست‌کم دو دستور هم‌جهت؛ یک نمونه بیشتر خطای ثبت را نشان می‌دهد تا خطای استاندارد
      const suggested = n >= 2 && Math.abs(adj) >= 0.3 && stdQty > 0 && !it?.qs && (verdict === 'over' || verdict === 'under') ? stdQty * (1 + adj / 100) : null;
      out.push({
        key, structureCode: this.st.get(first.structureId as number)?.code ?? '', code: p?.code ?? '', title: p?.title ?? '', unit: it?.qtyType === 4 ? '٪' : (p?.unit ?? ''),
        roleTitle: it?.roleTitle ?? '', stdQty, stdLabel: it?.qtyType === 4 ? `${faNum(stdQty, 2)}٪` : `${faNum(stdQty, 3)} ${p?.unit ?? ''}`, n, mean,
        min: n ? Math.min(...rs) : 1, max: n ? Math.max(...rs) : 1, sd, bias, lo, hi, samples, verdict, w, suggested,
        confidence: n >= 5 && sd < 0.01 ? 'زیاد' : n >= 3 || (n >= 2 && sd < 0.005) ? 'متوسط' : 'کم', gaps, substituted, ai: !!it?.ai,
      });
    }
    const rank: Record<TruthRow['verdict'], number> = { over: 0, under: 0, noisy: 1, gap: 2, few: 3, ok: 4 };
    return out.sort((a, c) => rank[a.verdict] - rank[c.verdict] || Math.abs(c.bias) - Math.abs(a.bias));
  }

  yieldTruth(scope: Scope): YieldTruth[] {
    const inS = new Set(this.scopeStructures(scope).map((s) => s.id));
    const m = new Map<string, YieldTruth>();
    for (const y of this.b.yields) {
      if (y.structureId === null || !inS.has(y.structureId)) continue;
      const key = `${y.structureId}-${y.productId}`;
      const p = this.p(y.productId);
      const row = m.get(key) ?? {
        key, structureCode: this.st.get(y.structureId)?.code ?? '', product: `${p?.code ?? ''} ${p?.title ?? ''}`, type: y.type, std: y.stdYield, min: y.min, max: y.max,
        samples: [], missing: [], mean: 0, delta: 0, verdict: 'none' as YieldTruth['verdict'],
      };
      if (y.actualYield !== null && y.produced > 0) row.samples.push({ wo: y.wo, v: y.actualYield });
      else row.missing.push(y.wo);
      m.set(key, row);
    }
    for (const r of m.values()) {
      if (!r.samples.length) continue;
      r.mean = sum(r.samples.map((x) => x.v)) / r.samples.length;
      r.delta = r.mean - r.std;
      r.verdict = r.max !== null && r.mean > r.max + 1e-9 ? 'over' : r.min !== null && r.mean < r.min - 1e-9 ? 'under' : r.min === null && r.max === null && Math.abs(r.delta) > 1 ? (r.delta > 0 ? 'over' : 'under') : 'ok';
    }
    return [...m.values()].sort((a, c) => Number(c.verdict !== 'ok' && c.verdict !== 'none') - Number(a.verdict !== 'ok' && a.verdict !== 'none') || a.structureCode.localeCompare(c.structureCode) || a.type - c.type);
  }

  // ───────── ۵) رادار تغییر ─────────
  ecoViews(scope: Scope): EcoView[] {
    const inScope = this.scopeProducts(scope);
    return this.b.ecos
      .map((e) => {
        const its = this.b.ecoItems.filter((i) => i.ecoId === e.id);
        const direct = new Set<number>();
        const structs = new Map<number, number>();
        for (const i of its) {
          if (i.productId !== null) direct.add(i.productId);
          if (i.structureId !== null) {
            structs.set(i.structureId, 0);
            const mp = this.st.get(i.structureId)?.productId;
            if (mp) direct.add(mp);
          }
          if (i.groupId !== null) for (const m of this.groupOptions.get(i.groupId)?.get(0)?.members ?? []) direct.add(m.productId);
        }
        for (const pid of direct) for (const w of this.whereUsed(pid)) if (!structs.has(w.id) || (structs.get(w.id) ?? 0) > w.level) structs.set(w.id, w.level);
        const sIds = new Set(structs.keys());
        const orderSet = new Map<string, string>();
        for (const o of this.b.orders) if ((o.structureId !== null && sIds.has(o.structureId)) || direct.has(o.productId)) orderSet.set(o.wo, this.p(o.mainProductId)?.code ?? '');
        const open = e.status >= 1 && e.status <= 4;
        const appr = this.b.ecoApprovals.filter((a) => a.ecoId === e.id).sort((a, c) => a.seq - c.seq);
        const wait = appr.find((a) => a.decision === null);
        return {
          eco: e, open, ageDays: e.requestDate !== null ? Math.max(0, Math.floor((NOW - e.requestDate) / DAY)) : 0,
          waiting: wait ? `منتظر ${wait.role}` : appr.length ? 'همه‌ی امضاها کامل' : 'زنجیره‌ی امضا تعریف نشده',
          effLabel: e.effectiveDate !== null ? faDM(e.effectiveDate) : 'نامعین',
          daysToEffect: e.effectiveDate !== null ? Math.ceil((e.effectiveDate - NOW) / DAY) : null,
          policy: e.policy !== null ? ECO_POLICY[e.policy] : 'نامعین',
          direct: [...direct].map((id) => ({ id, code: this.p(id)?.code ?? '', title: this.p(id)?.title ?? '' })),
          structures: [...structs.entries()].map(([id, level]) => ({ id, code: this.st.get(id)?.code ?? '', level })).sort((a, c) => a.level - c.level),
          orders: [...orderSet.entries()].map(([wo, product]) => ({ wo, product })),
          stock: [...direct]
            .map((id) => this.p(id))
            .filter((p): p is PeProduct => !!p && p.onHand > 0 && (p.role === 3 || p.role === 4))
            .map((p) => ({ code: p.code, title: p.title, qty: p.onHand, unit: p.unit, atRisk: open && e.policy === 2 })),
          issues: this.b.checks.filter((c) => c.entityType === 'ECO' && c.entityId === e.id && !c.passed).map((c) => `${CHECKS[c.code]?.title ?? c.code}: ${c.detail}`),
        };
      })
      .filter((v) => inScope === null || v.direct.some((d) => inScope.has(d.id)))
      .sort((a, c) => Number(c.open) - Number(a.open) || (c.eco.requestDate ?? 0) - (a.eco.requestDate ?? 0));
  }

  // ───────── ۶) بدهی فنی داده ─────────
  defects(scope: Scope): Defect[] {
    const inScope = this.scopeProducts(scope);
    const inS = this.isAll(scope) ? null : new Set(this.scopeStructures(scope).map((s) => s.id));
    const ecoIn = new Set(this.ecoViews(scope).map((v) => v.eco.id));
    const allEcos = new Map(this.ecoViews({ groups: [], productId: null, types: [], statuses: [] }).map((v) => [v.eco.id, v]));
    return this.b.checks
      .filter((c) => !c.passed)
      .filter((c) => {
        if (inScope === null) return true;
        if (c.entityType === 'STRUCT') return inS?.has(c.entityId) ?? true;
        if (c.entityType === 'PRODUCT') return inScope.has(c.entityId);
        if (c.entityType === 'SUBGRP')
          return [...(this.groupOptions.get(c.entityId)?.values() ?? [])].some((o) => o.members.some((m) => inScope.has(m.productId)));
        return ecoIn.has(c.entityId);
      })
      .map((c) => {
        const d = CHECKS[c.code] ?? { title: c.code, owner: '—', why: '' };
        let reach = 1;
        let note = '';
        if (c.entityType === 'STRUCT') {
          const s = this.st.get(c.entityId);
          const wu = s?.productId ? this.whereUsed(s.productId).length : 0;
          const rq = s?.productId ? this.requestsOf(s.productId) : 0;
          reach += (s?.openOrders ?? 0) + wu + rq;
          note = `${faInt(s?.openOrders ?? 0)} دستور باز · ${faInt(wu)} ساختار بالادستی · ${faInt(rq)} درخواست`;
        } else if (c.entityType === 'PRODUCT') {
          const p = this.p(c.entityId);
          const wu = this.whereUsed(c.entityId).length;
          const rq = this.requestsOf(c.entityId);
          reach += (p?.openOrders ?? 0) + wu + rq;
          note = `${faInt(p?.openOrders ?? 0)} دستور مصرف‌کننده · ${faInt(wu)} ساختار · ${faInt(rq)} درخواست`;
        } else if (c.entityType === 'SUBGRP') {
          const n = new Set(this.b.items.filter((i) => i.subGroupId === c.entityId).map((i) => i.structureId)).size;
          reach += n;
          note = `${faInt(n)} ساختار متصل`;
        } else {
          const v = allEcos.get(c.entityId);
          reach += (v?.structures.length ?? 0) + (v?.orders.length ?? 0);
          note = `${faInt(v?.structures.length ?? 0)} ساختار و ${faInt(v?.orders.length ?? 0)} دستور زیر اثر`;
        }
        return {
          key: `${c.entityType}-${c.entityId}-${c.code}`, code: c.code, title: d.title, owner: d.owner, form: c.form, severity: c.severity,
          entity: `${c.entityCode} ${c.entityTitle}`, entityType: c.entityType, detail: c.detail || d.why, impact: severityWeight(c.severity) * reach, reach,
          reachNote: note, productId: c.productId, structureId: c.structureId,
        };
      })
      .sort((a, c) => c.impact - a.impact || c.severity - a.severity);
  }

  groupDefects(list: Defect[], by: 'type' | 'form' | 'owner' | 'entity'): DefectGroup[] {
    const m = new Map<string, DefectGroup>();
    for (const d of list) {
      const key = by === 'type' ? d.code : by === 'form' ? d.form : by === 'owner' ? d.owner : d.entity;
      const title = by === 'type' ? `${d.code} · ${d.title}` : key;
      const g = m.get(key) ?? { key, title, impact: 0, items: [] };
      g.items.push(d);
      g.impact += d.impact;
      m.set(key, g);
    }
    return [...m.values()].sort((a, c) => c.impact - a.impact);
  }
}

const ROLE_SHORT: Record<number, string> = { 1: 'نهایی', 2: 'نیمه‌ساخته', 3: 'اولیه', 4: 'بسته‌بندی', 5: 'جانبی' };
