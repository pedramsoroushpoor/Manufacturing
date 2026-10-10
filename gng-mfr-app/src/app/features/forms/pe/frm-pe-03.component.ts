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
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { GroupIssue, GroupRow, OptionRow, UsageRow } from './frm-pe-03.data';
import { FrmPe03Service } from './frm-pe-03.service';

/**
 * FRM-PE-03 — «گروه جایگزین و سیاست جایگزینی».
 *
 * گروه جایگزین موجودیت مستقل است و در چند ساختار استفاده می‌شود؛ جایگزینی چند به
 * چند با نسبت تبدیل، اولویت هر گزینه و سیاست ترکیبی/غیرترکیبی. پنل کناری فهرست
 * گروه‌هاست.
 *
 * فاز اول: F-PE-027 تا 030. پیشنهاد خودکار (031)، درصد مجاز (032) و الزام تأیید کیفی (033) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-pe-03',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, TreeModule, OperationalFormLayoutComponent, DataSourceBadgeComponent],
  templateUrl: './frm-pe-03.component.html',
})
export class FrmPe03Component implements OnInit, OnDestroy {
  pickTree: TreeNode<{ id: number | null }>[] = [];
  selectedPick: TreeNode<{ id: number | null }> | null = null;
  groupId: number | null = null;

  groups: GroupRow[] = [];
  options: OptionRow[] = [];
  usage: UsageRow[] = [];
  issues: GroupIssue[] = [];

  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  private readonly load$ = new Subject<void>();
  private readonly sub = new Subscription();

  constructor(private pe03: FrmPe03Service) {}

  ngOnInit(): void {
    this.sub.add(
      this.load$
        .pipe(
          tap(() => (this.loading = true)),
          switchMap(() =>
            this.pe03.load(this.groupId, this.companyId).pipe(
              catchError((err) => {
                console.warn('[FRM-PE-03] خواندن داده ناموفق بود:', err?.message || err);
                this.loading = false;
                this.loadFailed = true;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((b) => {
          this.groups = b.groups;
          this.options = b.options;
          this.usage = b.usage;
          this.issues = b.issues;
          if (!this.pickTree.length) this.buildPickTree();
          this.loading = false;
          this.loadFailed = false;
        })
    );
    this.load$.next();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private buildPickTree(): void {
    const root: TreeNode<{ id: number | null }> = {
      key: 'all',
      label: 'همه‌ی گروه‌ها',
      icon: 'pi pi-sync',
      expanded: true,
      data: { id: null },
      children: this.groups.map((g) => ({ key: `g-${g.id}`, label: `${g.code} — ${g.title}`, icon: 'pi pi-circle', data: { id: g.id } })),
    };
    this.pickTree = [root];
    this.selectedPick = root;
  }

  onPick(event: { node: TreeNode<{ id: number | null }> }): void {
    if (!event.node?.data) return;
    this.groupId = event.node.data.id;
    this.load$.next();
  }

  onUnpick(event: { node: TreeNode<{ id: number | null }> }): void {
    setTimeout(() => (this.selectedPick = event.node));
  }

  get selected(): GroupRow | null {
    return this.groupId === null ? null : this.groups.find((g) => g.id === this.groupId) ?? null;
  }

  get visibleGroups(): GroupRow[] {
    return this.selected ? [this.selected] : this.groups;
  }

  /** گزینه‌ی اصلی و جایگزین‌های هر گروه، برای نمودار نسبت تبدیل. */
  get pairs(): { group: string; original: OptionRow; substitute: OptionRow }[] {
    const out: { group: string; original: OptionRow; substitute: OptionRow }[] = [];
    for (const g of this.visibleGroups) {
      const opts = this.options.filter((o) => o.groupCode === g.code);
      const original = opts.find((o) => o.optionNo === 0);
      if (!original) continue;
      for (const s of opts.filter((o) => o.optionNo > 0)) out.push({ group: g.code, original, substitute: s });
    }
    return out;
  }

  get substitutes(): OptionRow[] {
    return this.options.filter((o) => o.optionNo > 0).sort((a, b) => a.groupCode.localeCompare(b.groupCode) || (a.priority ?? 99) - (b.priority ?? 99));
  }

  get contextLabel(): string {
    return this.selected ? `${this.selected.code} — ${this.selected.title}` : 'همه‌ی گروه‌ها';
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (this.issues.some((i) => i.tone === 'danger')) return 'danger';
    if (this.issues.some((i) => i.tone === 'warning')) return 'warning';
    if (this.issues.length) return 'info';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pe03_setup.sql را بررسی کنید.';
    if (this.issues.length) return this.issues.map((i) => i.text).join('؛ ') + '.';
    return `${this.fa(this.visibleGroups.length)} گروه جایگزین سازگار؛ همه‌ی ردیف‌های متصل در اقلام اصلی گروهشان هستند.`;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
