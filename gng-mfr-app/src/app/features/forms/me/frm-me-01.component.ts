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
import { InstructionRow, Me01Bundle, OperationRow, OpGroupRow, OpIssue, ParameterRow, ResourceRow } from './frm-me-01.data';
import { FrmMe01Service } from './frm-me-01.service';

type Pick = { kind: 'all' } | { kind: 'group'; id: number } | { kind: 'op'; id: number };

/**
 * FRM-ME-01 — «کتابخانه‌ی عملیات».
 *
 * عملیات یک‌بار در کتابخانه تعریف می‌شود و روش‌های ساخت (ME-02) از آن استفاده می‌کنند:
 * درخت گروه، ماهیت، منابع لازم (ایستگاه/گروه منبع، مهارت، ابزار، انرژی)، دستورالعمل
 * چندرسانه‌ای نسخه‌دار و پارامترهای فرایندی هدف با محدوده‌ی مجاز. پنل کناری درخت
 * گروه‌ها با عملیات زیرشان است؛ انتخاب گروه همه‌ی زیرشاخه‌ها را نشان می‌دهد.
 *
 * فاز اول: F-ME-001، 002، 003، 004، 006. چک‌لیست (005) و HSE (007) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-me-01',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-me-01.component.html',
})
export class FrmMe01Component implements OnInit {
  data: Me01Bundle | null = null;
  pickTree: TreeNode<Pick>[] = [];
  selectedPick: TreeNode<Pick> | null = null;
  pick: Pick = { kind: 'all' };

  /* ردیف‌های فیلترشده — در TS ساخته می‌شوند تا قالب ngIf روی tr نداشته باشد */
  groups: OpGroupRow[] = [];
  operations: OperationRow[] = [];
  resources: ResourceRow[] = [];
  instructions: InstructionRow[] = [];
  parameters: ParameterRow[] = [];
  issues: OpIssue[] = [];

  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private me01: FrmMe01Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.me01.load(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.pickTree = this.buildTree(b);
        this.selectedPick = this.pickTree[0];
        this.applyPick();
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-ME-01] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  private buildTree(b: Me01Bundle): TreeNode<Pick>[] {
    const byParent = new Map<number | null, OpGroupRow[]>();
    for (const g of b.groups) byParent.set(g.parentId, [...(byParent.get(g.parentId) ?? []), g]);
    const node = (g: OpGroupRow): TreeNode<Pick> => ({
      key: `g-${g.id}`,
      label: g.title,
      icon: 'pi pi-folder',
      expanded: true,
      data: { kind: 'group', id: g.id },
      children: [
        ...(byParent.get(g.id) ?? []).sort((x, y) => x.sortOrder - y.sortOrder).map(node),
        ...b.operations
          .filter((o) => o.groupId === g.id)
          .map((o) => ({
            key: `o-${o.id}`,
            label: `${o.code} · ${o.title}`,
            icon: o.isActive ? 'pi pi-cog' : 'pi pi-ban',
            styleClass: o.isActive ? '' : 'gng-text-muted',
            data: { kind: 'op', id: o.id } as Pick,
          })),
      ],
    });
    const roots = (byParent.get(null) ?? []).sort((x, y) => x.sortOrder - y.sortOrder).map(node);
    return [{ key: 'all', label: 'همه‌ی عملیات', icon: 'pi pi-book', expanded: true, data: { kind: 'all' }, children: roots }];
  }

  onPick(e: { node: TreeNode<Pick> }): void {
    if (!e.node.data) return;
    this.pick = e.node.data;
    this.applyPick();
  }

  onUnpick(e: { node: TreeNode<Pick> }): void {
    setTimeout(() => (this.selectedPick = e.node));
  }

  /** گروه انتخاب‌شده با همه‌ی زیرگروه‌هایش */
  private groupClosure(id: number): Set<number> {
    const out = new Set<number>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const g of this.data!.groups) {
        if (g.parentId !== null && out.has(g.parentId) && !out.has(g.id)) {
          out.add(g.id);
          grew = true;
        }
      }
    }
    return out;
  }

  private applyPick(): void {
    const b = this.data!;
    let opIds: Set<number>;
    if (this.pick.kind === 'op') {
      opIds = new Set([this.pick.id]);
      this.groups = b.groups.filter((g) => g.id === b.operations.find((o) => o.id === (this.pick as { id: number }).id)?.groupId);
    } else if (this.pick.kind === 'group') {
      const gs = this.groupClosure(this.pick.id);
      opIds = new Set(b.operations.filter((o) => o.groupId !== null && gs.has(o.groupId)).map((o) => o.id));
      this.groups = b.groups.filter((g) => gs.has(g.id));
    } else {
      opIds = new Set(b.operations.map((o) => o.id));
      this.groups = b.groups;
    }
    this.operations = b.operations.filter((o) => opIds.has(o.id));
    this.resources = b.resources.filter((r) => opIds.has(r.operationId));
    this.instructions = b.instructions.filter((i) => opIds.has(i.operationId));
    this.parameters = b.parameters.filter((p) => opIds.has(p.operationId));
    this.issues = this.computeIssues();
  }

  private computeIssues(): OpIssue[] {
    const out: OpIssue[] = [];
    const name = (id: number) => this.data!.operations.find((o) => o.id === id)?.title ?? '';
    for (const o of this.operations.filter((x) => x.isActive)) {
      if ((o.typeCode === 1 || o.typeCode === 3) && !o.resourceCount)
        out.push({ severity: 'danger', text: `${o.code} «${o.title}» عملیات تولیدی است ولی ایستگاه یا گروه منبع ندارد` });
      const docs = this.instructions.filter((i) => i.operationId === o.id);
      if (docs.length && !docs.some((i) => i.statusCode === 2))
        out.push({ severity: 'warning', text: `${o.code} «${o.title}» دستورالعمل تأییدشده ندارد (فقط پیش‌نویس)` });
    }
    const approved = new Map<string, number>();
    for (const i of this.instructions.filter((x) => x.statusCode === 2)) approved.set(i.documentNumber, (approved.get(i.documentNumber) ?? 0) + 1);
    for (const [doc, n] of approved) if (n > 1) out.push({ severity: 'danger', text: `${doc}: ${this.fa(n)} نسخه‌ی تأییدشده‌ی هم‌زمان دارد` });
    for (const p of this.parameters.filter((x) => x.inconsistent))
      out.push({ severity: 'danger', text: `«${name(p.operationId)}» پارامتر «${p.name}»: هدف ${this.num(p.target)} بیرون از محدوده‌ی ${this.num(p.min)} تا ${this.num(p.max)} است` });
    for (const r of this.resources.filter((x) => x.kindCode === 4 && x.isValid === false))
      out.push({ severity: 'danger', text: `«${name(r.operationId)}» از ${r.title} استفاده می‌کند که غیرفعال یا غیرمصرفی است` });
    const emptyTools = new Set(this.resources.filter((x) => x.kindCode === 3 && x.isValid === false).map((x) => x.title));
    for (const t of emptyTools) out.push({ severity: 'warning', text: `گروه ابزار ${t} هیچ ابزار ثبت‌شده‌ای در FRM-RM-02 ندارد` });
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }

  get noInstructionCount(): number {
    return this.operations.filter((o) => o.isActive && o.typeCode <= 3 && !this.instructions.some((i) => i.operationId === o.id)).length;
  }

  opTitle(id: number): string {
    const o = this.data?.operations.find((x) => x.id === id);
    return o ? `${o.code} · ${o.title}` : '';
  }

  natureSeverity(code: number): 'success' | 'info' | 'warning' | 'secondary' {
    if (code === 1) return 'success';
    if (code === 2 || code === 3) return 'info';
    if (code === 5) return 'warning';
    return 'secondary';
  }

  statusSeverity(code: number): 'success' | 'warning' | 'secondary' {
    return code === 2 ? 'success' : code === 1 ? 'warning' : 'secondary';
  }

  /** موقعیت هدف روی نوار حد پایین تا حد بالا (درصد) — برای نمایش بصری محدوده */
  targetPos(p: ParameterRow): number {
    if (p.target === null || p.min === null || p.max === null || p.max === p.min) return 50;
    return Math.max(0, Math.min(100, ((p.target - p.min) / (p.max - p.min)) * 100));
  }

  get contextLabel(): string {
    if (this.pick.kind === 'op') return this.opTitle(this.pick.id);
    if (this.pick.kind === 'group') {
      const id = this.pick.id;
      return this.data?.groups.find((g) => g.id === id)?.path ?? '';
    }
    return 'همه‌ی عملیات کتابخانه';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.severity === 'danger')) return 'danger';
    if (this.issues.length) return 'warning';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_me01_setup.sql را بررسی کنید.';
    if (this.loading || !this.data) return 'در حال خواندن…';
    if (this.issues.length) return this.issues.map((i) => i.text).join('؛ ') + '.';
    return `${this.fa(this.operations.length)} عملیات سازگار؛ منابع، دستورالعمل و پارامترها کامل‌اند.`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  num(n: number | null): string {
    return n === null ? '—' : n.toLocaleString('fa-IR', { maximumFractionDigits: 3 });
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
