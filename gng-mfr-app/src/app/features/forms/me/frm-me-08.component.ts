import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { ROUTING_STATUS, faNum } from './me-routing';
import { Issue, SelectionRow, VersionRow } from './frm-me-08.data';
import { FrmMe08Service } from './frm-me-08.service';

/**
 * FRM-ME-08 — «نسخه‌ی تولید»: پل ساختار محصول و روش ساخت.
 *
 * هر نسخه ترکیب محصول + ساختار + روش + دامنه‌ی مکانی + محدوده‌ی بچ است، با انواع مجاز دستور کار،
 * اعتبار و اولویت، چرخه‌ی عمر، هزینه/زمان مبنا و مبنای دستور (مقدار یا شیفت). سازگاری اجزا
 * کنترل می‌شود و انتخاب خودکار نسخه برای یک سفارش فرضی زنده شبیه‌سازی می‌شود (اقدام فقط‌خواندنی).
 *
 * فاز اول: F-ME-059 تا 063، 065، 066، 067. انتخاب دستی با دلیل (064) با فرم دستور کار می‌آید.
 */
@Component({
  selector: 'gng-frm-me-08',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DropdownModule, InputNumberModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-me-08.component.html',
})
export class FrmMe08Component implements OnInit {
  versions: VersionRow[] = [];
  pickTree: TreeNode<{ id: number }>[] = [];
  selectedPick: TreeNode<{ id: number }> | null = null;
  version: VersionRow | null = null;
  siblings: VersionRow[] = [];
  issues: Issue[] = [];
  versionIssues: Issue[] = [];

  /* شبیه‌ساز انتخاب خودکار */
  simProduct: number | null = null;
  simLine: number | null = null;
  simQuantity: number | null = null;
  simDate = new Date().toISOString().slice(0, 10);
  simOrderType = 1;
  simRows: SelectionRow[] = [];
  simRunning = false;
  productOptions: { label: string; value: number }[] = [];
  lineOptions: { label: string; value: number }[] = [];
  readonly orderTypes = [
    { label: 'عادی', value: 1 },
    { label: 'دوباره‌کاری', value: 2 },
    { label: 'نمونه', value: 3 },
    { label: 'کارمزدی', value: 4 },
  ];

  readonly routingStatus = ROUTING_STATUS;
  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  constructor(private me08: FrmMe08Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.me08.versions(this.companyId).subscribe({
      next: (v) => {
        this.versions = v;
        this.pickTree = this.buildTree(v);
        this.productOptions = [...new Map(v.map((x) => [x.productId, { label: x.product, value: x.productId }])).values()];
        this.lineOptions = [...new Map(v.filter((x) => x.lineId).map((x) => [x.lineId!, { label: x.line, value: x.lineId! }])).values()];
        this.issues = this.validateAll();
        this.select(v.find((x) => x.statusCode === 3)?.id ?? v[0]?.id ?? null);
        this.loading = false;
      },
      error: (err) => {
        console.warn('[FRM-ME-08] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  private buildTree(v: VersionRow[]): TreeNode<{ id: number }>[] {
    const byProduct = new Map<string, VersionRow[]>();
    for (const x of v) byProduct.set(x.product, [...(byProduct.get(x.product) ?? []), x]);
    return [...byProduct.entries()].map(([product, rows]) => ({
      key: `p-${product}`,
      label: product,
      icon: 'pi pi-box',
      selectable: false,
      expanded: true,
      children: rows.map((x) => ({
        key: `v-${x.id}`,
        label: `${x.code} — ${x.title}`,
        icon: x.statusCode === 3 ? 'pi pi-check-circle' : x.statusCode === 1 ? 'pi pi-pencil' : x.statusCode === 2 ? 'pi pi-clock' : 'pi pi-ban',
        styleClass: x.statusCode >= 4 ? 'gng-text-muted' : '',
        data: { id: x.id },
      })),
    }));
  }

  onPick(e: { node: TreeNode<{ id: number }> }): void {
    if (e.node.data) this.select(e.node.data.id);
  }

  onUnpick(e: { node: TreeNode<{ id: number }> }): void {
    setTimeout(() => (this.selectedPick = e.node));
  }

  private select(id: number | null): void {
    this.version = this.versions.find((v) => v.id === id) ?? null;
    this.selectedPick = this.pickTree.flatMap((g) => g.children ?? []).find((n) => n.data?.id === id) ?? null;
    this.siblings = this.version ? this.versions.filter((v) => v.productId === this.version!.productId) : [];
    this.versionIssues = this.version ? this.check(this.version) : [];
    if (this.version) {
      this.simProduct = this.version.productId;
      this.simLine = this.version.lineId ?? this.lineOptions[0]?.value ?? null;
      this.simQuantity = this.version.minBatch !== null && this.version.maxBatch !== null ? (this.version.minBatch + this.version.maxBatch) / 2 : this.version.minBatch;
      this.simOrderType = this.version.allowsToll && !this.version.allowsStandard ? 4 : this.version.allowsSample && !this.version.allowsStandard ? 3 : 1;
      this.simulate();
    }
  }

  /** سازگاری اجزای یک نسخه */
  private check(v: VersionRow): Issue[] {
    const out: Issue[] = [];
    const live = v.statusCode === 3 || v.statusCode === 2;
    const sev: 'danger' | 'warning' = live ? 'danger' : 'warning';
    if (!v.routingAssigned) out.push({ severity: sev, text: `${v.code}: روش ${v.routing} به ساختار این نسخه اختصاص ندارد (FRM-ME-02)` });
    if (!v.productMatches) out.push({ severity: sev, text: `${v.code}: محصول اصلی ساختار با محصول نسخه یکی نیست` });
    if (live && v.routingStatusCode !== 3) out.push({ severity: 'danger', text: `${v.code} فعال است ولی روش آن «${this.routingStatus[v.routingStatusCode]}» است` });
    if (live && v.routingValidTo && new Date(v.routingValidTo) < new Date()) out.push({ severity: 'danger', text: `${v.code}: اعتبار روش ساخت گذشته` });
    if (live && v.structureStatusCode !== 3) out.push({ severity: 'danger', text: `${v.code}: ساختار محصول تأییدشده نیست` });
    if (v.minBatch !== null && v.routingMinBatch !== null && v.minBatch < v.routingMinBatch)
      out.push({ severity: 'warning', text: `${v.code}: حداقل بچ نسخه (${faNum(v.minBatch)}) کمتر از حداقل روش (${faNum(v.routingMinBatch)}) است` });
    if (v.maxBatch !== null && v.routingMaxBatch !== null && v.maxBatch > v.routingMaxBatch)
      out.push({ severity: 'warning', text: `${v.code}: حداکثر بچ نسخه (${faNum(v.maxBatch)}) بیشتر از حداکثر روش (${faNum(v.routingMaxBatch)}) است` });
    if (v.routingTypeCode === 2 && v.orderBasisCode !== 2) out.push({ severity: 'warning', text: `${v.code}: روش پیوسته است ولی مبنای دستور شیفت نیست` });
    if (v.statusCode === 3 && !v.approver) out.push({ severity: 'warning', text: `${v.code} فعال است ولی تأییدکننده ندارد` });
    if (!v.allowsStandard && !v.allowsRework && !v.allowsSample && !v.allowsToll) out.push({ severity: 'danger', text: `${v.code} هیچ نوع دستور کاری را مجاز نکرده` });
    return out;
  }

  private validateAll(): Issue[] {
    const out = this.versions.flatMap((v) => this.check(v));
    const active = this.versions.filter((v) => v.statusCode === 3);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        if (a.productId !== b.productId || a.priority !== b.priority) continue;
        if (a.lineId !== null && b.lineId !== null && a.lineId !== b.lineId) continue;
        const types = (x: VersionRow) => [x.allowsStandard, x.allowsRework, x.allowsSample, x.allowsToll];
        if (!types(a).some((t, k) => t && types(b)[k])) continue;
        const lo = Math.max(a.minBatch ?? 0, b.minBatch ?? 0);
        const hi = Math.min(a.maxBatch ?? Infinity, b.maxBatch ?? Infinity);
        if (lo <= hi) out.push({ severity: 'warning', text: `${a.code} و ${b.code} با اولویت یکسان در بازه‌ی بچ ${faNum(lo)} تا ${faNum(hi)} هم‌پوشانی دارند — انتخاب خودکار به باریک‌ترین بازه تکیه می‌کند` });
      }
    }
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }

  simulate(): void {
    if (!this.simProduct || !this.simLine || this.simQuantity === null) return;
    this.simRunning = true;
    this.me08.select(this.simProduct, this.simLine, this.simQuantity, this.simDate, this.simOrderType, this.companyId).subscribe({
      next: (rows) => {
        this.simRows = rows;
        this.simRunning = false;
      },
      error: () => (this.simRunning = false),
    });
  }

  // ───────── نمایش ─────────

  get simWinner(): SelectionRow | undefined {
    return this.simRows.find((r) => r.selected);
  }

  get simReason(): string {
    const w = this.simWinner;
    if (!w) return 'هیچ نسخه‌ای واجد شرایط نیست؛ دستور کار بدون انتخاب دستی صادر نمی‌شود.';
    if (w.eligibleCount === 1) return `${w.code} تنها نسخه‌ی واجد شرایط است.`;
    return `${w.code} از بین ${this.fa(w.eligibleCount)} نسخه‌ی واجد شرایط، بالاترین اولویت (کمترین عدد) را دارد؛ در اولویت برابر، باریک‌ترین بازه‌ی بچ برنده است.`;
  }

  statusSeverity(code: number): 'success' | 'warning' | 'info' | 'secondary' | 'danger' {
    return code === 3 ? 'success' : code === 2 ? 'info' : code === 1 ? 'warning' : code === 4 ? 'danger' : 'secondary';
  }

  orderTypesOf(v: VersionRow): string {
    const t: string[] = [];
    if (v.allowsStandard) t.push('عادی');
    if (v.allowsRework) t.push('دوباره‌کاری');
    if (v.allowsSample) t.push('نمونه');
    if (v.allowsToll) t.push('کارمزدی');
    return t.join('، ') || '—';
  }

  get contextLabel(): string {
    return this.version ? `${this.version.code} — ${this.version.title}` : 'نسخه‌ی تولید';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.severity === 'danger')) return 'danger';
    return this.issues.length ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_me08_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن…';
    if (this.issues.length) return this.issues.map((i) => i.text).join('؛ ') + '.';
    return `${this.fa(this.versions.length)} نسخه‌ی تولید سازگار؛ اجزای هر نسخه با هم می‌خوانند.`;
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
