import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EMPTY, Subject, Subscription, catchError, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { CapabilityRow, ContractorIssue, ContractorRow, InventoryRow, RateRow } from './frm-rm-08.data';
import { FrmRm08Service } from './frm-rm-08.service';
import { DEMO_COMPANY_ID } from './rm-scope';

/** گره‌ی پنل کناری: null یعنی «همه‌ی پیمانکاران». */
type ContractorPick = { id: number | null };

/**
 * FRM-RM-08 — «پیمانکاران تولید».
 *
 * پیمانکار فعلاً با جدول‌های مستقل تعریف می‌شود و در درخت سازمانی نیست؛ پس پنل
 * کناری این فرم فهرست پیمانکاران است و با انتخاب یکی، همه‌ی تب‌ها به همان
 * پیمانکار محدود می‌شوند.
 *
 * فاز اول: F-RM-054 تا 057. لحاظ ظرفیت پیمانکار در نمای ظرفیت کل (058) و
 * ارزیابی عملکرد (059) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-rm-08',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TabViewModule,
    TableModule,
    TagModule,
    TreeModule,
    OperationalFormLayoutComponent,
    DataSourceBadgeComponent,
  ],
  templateUrl: './frm-rm-08.component.html',
})
export class FrmRm08Component implements OnInit, OnDestroy {
  pickTree: TreeNode<ContractorPick>[] = [];
  selectedPick: TreeNode<ContractorPick> | null = null;
  contractorId: number | null = null;

  contractors: ContractorRow[] = [];
  capabilities: CapabilityRow[] = [];
  rates: RateRow[] = [];
  inventories: InventoryRow[] = [];
  issues: ContractorIssue[] = [];

  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  private readonly load$ = new Subject<void>();
  private readonly sub = new Subscription();

  constructor(private rm08: FrmRm08Service) {}

  ngOnInit(): void {
    this.sub.add(
      this.load$
        .pipe(
          tap(() => (this.loading = true)),
          switchMap(() =>
            this.rm08.load(this.contractorId, this.companyId).pipe(
              catchError((err) => {
                console.warn('[FRM-RM-08] خواندن داده ناموفق بود:', err?.message || err);
                this.loading = false;
                this.loadFailed = true;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((b) => {
          this.contractors = b.contractors;
          this.capabilities = b.capabilities;
          this.rates = b.rates;
          this.inventories = b.inventories;
          this.issues = b.issues;
          if (!this.pickTree.length) this.buildPickTree();
          this.loadFailed = false;
          this.loading = false;
        })
    );
    this.load$.next();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private buildPickTree(): void {
    const root: TreeNode<ContractorPick> = {
      key: 'all',
      label: 'همه‌ی پیمانکاران',
      icon: 'pi pi-briefcase',
      expanded: true,
      data: { id: null },
      children: this.contractors.map((c) => ({
        key: `c-${c.id}`,
        label: c.active ? `${c.code} — ${c.title}` : `${c.code} — ${c.title} (غیرفعال)`,
        icon: 'pi pi-building',
        styleClass: c.active ? '' : 'gng-text-muted',
        data: { id: c.id },
      })),
    };
    this.pickTree = [root];
    this.selectedPick = root;
  }

  // ---- انتخاب پیمانکار ----

  onPick(event: { node: TreeNode<ContractorPick> }): void {
    if (!event.node?.data) return;
    this.contractorId = event.node.data.id;
    this.load$.next();
  }

  /** کلیک دوباره روی گره‌ی انتخاب‌شده نباید فرم را بدون انتخاب بگذارد. */
  onUnpick(event: { node: TreeNode<ContractorPick> }): void {
    setTimeout(() => (this.selectedPick = event.node));
  }

  // ---- متن‌ها و کمک‌تابع‌های قالب ----

  get selected(): ContractorRow | null {
    return this.contractorId === null ? null : this.contractors.find((c) => c.id === this.contractorId) ?? null;
  }

  get contextLabel(): string {
    return this.selected ? `${this.selected.code} — ${this.selected.title}` : 'همه‌ی پیمانکاران';
  }

  get visibleContractors(): ContractorRow[] {
    return this.selected ? [this.selected] : this.contractors;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (!this.contractors.length) return 'info';
    if (this.issues.some((i) => i.tone === 'danger')) return 'danger';
    if (this.issues.length) return 'warning';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) {
      return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_rm08_setup.sql را بررسی کنید.';
    }
    if (!this.contractors.length) return 'هنوز پیمانکاری تعریف نشده است.';
    if (this.issues.length) {
      const ordered = [...this.issues.filter((i) => i.tone === 'danger'), ...this.issues.filter((i) => i.tone === 'warning')];
      return ordered.map((i) => i.text).join('؛ ') + '.';
    }
    const active = this.contractors.filter((c) => c.active).length;
    return this.selected
      ? `${this.selected.title}: قرارداد و تأیید صلاحیت معتبر است و موردی برای پیگیری نیست.`
      : `${this.fa(active)} پیمانکار فعال؛ موردی برای پیگیری نیست.`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  rateTone(status: RateRow['status']): 'success' | 'info' | 'secondary' {
    return status === 'current' ? 'success' : status === 'future' ? 'info' : 'secondary';
  }

  rateLabel(status: RateRow['status']): string {
    return status === 'current' ? 'جاری' : status === 'future' ? 'آینده' : 'گذشته';
  }

  // ---- منبع داده‌ی زنده‌ی هر گرید (دکمه‌ی سه‌نقطه‌ی گوشه) ----

  contractorsSource(): DataSourceInfo {
    return { key: 'rm08-contractors', label: 'پیمانکاران', filterVal: this.companyId };
  }
  capabilitiesSource(): DataSourceInfo {
    return { key: 'rm08-capabilities', label: 'قابلیت پیمانکار', filterVal: this.companyId };
  }
  ratesSource(): DataSourceInfo {
    return { key: 'rm08-rates', label: 'نرخ و زمان تحویل', filterVal: this.companyId };
  }
  inventoriesSource(): DataSourceInfo {
    return { key: 'rm08-inventories', label: 'انبار امانی', filterVal: this.companyId };
  }
}
