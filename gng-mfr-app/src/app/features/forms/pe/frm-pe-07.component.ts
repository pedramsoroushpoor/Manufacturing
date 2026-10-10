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
import { ConditionRow, FeatureGroup, Issue, ModelRow, Pe07Bundle, ResolvedRow, RuleRow, Violation } from './frm-pe-07.data';
import { FrmPe07Service } from './frm-pe-07.service';

/**
 * FRM-PE-07 — «پیکربندی محصول».
 *
 * مدل پیکربندی روی یک کالا و ساختار: ویژگی‌ها و مقادیر مجاز با پیش‌فرض، قواعد سازگاری (الزام/منع)،
 * شرط ردیف‌های ساختار بر مبنای انتخاب‌ها، و ساختار مؤثر برای یک ترکیب انتخاب که زنده حساب
 * می‌شود (اقدام فقط‌خواندنی). فیچر الزامی ندارد و به درخواست صریح کاربر ساخته شد.
 * نگهداری پیکربندی روی سفارش و بچ (F-PE-061) با دستور کار می‌آید.
 */
@Component({
  selector: 'gng-frm-pe-07',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DropdownModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-pe-07.component.html',
})
export class FrmPe07Component implements OnInit {
  data: Pe07Bundle | null = null;
  pickTree: TreeNode<{ id: number }>[] = [];
  selectedPick: TreeNode<{ id: number }> | null = null;
  model: ModelRow | null = null;
  features: FeatureGroup[] = [];
  rules: RuleRow[] = [];
  conditions: ConditionRow[] = [];
  issues: Issue[] = [];

  violations: Violation[] = [];
  resolved: ResolvedRow[] = [];
  resolving = false;

  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private pe07: FrmPe07Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.pe07.load(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.pickTree = b.models.map((m) => ({ key: `m-${m.id}`, label: `${m.code} — ${m.title}`, icon: 'pi pi-sliders-v', data: { id: m.id } }));
        this.select(b.models[0]?.id ?? null);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-PE-07] خواندن داده ناموفق بود:', err?.message || err);
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
    this.model = b.models.find((m) => m.id === id) ?? null;
    this.selectedPick = this.pickTree.find((n) => n.data?.id === id) ?? null;
    const values = b.values.filter((v) => v.modelId === id);
    const groups = new Map<number, FeatureGroup>();
    for (const v of values) {
      const g = groups.get(v.featureId) ?? { featureId: v.featureId, feature: v.feature, mandatory: v.mandatory, values: [], selected: null, hasEffect: false };
      g.values.push(v);
      if (v.isDefault) g.selected = v.valueId;
      if (v.conditionCount) g.hasEffect = true;
      groups.set(v.featureId, g);
    }
    this.features = [...groups.values()];
    this.rules = b.rules.filter((r) => r.modelId === id);
    this.conditions = b.conditions.filter((c) => c.modelId === id);
    this.issues = this.validate();
    this.resolve();
  }

  private validate(): Issue[] {
    const out: Issue[] = [];
    for (const f of this.features) {
      if (!f.hasEffect) out.push({ severity: 'warning', text: `ویژگی «${f.feature}» روی هیچ ردیف ساختاری اثر ندارد` });
      if (f.values.filter((v) => v.isDefault).length !== 1) out.push({ severity: 'warning', text: `ویژگی «${f.feature}» باید دقیقاً یک مقدار پیش‌فرض داشته باشد` });
    }
    for (const c of this.conditions.filter((x) => !x.hasProductionRole))
      out.push({ severity: 'warning', text: `قلم شرطی «${c.product}» (${c.valueTitle}) نقش تولیدی ندارد (FRM-PE-01)` });
    const defaults = new Set(this.features.map((f) => f.selected));
    for (const r of this.rules) {
      const hit = defaults.has(r.ifValueId) && (r.typeCode === 1 ? !defaults.has(r.thenValueId) : defaults.has(r.thenValueId));
      if (hit) out.push({ severity: 'danger', text: `ترکیب پیش‌فرض قاعده‌ی «${r.message || r.ifTitle}» را نقض می‌کند` });
    }
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }

  /** ساختار مؤثر برای انتخاب‌های فعلی (فقط‌خواندنی) */
  resolve(): void {
    if (!this.model) return;
    this.resolving = true;
    const ids = this.features.map((f) => f.selected).filter((v): v is number => v !== null);
    this.pe07.resolve(this.model.id, ids).subscribe({
      next: (r) => {
        this.violations = r.violations;
        this.resolved = r.items;
        this.resolving = false;
      },
      error: () => (this.resolving = false),
    });
  }

  resetDefaults(): void {
    for (const f of this.features) f.selected = f.values.find((v) => v.isDefault)?.valueId ?? null;
    this.resolve();
  }

  // ───────── نمایش ─────────

  optionsOf(f: FeatureGroup): { label: string; value: number }[] {
    return f.values.map((v) => ({ label: v.value + (v.isDefault ? ' (پیش‌فرض)' : ''), value: v.valueId }));
  }

  statusLabel(s: ResolvedRow['status']): string {
    return s === 'base' ? 'ثابت' : s === 'conditional' ? 'شرطی — شامل' : s === 'added' ? 'افزوده' : 'حذف‌شده';
  }

  statusSeverity(s: ResolvedRow['status']): 'secondary' | 'info' | 'success' | 'danger' {
    return s === 'base' ? 'secondary' : s === 'conditional' ? 'info' : s === 'added' ? 'success' : 'danger';
  }

  get effectiveCount(): number {
    return this.resolved.filter((r) => r.status !== 'excluded').length;
  }

  get contextLabel(): string {
    return this.model ? `${this.model.code} — ${this.model.product}` : 'پیکربندی محصول';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.severity === 'danger')) return 'danger';
    return this.issues.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pe07_setup.sql را بررسی کنید.';
    if (this.loading || !this.model) return 'در حال خواندن…';
    if (this.issues.length) return this.issues.map((i) => i.text).join('؛ ') + '.';
    return `مدل ${this.model.code} سازگار است؛ ترکیب پیش‌فرض قواعد را نقض نمی‌کند.`;
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
