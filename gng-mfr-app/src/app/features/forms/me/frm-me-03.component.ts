import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { RoutingRow, buildRoutingTree, defaultRouting, faNum } from './me-routing';
import { CapacityCalc, CapacityRow, ClassRow, EquipmentMatrix, Issue, Me03Bundle, TimingCalc, TimingRow } from './frm-me-03.data';
import { FrmMe03Service, SPLIT_RULE, evalFormula, evalSteps } from './frm-me-03.service';

/**
 * FRM-ME-03 — «کارکرد استاندارد و زمان عملیات».
 *
 * هر نوع کارکرد RM به عملیات روش با مبنای محاسبه (ثابت، متناسب، پلکانی، ترکیبی، فرمول)،
 * تفکیک راه‌اندازی/اجرا/پس از اجرا، زمان انتظار، جابه‌جایی و دسته‌ی انتقال، ماتریس تعویض
 * تجهیزات و اندازه‌ی بچ عملیات. مقدار سفارش ورودی است و نیاز هر کارکرد و زمان هر عملیات
 * زنده حساب می‌شود (اقدام فقط‌خواندنی).
 *
 * فاز اول: F-ME-020 تا 026. منحنی یادگیری (027) و پیشنهاد اصلاح (028) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-me-03',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputNumberModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-me-03.component.html',
})
export class FrmMe03Component implements OnInit {
  data: Me03Bundle | null = null;
  pickTree: TreeNode<{ id: number }>[] = [];
  selectedPick: TreeNode<{ id: number }> | null = null;
  routing: RoutingRow | null = null;
  quantity: number | null = null;

  timings: TimingRow[] = [];
  capacities: CapacityRow[] = [];
  timingCalc: TimingCalc[] = [];
  capacityCalc: CapacityCalc[] = [];
  matrices: EquipmentMatrix[] = [];
  classes: ClassRow[] = [];
  productClassId: number | null = null;
  issues: Issue[] = [];

  readonly splitRule = SPLIT_RULE;
  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private me03: FrmMe03Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.me03.load(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.classes = b.classes;
        this.pickTree = buildRoutingTree(b.routings, (r) => !r.isTemplate);
        this.select(defaultRouting(b.routings)?.id ?? null);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-ME-03] خواندن داده ناموفق بود:', err?.message || err);
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
    this.quantity = this.routing?.batch ?? null;
    this.timings = b.timings.filter((t) => t.routingId === id);
    this.capacities = b.capacities.filter((c) => c.routingId === id);
    this.productClassId = b.productClasses.find((p) => p.routingId === id)?.classId ?? null;
    this.matrices = this.buildMatrices(id);
    this.recalc();
  }

  private buildMatrices(id: number | null): EquipmentMatrix[] {
    const rows = this.data!.changeovers.filter((c) => c.routingId === id);
    const byEq = new Map<string, EquipmentMatrix>();
    for (const r of rows) {
      const key = `${r.routingOperationId}-${r.equipmentId}`;
      const m = byEq.get(key) ?? { routingOperationId: r.routingOperationId, sequence: r.sequence, equipment: r.equipment, cells: new Map<string, number>(), empty: true };
      if (r.fromClassId !== null && r.toClassId !== null && r.minutes !== null) {
        m.cells.set(`${r.fromClassId}>${r.toClassId}`, r.minutes);
        m.empty = false;
      }
      byEq.set(key, m);
    }
    return [...byEq.values()].sort((a, b) => a.sequence - b.sequence);
  }

  /** محاسبه‌ی زنده برای مقدار سفارش */
  recalc(): void {
    const total = this.quantity ?? 0;
    /* شاخه‌ی موازی فقط سهم خودش از مقدار سفارش را پردازش می‌کند */
    const shareOf = (opId: number) => (this.timings.find((t) => t.routingOperationId === opId)?.share ?? 100) / 100;
    this.timingCalc = this.timings
      .filter((t) => t.hasTiming)
      .map((t) => {
        const q = total * shareOf(t.routingOperationId);
        const batch = t.batch && t.batch > 0 ? t.batch : q || 1;
        let runs = Math.max(1, Math.ceil(q / batch));
        let runQty = q;
        if (t.splitRuleCode === 2) runQty = runs * batch;
        if (t.splitRuleCode === 3) runs = t.maxRun && q > t.maxRun ? Math.ceil(q / t.maxRun) : 1;
        const perPart = t.outsourced ? t.outsourceRun : Math.max(t.equipmentRun, t.laborRun);
        const setupTotal = runs * t.setup;
        const runTotal = runQty * perPart;
        const teardownTotal = runs * t.teardown;
        const waitTotal = runs * t.wait;
        const moveQueue = t.move + t.queue;
        return { row: t, runs, setupTotal, runTotal, teardownTotal, waitTotal, moveQueue, total: setupTotal + runTotal + teardownTotal + waitTotal + moveQueue };
      });
    this.capacityCalc = this.capacities.map((c) => {
      const q = total * shareOf(c.routingOperationId);
      try {
        let v: number;
        if (c.basisCode === 1) v = c.fixed ?? 0;
        else if (c.basisCode === 2) v = ((c.variable ?? 0) * q) / (c.per || 1);
        else if (c.basisCode === 3) v = evalSteps(c.steps, q);
        else if (c.basisCode === 4) v = (c.fixed ?? 0) + ((c.variable ?? 0) * q) / (c.per || 1);
        else v = evalFormula(c.formula, q);
        return { row: c, required: v, error: '' };
      } catch (e) {
        return { row: c, required: null, error: (e as Error).message };
      }
    });
    this.issues = this.validate();
  }

  private validate(): Issue[] {
    const out: Issue[] = [];
    for (const t of this.timings) {
      if (!t.hasTiming && t.natureCode !== 4) out.push({ severity: 'danger', text: `${this.fa(t.sequence)} «${t.operation}» زمان استاندارد ندارد` });
      if (t.hasTiming && t.outsourced && !t.outsourceRun) out.push({ severity: 'warning', text: `${this.fa(t.sequence)} برون‌سپاری است ولی زمان تحویل پیمانکار ندارد` });
      if (t.hasTiming && t.transferBatch && t.batch && t.transferBatch > t.batch)
        out.push({ severity: 'danger', text: `${this.fa(t.sequence)} «${t.operation}»: دسته‌ی انتقال (${faNum(t.transferBatch)}) از بچ عملیات (${faNum(t.batch)}) بزرگ‌تر است` });
    }
    for (const c of this.capacityCalc) {
      if (c.error) out.push({ severity: 'danger', text: `${this.fa(c.row.sequence)} «${c.row.operation}» کارکرد ${c.row.capacity} (${c.row.basis}): ${c.error}` });
      if (!c.row.capacityActive) out.push({ severity: 'danger', text: `${this.fa(c.row.sequence)} از نوع کارکرد غیرفعال ${c.row.capacity} استفاده می‌کند` });
    }
    for (const m of this.matrices.filter((x) => x.empty)) out.push({ severity: 'warning', text: `ماتریس زمان تعویض ${m.equipment} (ردیف ${this.fa(m.sequence)}) تعریف نشده` });
    if (this.matrices.length && this.productClassId === null) out.push({ severity: 'warning', text: 'محصول این روش طبقه‌ی تعویض ندارد (FRM-PE-01)' });
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }

  // ───────── نمایش ─────────

  get missingTimings(): TimingRow[] {
    return this.timings.filter((t) => !t.hasTiming);
  }

  get totalMinutes(): number {
    return this.timingCalc.reduce((s, t) => s + t.total, 0);
  }

  cell(m: EquipmentMatrix, from: number, to: number): string {
    if (from === to) return '—';
    const v = m.cells.get(`${from}>${to}`);
    return v === undefined ? '؟' : this.fa(v);
  }

  /** زمان به ساعت و دقیقه */
  hm(min: number): string {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h ? `${this.fa(h)} س ${this.fa(m)} د` : `${this.fa(m)} د`;
  }

  perThousand(v: number): string {
    return faNum(v * 1000, 3);
  }

  get contextLabel(): string {
    return this.routing ? `${this.routing.code} ${this.routing.version} — ${this.routing.title}` : 'زمان عملیات';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.severity === 'danger')) return 'danger';
    return this.issues.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_me03_setup.sql را بررسی کنید.';
    if (this.loading || !this.routing) return 'در حال خواندن…';
    if (this.issues.length) return this.issues.map((i) => i.text).join('؛ ') + '.';
    return `همه‌ی ${this.fa(this.timings.length)} عملیات زمان و کارکرد معتبر دارند؛ جمع زمان برای ${faNum(this.quantity)} ${this.routing.unit}: ${this.hm(this.totalMinutes)}.`;
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
