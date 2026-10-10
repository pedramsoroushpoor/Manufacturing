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
import { ECO_STEPS, EcoRow, ImpactRow, Pe09Bundle } from './frm-pe-09.data';
import { FrmPe09Service } from './frm-pe-09.service';

/**
 * FRM-PE-09 — «مدیریت تغییر مهندسی (ECO)».
 *
 * فهرست ECOها در پنل کناری؛ برای ECO انتخاب‌شده: درخواست و منشأ، دامنه‌ی چندموجودیتی،
 * تحلیل اثر (کاربرد معکوس چندسطحی)، سیاست موجودی موجود، زنجیره‌ی امضا و اطلاع‌رسانی.
 *
 * فاز اول: F-PE-069، 070، 071، 073، 074 — فقط خواندنی. فعال‌سازی اتمیک (072) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-pe-09',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-pe-09.component.html',
})
export class FrmPe09Component implements OnInit {
  readonly steps = ECO_STEPS;
  data: Pe09Bundle | null = null;
  ecoTree: TreeNode<EcoRow>[] = [];
  selectedNode: TreeNode<EcoRow> | null = null;
  loading = false;
  loadFailed = false;

  constructor(private pe09: FrmPe09Service) {}

  ngOnInit(): void {
    this.load(null);
  }

  load(ecoId: number | null): void {
    this.loading = true;
    this.pe09.bundle(ecoId).subscribe({
      next: (b) => {
        this.data = b;
        this.ecoTree = this.buildTree(b.ecos);
        this.selectedNode = this.ecoTree.flatMap((g) => g.children ?? []).find((n) => n.data?.id === b.ecoId) ?? null;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  /** گروه‌بندی بر اساس وضعیت: باز (۱..۴) بالا، اجراشده و ردشده پایین. */
  private buildTree(ecos: EcoRow[]): TreeNode<EcoRow>[] {
    const groups: { label: string; codes: number[] }[] = [
      { label: 'باز', codes: [1, 2, 3, 4] },
      { label: 'اجراشده', codes: [5] },
      { label: 'ردشده', codes: [6] },
    ];
    return groups
      .map((g) => ({
        label: g.label,
        selectable: false,
        expanded: true,
        children: ecos
          .filter((e) => g.codes.includes(e.statusCode))
          .map((e) => ({ key: String(e.id), label: `${e.number} — ${e.title}`, data: e, icon: this.ecoIcon(e.statusCode) })),
      }))
      .filter((g) => g.children.length);
  }

  private ecoIcon(code: number): string {
    if (code === 5) return 'pi pi-check-circle';
    if (code === 6) return 'pi pi-times-circle';
    if (code === 3) return 'pi pi-lock';
    return 'pi pi-file-edit';
  }

  onPick(e: { node: TreeNode<EcoRow> }): void {
    if (e.node.data && e.node.data.id !== this.data?.ecoId) this.load(e.node.data.id);
  }

  get eco(): EcoRow | null {
    return this.data?.ecos.find((e) => e.id === this.data?.ecoId) ?? null;
  }

  stepClass(i: number): string {
    const code = this.eco?.statusCode ?? 0;
    if (code === 6) return i === 0 ? 'gng-step--done' : '';
    if (i + 1 < code || code === 5) return 'gng-step--done';
    if (i + 1 === code) return 'gng-step--active';
    return '';
  }

  get directImpact(): ImpactRow[] {
    return this.data?.impact.filter((r) => r.kind === 'direct') ?? [];
  }

  get upstreamImpact(): ImpactRow[] {
    return this.data?.impact.filter((r) => r.kind === 'upstream') ?? [];
  }

  get upstreamInCurrent(): number {
    return this.upstreamImpact.filter((r) => r.inCurrent).length;
  }

  get maxLevel(): number {
    return this.upstreamImpact.reduce((m, r) => Math.max(m, r.level), 0);
  }

  get pendingApprovals(): number {
    return this.data?.approvals.filter((a) => a.decisionCode === null).length ?? 0;
  }

  decisionLabel(code: number | null): string {
    return code === 1 ? 'تأیید و امضا شد' : code === 2 ? 'رد شد' : 'در انتظار امضا';
  }

  decisionSeverity(code: number | null): 'success' | 'danger' | 'warning' {
    return code === 1 ? 'success' : code === 2 ? 'danger' : 'warning';
  }

  statusSeverity(code: number): 'success' | 'danger' | 'warning' | 'info' | 'secondary' {
    if (code === 5) return 'success';
    if (code === 6) return 'danger';
    if (code === 3) return 'warning';
    if (code === 4) return 'info';
    return 'secondary';
  }

  get contextLabel(): string {
    return this.eco ? `شماره ECO: ${this.eco.number}` : 'مدیریت تغییر مهندسی';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    const e = this.eco;
    if (!e) return 'info';
    if (e.statusCode === 5) return 'success';
    if (e.statusCode === 6) return 'danger';
    if (!e.inventoryPolicyCode || this.pendingApprovals) return 'warning';
    return 'info';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pe09_setup.sql را بررسی کنید.';
    const e = this.eco;
    if (!e) return 'ECO ثبت نشده است.';
    const parts = [`${e.number} — ${e.status}`];
    parts.push(`${this.fa(e.itemCount)} موجودیت در دامنه، ${this.fa(this.upstreamImpact.length)} ساختار بالادستی متأثر`);
    if (e.approverCount) parts.push(`${this.fa(e.signedCount)} امضا از ${this.fa(e.approverCount)} امضای الزامی`);
    if (this.pendingApprovals && e.statusCode === 3) parts.push(`در انتظار امضای ${this.data!.approvals.find((a) => a.decisionCode === null)!.role}`);
    if (!e.inventoryPolicyCode && e.statusCode < 5) parts.push('سیاست موجودی موجود هنوز تعیین نشده');
    if (!e.effectiveDate || e.effectiveDate === '—') parts.push('تاریخ اثر تعیین نشده');
    return parts.join('؛ ') + '.';
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: 222 };
  }
}
