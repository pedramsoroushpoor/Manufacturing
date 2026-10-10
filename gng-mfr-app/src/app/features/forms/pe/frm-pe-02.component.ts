import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, Subscription, catchError, switchMap, tap } from 'rxjs';
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
import {
  DIFF_STATUS,
  DiffOption,
  DiffRow,
  SOURCE,
  STATUS,
  StructureRow,
  TYPE_ICON,
  TYPE_LABEL,
  Tone,
} from './frm-pe-02.data';
import { FrmPe02Detail, FrmPe02Service } from './frm-pe-02.service';

/**
 * FRM-PE-02 — «ساختار محصول» (فرم مرکزی مهندسی محصول).
 *
 * سربرگ ساختار (نوع، پیش‌فرض، دامنه‌ی سازمانی، اندازه‌ی مرجع و محدوده‌ی بچ، الگو)،
 * ردیف‌های مصرفی مؤثر با ارث‌بری از الگو، کنترل جمع درصد و q.s.، ردیف عیارمحور،
 * ضایعات، محدوده‌ی مصرف و واحد مصرف؛ نسخه‌ها با اعتبار تاریخ/بچ/سفارش‌محور و
 * مقایسه‌ی دو نسخه یا دو ساختار؛ تبدیل نوع و مدارک. پنل کناری فهرست ساختارها
 * به تفکیک محصول است.
 *
 * فاز اول (فقط‌خواندنی): مقایسه و خروجی اکسل کار می‌کنند؛ کپی، ورود از اکسل و
 * انجام تبدیل نوع با ثبت و ویرایش می‌آیند. قلم اختیاری (025) و مصرف منفی (026) هنوز نیست.
 */
@Component({
  selector: 'gng-frm-pe-02',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DropdownModule,
    TabViewModule,
    TableModule,
    TagModule,
    TreeModule,
    OperationalFormLayoutComponent,
    DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pe-02.component.html',
})
export class FrmPe02Component implements OnInit, OnDestroy {
  structures: StructureRow[] = [];
  pickTree: TreeNode<StructureRow>[] = [];
  selectedPick: TreeNode<StructureRow> | null = null;
  selected: StructureRow | null = null;
  /** نسخه‌ی در حال مشاهده؛ null = نسخه‌ی جاری. */
  revisionId: number | null = null;
  detail: FrmPe02Detail | null = null;

  diffOptions: DiffOption[] = [];
  diffLeft: string | null = null;
  diffRight: string | null = null;
  diffRows: DiffRow[] | null = null;
  diffLoading = false;

  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;

  private readonly load$ = new Subject<void>();
  private readonly sub = new Subscription();

  constructor(private pe02: FrmPe02Service) {}

  ngOnInit(): void {
    this.sub.add(
      this.load$
        .pipe(
          tap(() => (this.loading = true)),
          switchMap(() =>
            this.pe02.loadStructure(this.selected!, this.revisionId).pipe(
              catchError((err) => {
                console.warn('[FRM-PE-02] خواندن ساختار ناموفق بود:', err?.message || err);
                this.loading = false;
                this.loadFailed = true;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((d) => {
          this.detail = d;
          this.buildDiffOptions();
          this.loadFailed = false;
          this.loading = false;
        })
    );

    this.pe02.listStructures(this.companyId).subscribe({
      next: (list) => {
        this.structures = list;
        this.buildPickTree();
      },
      error: (err) => {
        console.warn('[FRM-PE-02] خواندن فهرست ساختارها ناموفق بود:', err?.message || err);
        this.loadFailed = true;
      },
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** ساختارها به تفکیک محصول؛ الگوها در گروه جدا. اولین ساختار پیش‌فرض انتخاب می‌شود. */
  private buildPickTree(): void {
    const groups = new Map<string, TreeNode<StructureRow>>();
    for (const s of this.structures) {
      const key = s.isTemplate ? 'templates' : `p-${s.productId}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: s.isTemplate ? 'الگوها' : s.product,
          icon: s.isTemplate ? 'pi pi-clone' : 'pi pi-box',
          selectable: false,
          expanded: true,
          children: [],
        });
      }
      groups.get(key)!.children!.push({
        key: `s-${s.id}`,
        label: `${s.code}${s.isDefault ? ' ★' : ''} — ${TYPE_LABEL[s.typeCode] ?? ''}`,
        icon: TYPE_ICON[s.typeCode] ?? 'pi pi-circle',
        data: s,
      });
    }
    this.pickTree = [...groups.values()];
    const first = this.pickTree.flatMap((g) => g.children ?? []).find((n) => n.data?.isDefault) ?? this.pickTree[0]?.children?.[0];
    if (first?.data) {
      this.selectedPick = first;
      this.select(first.data);
    }
  }

  // ---- انتخاب ساختار و نسخه ----

  onPick(event: { node: TreeNode<StructureRow> }): void {
    if (!event.node?.data) return;
    this.select(event.node.data);
  }

  /** کلیک دوباره روی گره‌ی انتخاب‌شده نباید فرم را بدون انتخاب بگذارد. */
  onUnpick(event: { node: TreeNode<StructureRow> }): void {
    setTimeout(() => (this.selectedPick = event.node));
  }

  private select(s: StructureRow): void {
    this.selected = s;
    this.revisionId = null;
    this.diffRows = null;
    this.load$.next();
  }

  viewRevision(revisionId: number, isCurrent: boolean): void {
    this.revisionId = isCurrent ? null : revisionId;
    this.load$.next();
  }

  get viewedRevisionCode(): string {
    if (!this.selected) return '';
    if (this.revisionId === null) return this.selected.revisionCode;
    return this.detail?.revisions.find((r) => r.revisionId === this.revisionId)?.code ?? '';
  }

  // ---- مقایسه (F-PE-017) ----

  /** طرفین مقایسه: همه‌ی نسخه‌های این ساختار + نسخه‌ی جاری سایر ساختارهای همین محصول. */
  private buildDiffOptions(): void {
    const s = this.selected;
    if (!s || !this.detail) return;
    const own = this.detail.revisions.map((r) => ({ label: `${s.code} — ${r.code}${r.isCurrent ? ' (جاری)' : ''}`, value: `${s.id}|${r.revisionId}` }));
    const siblings = this.structures
      .filter((x) => x.id !== s.id && ((s.isTemplate && x.isTemplate) || (!s.isTemplate && x.productId === s.productId) || x.id === this.templateIdOf(s)))
      .map((x) => ({ label: `${x.code} — ${x.revisionCode} (جاری)`, value: `${x.id}|${x.revisionId}` }));
    const options = [...own, ...siblings];
    const sameList = options.length === this.diffOptions.length && options.every((o, i) => o.value === this.diffOptions[i].value);
    if (sameList) return;
    this.diffOptions = options;
    this.diffRight = own.find((o) => o.label.includes('(جاری)'))?.value ?? options[0]?.value ?? null;
    this.diffLeft = options.find((o) => o.value !== this.diffRight)?.value ?? null;
    this.diffRows = null;
  }

  private templateIdOf(s: StructureRow): number | null {
    if (!s.template) return null;
    return this.structures.find((x) => s.template.startsWith(x.code + ' '))?.id ?? null;
  }

  runDiff(): void {
    if (!this.diffLeft || !this.diffRight) return;
    this.diffLoading = true;
    this.pe02.diff(this.diffLeft, this.diffRight).subscribe({
      next: (rows) => {
        this.diffRows = rows;
        this.diffLoading = false;
      },
      error: () => {
        this.diffRows = [];
        this.diffLoading = false;
      },
    });
  }

  get diffSummary(): string {
    if (!this.diffRows) return '';
    const n = (st: DiffRow['status']) => this.diffRows!.filter((r) => r.status === st).length;
    return `${this.fa(n('added'))} افزوده، ${this.fa(n('removed'))} حذف‌شده، ${this.fa(n('changed'))} تغییریافته، ${this.fa(n('same'))} بدون تغییر`;
  }

  // ---- خروجی اکسل (نیمه‌ی خروجی F-PE-068) ----

  exportExcel(): void {
    if (this.selected && this.detail) this.pe02.exportCsv(this.selected, this.viewedRevisionCode, this.detail.items);
  }

  // ---- بنر و متن‌ها ----

  get contextLabel(): string {
    return this.selected ? `${this.selected.code} — ${this.viewedRevisionCode}` : 'بدون انتخاب';
  }

  private get issues(): { tone: Tone; text: string }[] {
    const s = this.selected;
    const d = this.detail;
    if (!s || !d) return [];
    const out: { tone: Tone; text: string }[] = [];
    if (d.percent.applies && !d.percent.ok) out.push({ tone: 'danger', text: d.percent.text });
    for (const a of d.attachments.filter((x) => x.type === 'پروانه‌ی ساخت' && x.stateTone !== 'success' && x.stateTone !== 'secondary')) {
      out.push({ tone: a.stateTone === 'danger' ? 'danger' : 'warning', text: `پروانه‌ی ساخت ${a.number}: ${a.state}` });
    }
    if (!s.isTemplate && !s.productHasRole) {
      out.push({ tone: 'warning', text: `«${s.product}» هنوز نقش تولیدی ندارد (FRM-PE-01)` });
    }
    if (s.pendingTypeChanges) out.push({ tone: 'info', text: 'درخواست تبدیل نوع منتظر تأیید است' });
    if (this.revisionId !== null) out.push({ tone: 'info', text: `در حال مشاهده‌ی نسخه‌ی ${this.viewedRevisionCode}، نه نسخه‌ی جاری` });
    return out;
  }

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    if (!this.selected || !this.detail) return 'info';
    const tones = this.issues.map((i) => i.tone);
    if (tones.includes('danger')) return 'danger';
    if (tones.includes('warning')) return 'warning';
    if (tones.includes('info')) return 'info';
    return 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) {
      return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pe02_setup.sql را بررسی کنید.';
    }
    if (!this.selected) return 'ساختاری تعریف نشده است.';
    if (!this.detail) return 'در حال خواندن ساختار…';
    const issues = this.issues;
    if (issues.length) return issues.map((i) => i.text.replace(/\.$/, '')).join('؛ ') + '.';
    const s = this.selected;
    if (s.isTemplate) return `الگو با ${this.fa(this.detail.items.length)} ردیف؛ ${this.fa(s.childCount)} ساختار از آن ارث می‌برد.`;
    return (
      `${this.fa(this.detail.items.length)} ردیف مصرفی` +
      (this.detail.percent.applies ? `؛ ${this.detail.percent.text}` : '؛ ساختار سازگار است.')
    );
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  typeLabel(code: number): string {
    return TYPE_LABEL[code] ?? '—';
  }

  status(code: number): { label: string; tone: Tone } {
    return STATUS[code] ?? { label: '—', tone: 'secondary' };
  }

  source(code: string): { label: string; tone: Tone } {
    return SOURCE[code] ?? { label: code, tone: 'secondary' };
  }

  diffStatus(code: DiffRow['status']): { label: string; tone: Tone } {
    return DIFF_STATUS[code];
  }

  percentWidth(p: number | null): number {
    return p === null ? 0 : Math.min(Math.max(p, 0), 100);
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: key === 'pe02-structures' ? this.companyId : this.selected?.id ?? 0 };
  }
}
