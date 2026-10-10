import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { RoutingRow, buildRoutingTree, defaultRouting, faNum } from './me-routing';
import { AttributeRow, CoverageRow, Issue, ItemCoverage, MaterialRow, Me04Bundle, OutputRow, StageRow, YieldRow } from './frm-me-04.data';
import { FrmMe04Service, WASTE_PRIORITY } from './frm-me-04.service';

/**
 * FRM-ME-04 — «اقلام و خروجی در سطح عملیات».
 *
 * ردیف‌های ساختار به عملیات روش تخصیص می‌یابند (با کنترل پوشش کامل و جمع ۱۰۰٪)، نقطه‌ی مصرف،
 * خروجی هر عملیات (اصلی، همزاد، جانبی، ضایعات، نیمه‌ساخته) در برابر خروجی‌های ساختار،
 * ضایعات فرایند/عملیات با قاعده‌ی ارجحیت و بازده انباشته روی گراف، ذخیره‌سازی بین‌مرحله‌ای
 * و ویژگی‌های بچ هر عملیات (نقطه‌ی اتصال به QC).
 *
 * فاز اول: F-ME-029 تا 035، 039.
 */
@Component({
  selector: 'gng-frm-me-04',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-me-04.component.html',
})
export class FrmMe04Component implements OnInit {
  data: Me04Bundle | null = null;
  pickTree: TreeNode<{ id: number }>[] = [];
  selectedPick: TreeNode<{ id: number }> | null = null;
  routing: RoutingRow | null = null;

  materials: MaterialRow[] = [];
  items: ItemCoverage[] = [];
  stages: StageRow[] = [];
  outputs: OutputRow[] = [];
  coverage: CoverageRow[] = [];
  attributes: AttributeRow[] = [];
  yields: YieldRow[] = [];
  issues: Issue[] = [];

  readonly wastePriority = WASTE_PRIORITY;
  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private me04: FrmMe04Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.me04.load(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.pickTree = buildRoutingTree(b.routings, (r) => !r.isTemplate);
        this.select(defaultRouting(b.routings)?.id ?? null);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-ME-04] خواندن داده ناموفق بود:', err?.message || err);
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
    this.materials = b.materials.filter((m) => m.routingId === id);
    this.stages = b.stages.filter((s) => s.routingId === id);
    this.outputs = b.outputs.filter((x) => x.routingId === id);
    this.coverage = b.coverage.filter((c) => c.routingId === id);
    this.attributes = b.attributes.filter((a) => a.routingId === id);
    const byItem = new Map<string, ItemCoverage>();
    for (const m of this.materials) {
      const key = `${m.structure}-${m.itemId}`;
      const it = byItem.get(key) ?? { structure: m.structure, itemSequence: m.itemSequence, product: m.product, allocations: [], total: 0 };
      if (m.routingOperationId) {
        it.allocations.push(m);
        it.total += m.allocation ?? 0;
      }
      byItem.set(key, it);
    }
    this.items = [...byItem.values()];
    this.yields = this.computeYields(id);
    this.issues = this.validate();
  }

  /** بازده انباشته روی گراف: عملیاتی که در مسیر خروجی اصلی‌اند؛ شاخه‌های موازی با سهم‌بری وزن می‌گیرند. */
  private computeYields(id: number | null): YieldRow[] {
    const links = this.data!.links.filter((k) => k.routingId === id);
    const byId = new Map(this.stages.map((s) => [s.routingOperationId, s]));
    const succ = new Map<number, number[]>();
    const pred = new Map<number, number[]>();
    if (links.length) {
      for (const k of links) {
        succ.set(k.fromId, [...(succ.get(k.fromId) ?? []), k.toId]);
        pred.set(k.toId, [...(pred.get(k.toId) ?? []), k.fromId]);
      }
    } else {
      const ops = [...this.stages].sort((a, b) => a.sequence - b.sequence);
      ops.slice(1).forEach((o, i) => {
        succ.set(ops[i].routingOperationId, [o.routingOperationId]);
        pred.set(o.routingOperationId, [ops[i].routingOperationId]);
      });
    }
    const mainOp = this.outputs.find((x) => x.isMain)?.routingOperationId;
    const main = new Set<number>();
    const walk = (n: number) => {
      if (main.has(n)) return;
      main.add(n);
      for (const p of pred.get(n) ?? []) walk(p);
    };
    if (mainOp) walk(mainOp);
    const priority = this.stages[0]?.wastePriorityCode ?? 2;
    const pw = this.stages[0]?.processWaste ?? 0;
    const memo = new Map<number, number>();
    const cum = (n: number, guard = 0): number => {
      if (memo.has(n)) return memo.get(n)!;
      if (guard > 50) return 1;
      const y = priority === 3 ? 1 : (byId.get(n)?.yieldPercent ?? 100) / 100;
      const next = (succ.get(n) ?? []).filter((s) => main.has(s));
      let down = 1;
      if (next.length) {
        const weights = next.map((s) => (byId.get(s)?.share ?? (next.length === 1 ? 100 : 100 / next.length)) / 100);
        down = next.reduce((sum, s, i) => sum + weights[i] * cum(s, guard + 1), 0);
      }
      const v = y * down;
      memo.set(n, v);
      return v;
    };
    const processFactor = priority === 3 ? 1 - pw / 100 : 1;
    const target = this.routing?.batch ?? 0;
    return [...this.stages]
      .sort((a, b) => a.sequence - b.sequence)
      .map((s) => {
        const c = main.has(s.routingOperationId) ? cum(s.routingOperationId) * processFactor : 1;
        return { stage: s, cumYield: c * 100, requiredInput: c ? (target * ((s.share ?? 100) / 100)) / c : 0, onMainPath: main.has(s.routingOperationId) };
      });
  }

  private validate(): Issue[] {
    const out: Issue[] = [];
    const r = this.routing;
    if (!r) return out;
    const sev: 'danger' | 'warning' = r.statusCode === 4 || r.statusCode === 1 ? 'warning' : 'danger';
    for (const it of this.items) {
      if (!it.allocations.length) out.push({ severity: sev, text: `${it.structure} ردیف ${this.fa(it.itemSequence)} «${it.product}» به هیچ عملیاتی تخصیص نیافته` });
      else if (Math.abs(it.total - 100) > 0.01) out.push({ severity: sev, text: `${it.structure} ردیف ${this.fa(it.itemSequence)} «${it.product}» جمعاً ${faNum(it.total)}٪ تخصیص یافته، نه ۱۰۰٪` });
    }
    for (const c of this.coverage.filter((x) => !x.operations)) out.push({ severity: sev, text: `خروجی «${c.product}» (${c.type}) ساختار ${c.structure} به هیچ عملیاتی وصل نیست` });
    const set = new Set(this.attributes.filter((a) => a.actionCode !== 3).map((a) => a.attributeId));
    for (const a of this.attributes.filter((x) => x.actionCode === 3 && !set.has(x.attributeId)))
      out.push({ severity: 'warning', text: `ردیف ${this.fa(a.sequence)} ویژگی «${a.attribute}» را تأیید می‌کند ولی هیچ عملیاتی در این روش آن را تعیین نمی‌کند` });
    for (const m of this.materials.filter((x) => x.isActiveIngredient && x.backflushed))
      out.push({ severity: 'warning', text: `ماده‌ی مؤثره‌ی «${m.product}» با Backflush مصرف می‌شود` });
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }

  // ───────── نمایش ─────────

  get firstInput(): YieldRow | undefined {
    return this.yields.find((y) => y.onMainPath);
  }

  get unallocatedCount(): number {
    return this.items.filter((i) => !i.allocations.length).length;
  }

  allocSeverity(it: ItemCoverage): 'success' | 'danger' | 'warning' {
    if (!it.allocations.length) return 'danger';
    return Math.abs(it.total - 100) > 0.01 ? 'warning' : 'success';
  }

  outputSeverity(code: number): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    return code === 1 ? 'success' : code === 2 || code === 3 ? 'info' : code === 4 ? 'danger' : code === 5 ? 'warning' : 'secondary';
  }

  get contextLabel(): string {
    return this.routing ? `${this.routing.code} ${this.routing.version} — ${this.routing.title}` : 'اقلام و خروجی عملیات';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.severity === 'danger')) return 'danger';
    return this.issues.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_me04_setup.sql را بررسی کنید.';
    if (this.loading || !this.routing) return 'در حال خواندن…';
    const prefix = this.routing.statusCode === 4 ? 'نسخه‌ی منسوخ؛ ' : this.routing.statusCode === 1 ? 'پیش‌نویس؛ ' : '';
    if (this.issues.length) return prefix + this.issues.map((i) => i.text).join('؛ ') + '.';
    return `همه‌ی ${this.fa(this.items.length)} ردیف ساختار و ${this.fa(this.coverage.length)} خروجی به عملیات تخصیص یافته‌اند.`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  num(n: number | null, d = 3): string {
    return faNum(n, d);
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
