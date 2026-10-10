import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { RoutingRow, buildRoutingTree, defaultRouting, faNum, routingStatusSeverity } from './me-routing';
import { AlternativeRow, AssignmentRow, DiffRow, GraphEdge, GraphNode, Issue, LinkRow, Me02Bundle, OutputRow, RoutingOpRow } from './frm-me-02.data';
import { FrmMe02Service } from './frm-me-02.service';

/**
 * FRM-ME-02 — «روش ساخت».
 *
 * روش به یک یا چند ساختار/محصول اختصاص دارد، نسخه و اعتبار دارد، از الگو مشتق می‌شود و
 * گراف عملیات (موازی با سهم‌بری، هم‌پوشان، جایگزین با شرط انتخاب) دارد. گراف نمای دوم
 * همین فرم است و با کنترل حلقه، یتیم، مسیر بدون خروجی و عملیات بدون منبع اعتبارسنجی می‌شود.
 *
 * فاز اول: F-ME-008 تا 013، 015 (نمایش)، 016 تا 019. عملیات شرطی (014) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-me-02',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DropdownModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-me-02.component.html',
})
export class FrmMe02Component implements OnInit {
  readonly nodeW = 168;
  readonly nodeH = 58;
  private readonly gapX = 92;
  private readonly gapY = 22;

  data: Me02Bundle | null = null;
  pickTree: TreeNode<{ id: number }>[] = [];
  selectedPick: TreeNode<{ id: number }> | null = null;
  routing: RoutingRow | null = null;

  assignments: AssignmentRow[] = [];
  operations: RoutingOpRow[] = [];
  links: LinkRow[] = [];
  alternatives: AlternativeRow[] = [];
  outputs: OutputRow[] = [];
  issues: Issue[] = [];
  invalidOps = new Set<number>();

  nodes: GraphNode[] = [];
  edges: GraphEdge[] = [];
  graphW = 0;
  graphH = 0;

  versions: RoutingRow[] = [];
  leftId: number | null = null;
  rightId: number | null = null;
  diff: DiffRow[] = [];

  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private me02: FrmMe02Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.me02.load(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.pickTree = buildRoutingTree(b.routings);
        this.select(defaultRouting(b.routings)?.id ?? null);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-ME-02] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  onPick(e: { node: TreeNode<{ id: number }> }): void {
    if (e.node.data) this.select(e.node.data.id);
  }

  onUnpick(e: { node: TreeNode<{ id: number }> }): void {
    setTimeout(() => (this.selectedPick = e.node));
  }

  private select(id: number | null): void {
    const b = this.data!;
    this.routing = b.routings.find((r) => r.id === id) ?? null;
    this.selectedPick = this.pickTree.flatMap((g) => g.children ?? []).find((n) => n.data?.id === id) ?? null;
    this.assignments = b.assignments.filter((a) => a.routingId === id);
    this.operations = b.operations.filter((o) => o.routingId === id);
    this.links = b.links.filter((k) => k.routingId === id);
    this.alternatives = b.alternatives.filter((a) => a.routingId === id);
    this.outputs = b.outputs.filter((x) => x.routingId === id);
    this.issues = this.validate();
    this.layout();
    this.versions = this.routing ? b.routings.filter((r) => r.code === this.routing!.code) : [];
    this.leftId = this.versions.length > 1 ? this.versions.find((v) => v.id !== id)?.id ?? null : this.routing?.templateId ?? null;
    this.rightId = id;
    this.runDiff();
  }

  // ───────── گراف ─────────

  /** یال‌های مؤثر: یال صریح، یا اگر روش یال ندارد ترتیب ساده‌ی Sequence */
  private effectiveLinks(): { from: number; to: number; link: LinkRow | null }[] {
    if (this.links.length) return this.links.map((k) => ({ from: k.fromId, to: k.toId, link: k }));
    const ops = [...this.operations].sort((a, b) => a.sequence - b.sequence);
    return ops.slice(1).map((o, i) => ({ from: ops[i].id, to: o.id, link: null }));
  }

  /** یال‌های برگشتی (حلقه) با DFS از ریشه‌ها، به ترتیب Sequence */
  private backEdges(): Set<string> {
    const out = new Map<number, number[]>();
    for (const e of this.effectiveLinks()) out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
    const state = new Map<number, 1 | 2>();
    const back = new Set<string>();
    const visit = (n: number) => {
      state.set(n, 1);
      for (const m of out.get(n) ?? []) {
        if (state.get(m) === 1) back.add(`${n}>${m}`);
        else if (!state.has(m)) visit(m);
      }
      state.set(n, 2);
    };
    for (const o of [...this.operations].sort((a, b) => a.sequence - b.sequence)) if (!state.has(o.id)) visit(o.id);
    return back;
  }

  private layout(): void {
    const links = this.effectiveLinks();
    const back = this.backEdges();
    const forward = links.filter((e) => !back.has(`${e.from}>${e.to}`));
    const layer = new Map<number, number>(this.operations.map((o) => [o.id, 0]));
    for (let pass = 0; pass < this.operations.length; pass++) {
      for (const e of forward) layer.set(e.to, Math.max(layer.get(e.to) ?? 0, (layer.get(e.from) ?? 0) + 1));
    }
    const cols = new Map<number, RoutingOpRow[]>();
    for (const o of [...this.operations].sort((a, b) => a.sequence - b.sequence)) cols.set(layer.get(o.id)!, [...(cols.get(layer.get(o.id)!) ?? []), o]);
    const maxLayer = Math.max(0, ...cols.keys());
    const maxRows = Math.max(1, ...[...cols.values()].map((c) => c.length));
    this.graphW = (maxLayer + 1) * (this.nodeW + this.gapX) + 20;
    this.graphH = maxRows * (this.nodeH + this.gapY) + 40;
    /* راست‌به‌چپ: لایه‌ی صفر سمت راست */
    this.nodes = [];
    for (const [l, ops] of cols) {
      const x = this.graphW - 10 - (l + 1) * (this.nodeW + this.gapX) + this.gapX;
      const top = (this.graphH - ops.length * (this.nodeH + this.gapY)) / 2;
      ops.forEach((op, i) => this.nodes.push({ op, x, y: top + i * (this.nodeH + this.gapY), invalid: this.invalidOps.has(op.id) }));
    }
    const pos = new Map(this.nodes.map((n) => [n.op.id, n]));
    this.edges = links
      .filter((e) => pos.has(e.from) && pos.has(e.to))
      .map((e) => {
        const a = pos.get(e.from)!;
        const b = pos.get(e.to)!;
        const isBack = back.has(`${e.from}>${e.to}`);
        let label = '';
        if (e.link?.share !== null && e.link?.share !== undefined) label = `${faNum(e.link.share)}٪`;
        if (e.link?.overlapType === 2) label = `هم‌پوشان ${faNum(e.link.overlapQuantity)}`;
        if (e.link?.overlapType === 3) label = `هم‌پوشان ${faNum(e.link.overlapMinutes)} دقیقه`;
        return isBack
          ? { x1: a.x + this.nodeW / 2, y1: a.y + this.nodeH, x2: b.x + this.nodeW / 2, y2: b.y + this.nodeH, label: 'حلقه', back: true }
          : { x1: a.x, y1: a.y + this.nodeH / 2, x2: b.x + this.nodeW, y2: b.y + this.nodeH / 2, label, back: false };
      });
  }

  labelY(e: GraphEdge): number {
    return e.back ? Math.max(e.y1, e.y2) + 30 : (e.y1 + e.y2) / 2 - 6;
  }

  backPath(e: GraphEdge): string {
    const dip = Math.max(e.y1, e.y2) + 34;
    return `M ${e.x1} ${e.y1} C ${e.x1} ${dip}, ${e.x2} ${dip}, ${e.x2} ${e.y2 + 6}`;
  }

  // ───────── اعتبارسنجی (F-ME-016) ─────────

  private validate(): Issue[] {
    const out: Issue[] = [];
    this.invalidOps = new Set();
    const r = this.routing;
    if (!r) return out;
    const links = this.effectiveLinks();
    const back = this.backEdges();
    const label = (id: number) => {
      const o = this.operations.find((x) => x.id === id);
      return o ? `${this.fa(o.sequence)} «${o.title}»` : '';
    };
    if (back.size) {
      for (const k of back) {
        const [a, b] = k.split('>').map(Number);
        this.invalidOps.add(a).add(b);
        out.push({ severity: 'danger', text: `حلقه در گراف: ${label(a)} ← ${label(b)}` });
      }
    }
    if (this.operations.length > 1) {
      for (const o of this.operations) {
        if (!links.some((e) => e.from === o.id || e.to === o.id)) {
          this.invalidOps.add(o.id);
          out.push({ severity: 'danger', text: `عملیات یتیم: ${label(o.id)} به هیچ عملیاتی وصل نیست` });
        }
      }
    }
    if (!r.isTemplate) {
      for (const o of this.operations) {
        const terminal = !links.some((e) => e.from === o.id) && links.some((e) => e.to === o.id || this.operations.length === 1);
        if (terminal && !this.outputs.some((x) => x.routingOperationId === o.id)) {
          this.invalidOps.add(o.id);
          out.push({ severity: 'danger', text: `مسیر بدون خروجی: ${label(o.id)} عملیات پایانی است ولی خروجی ندارد` });
        }
        if (o.resourceSource === 0 && !o.outsourced && o.natureCode <= 3) {
          this.invalidOps.add(o.id);
          out.push({ severity: 'danger', text: `${label(o.id)} نه در روش منبع دارد نه در کتابخانه (FRM-ME-01)` });
        }
      }
    }
    const bySource = new Map<number, LinkRow[]>();
    for (const k of this.links) bySource.set(k.fromId, [...(bySource.get(k.fromId) ?? []), k]);
    for (const [src, ks] of bySource) {
      const shared = ks.filter((k) => k.share !== null);
      const sum = shared.reduce((s, k) => s + (k.share ?? 0), 0);
      if (shared.length && Math.abs(sum - 100) > 0.01) out.push({ severity: 'warning', text: `سهم‌بری شاخه‌های موازی از ${label(src)} جمعاً ${faNum(sum)}٪ است، نه ۱۰۰٪` });
    }
    if (r.methodCode === 1 && this.operations.length > 1) out.push({ severity: 'warning', text: 'روش تک‌مرحله‌ای بیش از یک عملیات دارد' });
    if (r.statusCode === 3 && r.validToIso && new Date(r.validToIso) < new Date()) out.push({ severity: 'warning', text: 'روش تأییدشده است ولی اعتبارش گذشته' });
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }

  // ───────── مقایسه‌ی نسخه‌ها (F-ME-018) ─────────

  get versionOptions(): { label: string; value: number }[] {
    const pool = this.data?.routings ?? [];
    const related = pool.filter((r) => r.code === this.routing?.code || r.id === this.routing?.templateId || r.templateId === this.routing?.id);
    return related.map((r) => ({ label: `${r.code} ${r.version} — ${r.status}`, value: r.id }));
  }

  runDiff(): void {
    this.diff = [];
    if (!this.data || !this.leftId || !this.rightId || this.leftId === this.rightId) return;
    const ops = (id: number) => this.data!.operations.filter((o) => o.routingId === id);
    const left = new Map(ops(this.leftId).map((o) => [o.sequence, o]));
    const right = new Map(ops(this.rightId).map((o) => [o.sequence, o]));
    const show = (o: RoutingOpRow) => `${o.code} ${o.title}${o.resource ? ' · ' + o.resource : ''}`;
    for (const seq of [...new Set([...left.keys(), ...right.keys()])].sort((a, b) => a - b)) {
      const a = left.get(seq);
      const b = right.get(seq);
      if (!a && b) this.diff.push({ sequence: seq, kind: 'added', left: '—', right: show(b), fields: '' });
      else if (a && !b) this.diff.push({ sequence: seq, kind: 'removed', left: show(a), right: '—', fields: '' });
      else if (a && b) {
        const f: string[] = [];
        if (a.operationId !== b.operationId) f.push('عملیات');
        if (a.resource !== b.resource) f.push('منبع');
        if (a.yieldPercent !== b.yieldPercent) f.push('بازده');
        if (a.share !== b.share) f.push('سهم‌بری');
        if (f.length) this.diff.push({ sequence: seq, kind: 'changed', left: show(a), right: show(b), fields: f.join('، ') });
      }
    }
  }

  diffSeverity(k: string): 'success' | 'danger' | 'warning' {
    return k === 'added' ? 'success' : k === 'removed' ? 'danger' : 'warning';
  }

  diffLabel(k: string): string {
    return k === 'added' ? 'افزوده' : k === 'removed' ? 'حذف‌شده' : 'تغییریافته';
  }

  // ───────── نمایش ─────────

  get tollRoutings(): RoutingRow[] {
    return this.data?.routings.filter((r) => r.isToll) ?? [];
  }

  opLabel(id: number): string {
    const o = this.operations.find((x) => x.id === id);
    return o ? `${this.fa(o.sequence)} · ${o.title}` : '';
  }

  overlapText(k: LinkRow): string {
    if (k.overlapType === 2) return `پس از ${faNum(k.overlapQuantity)} ${this.routing?.unit ?? ''}`;
    if (k.overlapType === 3) return `پس از ${faNum(k.overlapMinutes)} دقیقه`;
    return '—';
  }

  statusSeverity = routingStatusSeverity;

  get contextLabel(): string {
    return this.routing ? `${this.routing.code} ${this.routing.version} — ${this.routing.title}` : 'روش ساخت';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.severity === 'danger')) return 'danger';
    if (this.issues.length || this.routing?.statusCode === 4) return 'warning';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_me02_setup.sql را بررسی کنید.';
    if (this.loading || !this.routing) return 'در حال خواندن…';
    const prefix = this.routing.statusCode === 4 ? 'این نسخه منسوخ است. ' : '';
    if (this.issues.length) return prefix + this.issues.map((i) => i.text).join('؛ ') + '.';
    return `${prefix}گراف ${this.fa(this.operations.length)} عملیات معتبر است: بدون حلقه، یتیم، مسیر بی‌خروجی یا عملیات بی‌منبع.`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  num(n: number | null): string {
    return faNum(n);
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
