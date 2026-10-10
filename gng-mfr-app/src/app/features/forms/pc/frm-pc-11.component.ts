import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { OP_STATUS, SHIPMENT_ROLE, SHOP_NOW, SUBCONTRACT_STAGE, WO_STATUS, faDateTime, faDay, faDuration, faInt, faNum, faPct, minutesAgo, opStatusTone } from './pc-shared';
import { SubOrder } from './frm-pc-10.data';
import { IsolationItem, PARTY_TYPE, PORTAL_DIRECTION, PORTAL_TABS, PortalAccount, PortalView, STALE_LOGIN_DAYS } from './frm-pc-11.data';
import { FrmPc11Service } from './frm-pc-11.service';

const RING = 2 * Math.PI * 42;

/**
 * FRM-PC-11 — «پورتال پیمانکار و مشتری کارمزدی» (نمای داخلی «دیدن به‌جای»).
 *
 * فهرست حساب‌های پورتال با حقوق و آخرین ورود در پنل کناری؛ با انتخاب هر حساب، همان چیزی که آن طرف بیرونی
 * می‌بیند (سرور طرف را از حساب پیدا می‌کند) در قاب ساده‌ی پورتال نمایش داده می‌شود: سفارش‌های من، ثبت پیشرفت،
 * ارسال و دریافت، مانده‌ی مواد امانی؛ همراه با فهرست جداسازی داده (چه دیده/پوشیده/پنهان است).
 *
 * فاز اول: F-PC-090 (نمایش). ثبت پیشرفت توسط پیمانکار، مدیریت حساب‌ها و حقوق، و ورود واقعی طرف بیرونی با فاز ایجاد/ویرایش می‌آید.
 */
@Component({
  selector: 'gng-frm-pc-11',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, DropdownModule, InputNumberModule, InputTextModule, SelectButtonModule, TagModule, TooltipModule,
    OperationalFormLayoutComponent, DataSourceBadgeComponent,
  ],
  templateUrl: './frm-pc-11.component.html',
  styles: [`
    .pc11-acc { border: 1px solid var(--gng-border); border-radius: var(--gng-radius-sm); padding: 0.55rem 0.65rem; cursor: pointer; background: var(--gng-surface); margin-bottom: 0.45rem; }
    .pc11-acc:hover { border-color: var(--gng-primary); }
    .pc11-acc--on { border-color: var(--gng-primary); box-shadow: inset -3px 0 0 var(--gng-primary); }
    .pc11-acc--off { opacity: 0.65; background: repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(0,0,0,0.03) 6px, rgba(0,0,0,0.03) 12px); }
    .pc11-acc__name { font-weight: 600; font-size: 0.82rem; display: flex; justify-content: space-between; gap: 0.4rem; }
    .pc11-acc__user { font-family: monospace; font-size: 0.72rem; color: var(--gng-text-muted); direction: ltr; text-align: right; }
    .pc11-rights { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-top: 0.3rem; }
    .pc11-right { font-size: 0.66rem; border-radius: 99px; padding: 0.05rem 0.45rem; border: 1px solid var(--gng-border); }
    .pc11-right--on { background: rgba(39, 174, 96, 0.12); border-color: var(--gng-success); color: var(--gng-success); }
    .pc11-right--off { color: var(--gng-text-muted); text-decoration: line-through; }
    .pc11-wrap { display: grid; grid-template-columns: 1fr 260px; gap: 1rem; align-items: start; }
    @media (max-width: 1200px) { .pc11-wrap { grid-template-columns: 1fr; } }
    .pc11-frame { border: 1px solid var(--gng-border); border-radius: 12px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,0.08); position: relative; background: #f7f8fb; color: #1f2633; }
    .pc11-chrome { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.8rem; background: #e9ecf2; border-bottom: 1px solid #d8dde6; }
    .pc11-chrome__dots span { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #c7ccd6; margin-left: 4px; }
    .pc11-chrome__url { flex: 1; background: #fff; border-radius: 99px; padding: 0.15rem 0.8rem; font-size: 0.72rem; color: #5b6475; direction: ltr; text-align: left; font-family: monospace; }
    .pc11-top { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.3rem; background: #1f3b63; color: #fff; }
    .pc11-top__brand { font-weight: 800; font-size: 1rem; }
    .pc11-top__who { font-size: 0.78rem; opacity: 0.9; text-align: left; }
    .pc11-nav { display: flex; gap: 0.3rem; padding: 0.6rem 1.3rem 0; background: #fff; border-bottom: 1px solid #e3e6ec; flex-wrap: wrap; }
    .pc11-nav button { border: 0; background: none; padding: 0.55rem 0.9rem; font: inherit; font-size: 0.85rem; cursor: pointer; color: #5b6475; border-bottom: 3px solid transparent; }
    .pc11-nav button.on { color: #1f3b63; font-weight: 700; border-bottom-color: #f7941d; }
    .pc11-body { padding: 1.2rem 1.3rem 1.5rem; min-height: 320px; }
    .pc11-card { background: #fff; border-radius: 10px; border: 1px solid #e3e6ec; padding: 1rem 1.1rem; margin-bottom: 0.9rem; }
    .pc11-order { display: grid; grid-template-columns: 110px 1fr auto; gap: 1.1rem; align-items: center; }
    @media (max-width: 900px) { .pc11-order { grid-template-columns: 1fr; } }
    .pc11-status { font-size: 1.5rem; font-weight: 800; color: #1f3b63; }
    .pc11-big { font-size: 1.15rem; font-weight: 700; }
    .pc11-muted { color: #6b7385; font-size: 0.78rem; }
    .pc11-chip { display: inline-block; border-radius: 99px; padding: 0.15rem 0.6rem; font-size: 0.72rem; font-weight: 600; }
    .pc11-chip--late { background: #fde8e8; color: #c0392b; }
    .pc11-chip--ok { background: #e3f6ea; color: #1e874b; }
    .pc11-mask { letter-spacing: 0.2em; color: #9aa1af; }
    .pc11-tl { border-right: 2px solid #d8dde6; padding-right: 1rem; margin-right: 0.4rem; }
    .pc11-tl__item { position: relative; padding-bottom: 0.9rem; }
    .pc11-tl__item::before { content: ''; position: absolute; right: -1.42rem; top: 0.25rem; width: 0.7rem; height: 0.7rem; border-radius: 50%; background: #1f3b63; border: 2px solid #fff; }
    .pc11-form { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem 1rem; }
    .pc11-form label { font-size: 0.75rem; color: #6b7385; display: block; margin-bottom: 0.2rem; }
    .pc11-ops { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .pc11-op { flex: 1 1 8rem; border-radius: 8px; padding: 0.5rem 0.6rem; background: #f1f3f7; font-size: 0.76rem; }
    .pc11-op--done { background: #e3f6ea; } .pc11-op--run { background: #e6eefb; } .pc11-op--stop { background: #fde8e8; }
    .pc11-ship { display: grid; grid-template-columns: 2.4rem 1fr; gap: 0.8rem; }
    .pc11-ship__icon { width: 2.4rem; height: 2.4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #e6eefb; color: #1f3b63; }
    .pc11-ship__icon--out { background: #fff1e0; color: #b46400; }
    .pc11-bal { display: grid; grid-template-columns: 1fr repeat(4, 6.5rem); gap: 0.5rem; font-size: 0.8rem; padding: 0.45rem 0; border-bottom: 1px solid #eef0f4; align-items: center; }
    .pc11-bal--head { font-size: 0.7rem; color: #6b7385; }
    .pc11-lock { position: absolute; inset: 0; background: rgba(20, 24, 32, 0.72); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem; z-index: 2; gap: 0.6rem; }
    .pc11-lock i { font-size: 2.4rem; }
    .pc11-empty { text-align: center; padding: 2.5rem 1rem; color: #6b7385; }
    .pc11-empty i { font-size: 2.2rem; color: #c7ccd6; display: block; margin-bottom: 0.6rem; }
    .pc11-iso { display: flex; flex-direction: column; gap: 0.45rem; }
    .pc11-iso__row { display: grid; grid-template-columns: 1.4rem 1fr; gap: 0.4rem; font-size: 0.78rem; }
    .pc11-iso__row--masked i { color: var(--gng-warning); } .pc11-iso__row--hidden i { color: var(--gng-danger); } .pc11-iso__row--shown i { color: var(--gng-success); }
  `],
})
export class FrmPc11Component implements OnInit {
  accounts: PortalAccount[] = [];
  account: PortalAccount | null = null;
  view: PortalView | null = null;
  loading = false;
  loadFailed = false;
  viewLoading = false;
  portalTab = 0;
  filter = 'all';
  readonly filterOptions = [
    { label: 'همه', value: 'all' },
    { label: 'پیمانکار', value: 'p1' },
    { label: 'مشتری', value: 'p2' },
    { label: 'غیرفعال', value: 'off' },
  ];
  readonly companyId = DEMO_COMPANY_ID;
  readonly tabs = PORTAL_TABS;
  readonly partyType = PARTY_TYPE;
  readonly portalDirection = PORTAL_DIRECTION;
  readonly role = SHIPMENT_ROLE;
  readonly stage = SUBCONTRACT_STAGE;
  readonly opStatus = OP_STATUS;
  readonly opStatusTone = opStatusTone;
  readonly woStatus = WO_STATUS;
  readonly ring = RING;
  readonly faNum = faNum;
  readonly faInt = faInt;
  readonly faPct = faPct;
  readonly faDay = faDay;
  readonly faDateTime = faDateTime;
  readonly stageOptions = Object.entries(SUBCONTRACT_STAGE).map(([k, v]) => ({ label: v, value: +k }));

  constructor(private pc11: FrmPc11Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.pc11.accounts(this.companyId).subscribe({
      next: (a) => {
        this.accounts = a;
        this.loading = false;
        const first = a.find((x) => x.active && x.canReport) ?? a[0];
        if (first) this.pick(first);
      },
      error: (err) => {
        console.warn('[FRM-PC-11] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  get shownAccounts(): PortalAccount[] {
    const f = this.filter;
    return this.accounts.filter((a) => (f === 'all' ? true : f === 'off' ? !a.active : a.partyTypeCode === (f === 'p1' ? 1 : 2)));
  }

  pick(a: PortalAccount): void {
    this.account = a;
    this.view = null;
    this.portalTab = 0;
    this.viewLoading = true;
    this.pc11.view(a.id, this.companyId).subscribe({
      next: (v) => {
        if (this.account?.id !== a.id) return;
        this.view = v;
        this.viewLoading = false;
      },
      error: () => (this.viewLoading = false),
    });
  }

  // ───────── حساب ─────────

  loginAgeDays(a: PortalAccount): number | null {
    const m = minutesAgo(a.lastLogin);
    return m === null ? null : m / 1440;
  }

  loginAge(a: PortalAccount): string {
    const m = minutesAgo(a.lastLogin);
    return m === null ? 'هرگز وارد نشده' : `${faDuration(m)} پیش`;
  }

  isStale(a: PortalAccount): boolean {
    const d = this.loginAgeDays(a);
    return d === null || d > STALE_LOGIN_DAYS;
  }

  partyName(a: PortalAccount): string {
    return a.partyTypeCode === 1 ? a.contractor : a.customer;
  }

  get isContractor(): boolean {
    return this.view?.partyTypeCode === 1;
  }

  get hasWork(): boolean {
    const v = this.view;
    return !!v && (v.orders.length > 0 || v.contracts.length > 0);
  }

  get portalUrl(): string {
    return `portal.golrang-mfr.ir/${this.account?.userName ?? ''}`;
  }

  /** چه چیزی این حساب می‌بیند، چه چیزی پوشیده یا پنهان است */
  get isolation(): IsolationItem[] {
    const a = this.account;
    const v = this.view;
    if (!a || !v) return [];
    const fees = this.feesMasked;
    return [
      { label: a.partyTypeCode === 1 ? `فقط سفارش‌های ${a.contractor}` : `فقط قرارداد ${a.contractNumber}`, state: 'shown', note: 'طرف از روی حساب، سمت سرور پیدا می‌شود؛ مرورگر شناسه‌ی طرف نمی‌فرستد.' },
      { label: 'نرخ و مبلغ کارمزد', state: a.canFees && !fees ? 'shown' : 'masked', note: a.canFees ? 'مجوز دارد' : `سرور مقدار را null برگرداند${fees ? '' : ' (چیزی برای پوشاندن نبود)'}` },
      { label: 'مانده‌ی مواد امانی', state: a.canBalances ? 'shown' : 'hidden', note: a.canBalances ? 'مجوز دارد' : 'بدون مجوز' },
      { label: 'ثبت پیشرفت', state: a.canReport ? 'shown' : 'hidden', note: a.canReport ? 'فرم در فاز ویرایش فعال می‌شود' : 'فقط مشاهده' },
      { label: 'بهای تمام‌شده، سایر پیمانکاران و مشتریان، عملیات داخلی', state: 'hidden', note: 'هرگز به پورتال نمی‌رود' },
    ];
  }

  /** آیا سرور واقعاً کارمزدی را پوشانده است؟ */
  get feesMasked(): boolean {
    const v = this.view;
    if (!v) return false;
    return v.orders.some((o) => o.feePerUnit === null) || v.contracts.some((c) => c.feePerUnit === null);
  }

  // ───────── پورتال پیمانکار ─────────

  ringDash(done: number, total: number): string {
    const p = total ? Math.min(1, done / total) : 0;
    return `${(p * RING).toFixed(1)} ${RING.toFixed(1)}`;
  }

  pctOf(done: number, total: number): number {
    return total ? (done / total) * 100 : 0;
  }

  orderProgress(o: SubOrder): { done: number; total: number } {
    return { done: o.progressCompleted, total: o.toComplete };
  }

  orderDelayText(o: SubOrder): string {
    return o.delayDays > 0 ? `${faInt(o.delayDays)} روز دیرتر از موعد` : 'طبق موعد';
  }

  progressOf(o: SubOrder) {
    return this.view ? this.view.progress.filter((p) => p.workOrderId === o.workOrderId && p.opSeq === o.opSeq).slice().reverse() : [];
  }

  /** فرم پیشرفت با مقادیر آخرین گزارش (غیرفعال) */
  formFor(o: SubOrder): { stage: number; completed: number; wasted: number; ready: string; note: string } {
    return {
      stage: o.stageCode ?? 1,
      completed: o.progressCompleted,
      wasted: o.progressWasted,
      ready: o.expectedReady ? o.expectedReady.slice(0, 10) : '',
      note: '',
    };
  }

  // ───────── پورتال مشتری ─────────

  get tollFurthest(): number {
    const ops = this.view?.operations ?? [];
    const started = ops.filter((o) => o.completed > 0);
    return started.length ? started[started.length - 1].completed : 0;
  }

  get tollOrderQty(): number {
    return this.view?.operations[0]?.quantity ?? this.view?.contracts[0]?.orderQty ?? 0;
  }

  get tollDue(): string | null {
    const ops = this.view?.operations ?? [];
    return ops.length ? ops[0].dueDate : null;
  }

  get tollCurrentOp(): string {
    const ops = this.view?.operations ?? [];
    const cur = ops.find((o) => o.statusCode !== 5);
    return cur ? `${cur.title} — ${OP_STATUS[cur.statusCode]}` : 'همه‌ی مراحل تکمیل شد';
  }

  opClass(code: number): string {
    return code === 5 ? 'pc11-op--done' : code === 3 ? 'pc11-op--run' : code === 4 ? 'pc11-op--stop' : '';
  }

  // ───────── بنر ─────────

  get bannerTone(): BannerTone {
    if (this.loadFailed) return 'danger';
    return this.accounts.some((a) => !a.active) ? 'danger' : this.accounts.some((a) => this.isStale(a)) ? 'warning' : 'success';
  }

  get bannerText(): string {
    if (this.loadFailed) return 'خواندن داده از gng-mfr-api ناموفق بود. اتصال دیتابیس و اجرای mes_frm_pc11_setup.sql را بررسی کنید.';
    if (this.loading) return 'در حال خواندن…';
    const out: string[] = [];
    for (const a of this.accounts.filter((x) => !x.active))
      out.push(`حساب غیرفعال ${a.userName} (${a.description || 'بدون شرح'}) — آخرین ورود ${this.loginAge(a)}؛ باید حذف یا بسته شود`);
    if (this.view && this.account && !this.account.active && this.view.rowCount > 0)
      out.push(`سرور برای همین حساب غیرفعال هنوز ${faInt(this.view.rowCount)} ردیف داده برمی‌گرداند`);
    for (const a of this.accounts.filter((x) => x.active && this.isStale(x))) out.push(`${a.userName} فعال است ولی ${this.loginAge(a)} وارد نشده`);
    if (this.view && this.account?.active && !this.hasWork) out.push(`حساب فعال ${this.account.userName} هیچ کار جاری ندارد — دسترسی بازبینی شود`);
    out.push(`${faInt(this.accounts.filter((a) => a.active).length)} حساب فعال از ${faInt(this.accounts.length)}`);
    return out.join('؛ ') + '.';
  }

  get contextLabel(): string {
    return this.account ? `${this.account.userName} — ${this.partyName(this.account)}` : 'پورتال بیرونی';
  }

  readonly shopNow = SHOP_NOW;

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }
}
