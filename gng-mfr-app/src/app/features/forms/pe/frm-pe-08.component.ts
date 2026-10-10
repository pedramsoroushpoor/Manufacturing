import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeTableModule } from 'primeng/treetable';
import { TreeNode } from 'primeng/api';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { ExplodeNode, Option, RequirementRow, WhereUsedRow } from './frm-pe-08.data';
import { FrmPe08Service } from './frm-pe-08.service';

/**
 * FRM-PE-08 — «نماها و محاسبات ساختار»: کنسول تحلیلی مشترک، نه چند گزارش جدا.
 *
 * درخت چندسطحی تا آخرین لایه با فانتوم شفاف، بسط برای مقدار دلخواه با ضایعات و
 * گرد کردن، کاربرد معکوس تک/چندسطحی، و کنترل حلقه‌ی بازگشتی.
 *
 * فاز اول: F-PE-062، 063، 064، 066. خواص تجمعی (065) و شبیه‌سازی (067) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-pe-08',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DropdownModule,
    InputNumberModule,
    TabViewModule,
    TableModule,
    TagModule,
    TreeTableModule,
    OperationalFormLayoutComponent,
    DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pe-08.component.html',
})
export class FrmPe08Component implements OnInit {
  structureOptions: (Option & { base: number | null; unit: string })[] = [];
  productOptions: Option[] = [];

  structureId: number | null = null;
  quantity: number | null = null;
  applyWaste = true;
  nodes: ExplodeNode[] = [];
  tree: TreeNode<ExplodeNode>[] = [];
  requirements: RequirementRow[] = [];
  exploding = false;

  productId: number | null = null;
  multiLevel = true;
  whereUsed: WhereUsedRow[] | null = null;
  searching = false;

  cycles: string[] | null = null;
  edgeCount = 0;
  loadFailed = false;

  constructor(private pe08: FrmPe08Service) {}

  ngOnInit(): void {
    this.pe08.structures().subscribe({
      next: (s) => {
        this.structureOptions = s;
        const first = s.find((x) => x.label.includes('BOM-1002')) ?? s[0];
        if (first) {
          this.structureId = first.value;
          this.quantity = first.base;
          this.explode();
        }
      },
      error: () => (this.loadFailed = true),
    });
    this.pe08.products().subscribe((p) => {
      this.productOptions = p;
      this.productId = p.find((x) => x.label.startsWith('P-3002'))?.value ?? p[0]?.value ?? null;
      this.runWhereUsed();
    });
    this.pe08.cycles().subscribe((c) => {
      this.cycles = c.cycles;
      this.edgeCount = c.edges;
    });
  }

  onStructureChange(): void {
    this.quantity = this.structureOptions.find((s) => s.value === this.structureId)?.base ?? null;
    this.explode();
  }

  get unit(): string {
    return this.structureOptions.find((s) => s.value === this.structureId)?.unit ?? '';
  }

  explode(): void {
    if (!this.structureId) return;
    this.exploding = true;
    this.pe08.explode(this.structureId, this.quantity, this.applyWaste).subscribe({
      next: (nodes) => {
        this.nodes = nodes;
        this.tree = this.buildTree(nodes);
        this.requirements = this.aggregate(nodes);
        this.exploding = false;
      },
      error: () => {
        this.exploding = false;
        this.loadFailed = true;
      },
    });
  }

  private buildTree(nodes: ExplodeNode[]): TreeNode<ExplodeNode>[] {
    const map = new Map<string, TreeNode<ExplodeNode>>();
    const roots: TreeNode<ExplodeNode>[] = [];
    for (const n of nodes) map.set(n.key, { key: n.key, data: n, expanded: true, children: [] });
    for (const n of nodes) (n.parentKey ? map.get(n.parentKey)?.children : roots)?.push(map.get(n.key)!);
    return roots;
  }

  /** نیاز ناخالص: جمع برگ‌ها به‌ازای کالا. نیمه‌ساخته‌ی بسط‌یافته و فانتوم در جمع نمی‌آیند. */
  private aggregate(nodes: ExplodeNode[]): RequirementRow[] {
    const m = new Map<number, RequirementRow>();
    for (const n of nodes.filter((x) => x.isLeaf && x.required !== null)) {
      const r = m.get(n.productId) ?? { product: n.product, unit: n.unit, required: 0, paths: 0 };
      r.required += n.required!;
      r.paths++;
      m.set(n.productId, r);
    }
    return [...m.values()].sort((a, b) => a.product.localeCompare(b.product));
  }

  runWhereUsed(): void {
    if (!this.productId) return;
    this.searching = true;
    this.pe08.whereUsed(this.productId, this.multiLevel).subscribe({
      next: (rows) => {
        this.whereUsed = rows;
        this.searching = false;
      },
      error: () => (this.searching = false),
    });
  }

  get depth(): number {
    return this.nodes.reduce((d, n) => Math.max(d, n.level), 0);
  }

  get formulaCount(): number {
    return this.nodes.filter((n) => n.formula).length;
  }

  get contextLabel(): string {
    return this.structureOptions.find((s) => s.value === this.structureId)?.label ?? 'کنسول تحلیلی ساختار';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.cycles?.length || this.nodes.some((n) => n.isCycle)) return 'danger';
    if (this.formulaCount) return 'warning';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pe08_setup.sql را بررسی کنید.';
    const parts: string[] = [];
    if (this.cycles?.length) parts.push(`حلقه‌ی بازگشتی در ساختارها: ${this.cycles.join('؛ ')}`);
    else if (this.cycles) parts.push(`حلقه‌ی بازگشتی در ${this.fa(this.edgeCount)} رابطه‌ی ساختارهای پیش‌فرض یافت نشد`);
    if (this.nodes.length) parts.push(`بسط تا ${this.fa(this.depth)} سطح، ${this.fa(this.requirements.length)} ماده‌ی برگ`);
    if (this.formulaCount) parts.push(`${this.fa(this.formulaCount)} ردیف فرمولی در بسط حساب نشده (مقدارش هنگام دستور تولید معلوم می‌شود)`);
    return parts.join('؛ ') + '.';
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR', { maximumFractionDigits: 3 });
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: 222 };
  }
}
