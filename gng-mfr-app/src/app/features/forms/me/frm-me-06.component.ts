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
import { faNum } from './me-routing';
import { EffectiveRow, Issue, Me06Bundle, POLICY_FIELDS, PolicyField, PolicyRow, Resolved } from './frm-me-06.data';
import { CODES, FrmMe06Service } from './frm-me-06.service';

type Pick = { kind: 'all' } | { kind: 'policy'; id: number };

/**
 * FRM-ME-06 — «سیاست‌های تغذیه، مصرف و رسید» (کنسول پیکربندی).
 *
 * تنظیماتی که در نسخه‌ی قبل بین فرمول، فرایند و تنظیمات خط پخش بود، این‌جا یک سیاست لایه‌ای است:
 * شرکت ← گروه کالا ← کالا ← عملیات روش. هر فیلد خالی از لایه‌ی بالاتر به ارث می‌رسد و برای هر قلم ×
 * عملیات روش‌های تأییدشده «سیاست مؤثر» با منشأ هر فیلد نمایش داده می‌شود.
 *
 * فاز اول: F-ME-040 تا 049.
 */
@Component({
  selector: 'gng-frm-me-06',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-me-06.component.html',
})
export class FrmMe06Component implements OnInit {
  data: Me06Bundle | null = null;
  pickTree: TreeNode<Pick>[] = [];
  selectedPick: TreeNode<Pick> | null = null;
  selectedPolicy: PolicyRow | null = null;

  effective: EffectiveRow[] = [];
  visible: EffectiveRow[] = [];
  issues: Issue[] = [];

  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private me06: FrmMe06Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.me06.load(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.pickTree = this.buildTree(b.policies);
        this.selectedPick = this.pickTree[0];
        this.effective = b.items.map((item) => ({ item, eff: this.resolve(item) }));
        this.applyPick({ kind: 'all' });
        this.issues = this.validate();
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-ME-06] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  private buildTree(policies: PolicyRow[]): TreeNode<Pick>[] {
    const node = (p: PolicyRow): TreeNode<Pick> => ({
      key: `p-${p.id}`,
      label: this.scopeTitle(p),
      icon: p.scopeCode === 1 ? 'pi pi-building' : p.scopeCode === 2 ? 'pi pi-folder' : p.scopeCode === 3 ? 'pi pi-box' : 'pi pi-cog',
      data: { kind: 'policy', id: p.id },
    });
    const byScope = (s: number) => policies.filter((p) => p.scopeCode === s).map(node);
    const company = policies.find((p) => p.scopeCode === 1);
    return [
      {
        key: 'all',
        label: company ? `${company.name} (همه‌ی اقلام)` : 'همه‌ی اقلام',
        icon: 'pi pi-sitemap',
        expanded: true,
        data: { kind: 'all' },
        children: [
          { key: 's2', label: 'گروه کالا', icon: 'pi pi-folder-open', selectable: false, expanded: true, children: byScope(2) },
          { key: 's3', label: 'کالا', icon: 'pi pi-folder-open', selectable: false, expanded: true, children: byScope(3) },
          { key: 's4', label: 'عملیات روش', icon: 'pi pi-folder-open', selectable: false, expanded: true, children: byScope(4) },
          { key: 's5', label: 'نسخه‌ی تولید', icon: 'pi pi-folder-open', selectable: false, expanded: true, children: byScope(5) },
        ],
      },
    ];
  }

  onPick(e: { node: TreeNode<Pick> }): void {
    if (e.node.data) this.applyPick(e.node.data);
  }

  onUnpick(e: { node: TreeNode<Pick> }): void {
    setTimeout(() => (this.selectedPick = e.node));
  }

  /** با انتخاب یک لایه، اقلامی که آن لایه رویشان اثر دارد نمایش داده می‌شوند */
  private applyPick(p: Pick): void {
    if (p.kind === 'all') {
      this.selectedPolicy = this.data!.policies.find((x) => x.scopeCode === 1) ?? null;
      this.visible = this.effective;
      return;
    }
    const pol = this.data!.policies.find((x) => x.id === p.id)!;
    this.selectedPolicy = pol;
    this.visible = this.effective.filter((e) => this.applies(pol, e.item.productId, e.item.group, e.item.routingOperationId));
  }

  private applies(p: PolicyRow, productId: number, group: string, opId: number): boolean {
    if (p.scopeCode === 1) return true;
    if (p.scopeCode === 2) return p.group === group;
    if (p.scopeCode === 3) return p.productId === productId;
    if (p.scopeCode === 4) return p.routingOperationId === opId;
    return false;
  }

  /** دامنه‌ی خاص‌تر برنده است: عملیات > کالا > گروه > شرکت */
  private resolve(item: { productId: number; group: string; routingOperationId: number }): Record<PolicyField, Resolved> {
    const layers = this.data!.policies
      .filter((p) => this.applies(p, item.productId, item.group, item.routingOperationId))
      .sort((a, b) => b.scopeCode - a.scopeCode);
    const out = {} as Record<PolicyField, Resolved>;
    for (const f of POLICY_FIELDS) {
      const hit = layers.find((p) => p.values[f] !== null && p.values[f] !== undefined);
      out[f] = { value: hit ? hit.values[f]! : null, from: hit ? hit.scope : '—' };
    }
    return out;
  }

  private validate(): Issue[] {
    const out: Issue[] = [];
    const seen = new Set<string>();
    const once = (key: string, i: Issue) => {
      if (!seen.has(key)) {
        seen.add(key);
        out.push(i);
      }
    };
    for (const e of this.effective) {
      const bf = e.eff.consumption.value === 2 || e.eff.consumption.value === 3;
      const excluded = e.eff.excluded.value === true;
      if (bf && !excluded && e.item.isActiveIngredient)
        once(`ai-${e.item.productId}`, { severity: 'danger', text: `«${e.item.product}» عیاردار است ولی با Backflush مصرف می‌شود و استثنا نشده (سیاست ${e.eff.consumption.from})` });
      if (bf && !excluded && (e.item.trackingCode === 2 || e.item.trackingCode === 3))
        once(`sn-${e.item.productId}`, { severity: 'danger', text: `«${e.item.product}» ردیابی سریالی دارد ولی Backflush می‌شود` });
      if (e.eff.shortage.value === 2) once(`neg-${e.item.productId}`, { severity: 'warning', text: `«${e.item.product}» اجازه‌ی موجودی منفی دارد (سیاست ${e.eff.shortage.from})` });
      if (e.eff.transferBasis.value === 1) once(`tr-${e.item.productId}`, { severity: 'warning', text: `«${e.item.product}» کل مقدار سفارش را به پای کار منتقل می‌کند (رفتار نسخه‌ی قبل)` });
      if (e.eff.consumptionControl.value === 1 && e.item.minConsumption !== null)
        once(`cc-${e.item.productId}`, { severity: 'warning', text: `«${e.item.product}» محدوده‌ی مصرف دارد ولی کنترل نمی‌شود` });
    }
    for (const p of this.data!.policies) {
      const min = p.values.minStock as number | null;
      const max = p.values.maxStock as number | null;
      const rp = p.values.reorderPoint as number | null;
      if (min !== null && max !== null && min > max) out.push({ severity: 'danger', text: `سیاست «${p.name}»: حداقل موجودی پای کار (${faNum(min)}) از حداکثر (${faNum(max)}) بیشتر است` });
      else if (rp !== null && ((min !== null && rp < min) || (max !== null && rp > max)))
        out.push({ severity: 'warning', text: `سیاست «${p.name}»: نقطه‌ی فراخوان بیرون از بازه‌ی حداقل/حداکثر است` });
      if (p.values.excluded === true && !p.values.exclusionReason) out.push({ severity: 'warning', text: `سیاست «${p.name}» استثنا از Backflush بدون دلیل دارد` });
    }
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }

  // ───────── نمایش ─────────

  scopeTitle(p: PolicyRow): string {
    return p.scopeCode === 2 ? p.group : p.scopeCode === 3 ? p.product : p.scopeCode === 4 ? p.operation : p.scopeCode === 5 ? p.version : p.name;
  }

  /** متن مقدار مؤثر یک فیلد کددار */
  label(field: keyof typeof CODES, r: Resolved): string {
    return r.value === null ? '—' : CODES[field][r.value as number] ?? String(r.value);
  }

  text(r: Resolved): string {
    if (r.value === null) return '—';
    if (typeof r.value === 'number') return faNum(r.value);
    if (typeof r.value === 'boolean') return r.value ? 'بله' : 'خیر';
    return r.value;
  }

  get excludedRows(): EffectiveRow[] {
    return this.visible.filter((e) => e.eff.excluded.value === true || e.item.isActiveIngredient || e.item.trackingCode === 2 || e.item.trackingCode === 3);
  }

  get contextLabel(): string {
    const p = this.selectedPolicy;
    return p ? `${p.scope}: ${this.scopeTitle(p)}` : 'سیاست‌های مواد';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.severity === 'danger')) return 'danger';
    return this.issues.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_me06_setup.sql را بررسی کنید.';
    if (this.loading || !this.data) return 'در حال خواندن…';
    if (this.issues.length) return this.issues.map((i) => i.text).join('؛ ') + '.';
    return `سیاست مؤثر ${this.fa(this.effective.length)} قلم × عملیات سازگار است.`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
