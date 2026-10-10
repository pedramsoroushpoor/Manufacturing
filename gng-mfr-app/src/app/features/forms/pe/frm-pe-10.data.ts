/**
 * مدل‌های نمایشی FRM-PE-10 «رصدخانه‌ی مهندسی محصول» (BI). داده از /api/pe10/bundle می‌آید (frm-pe-10.service.ts)
 * و همه‌ی محاسبه‌ها در pe10/pe10-engine.ts انجام می‌شود. زمان‌ها میلی‌ثانیه‌اند (زمان محلی سناریو با برچسب Z).
 */
import { SHOP_NOW } from '../pc/pc-shared';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted';
export type Space = 'sky' | 'xray' | 'ripple' | 'truth' | 'eco' | 'debt';

export const NOW = SHOP_NOW.getTime();
export const DAY = 86_400_000;

// ───────── ردیف‌های API ─────────
export interface PeProduct {
  id: number; code: string; title: string; unit: string; group: string; itemId: number | null; role: number | null; tracking: number | null;
  phantom: boolean; dimensional: boolean; policies: number; make: number; buy: number; outsource: number; badContractors: string; lotSizes: number;
  defaultStructureId: number | null; structureCount: number; onHand: number; reserved: number; quarantine: number; rejected: number; expired: number;
  inTransit: number; customerOwned: number; nextArrival: number | null; nearestExpiry: number | null; batches: number; consumed14: number;
  openReq: number; openOrders: number; earliestDue: number | null; hasRecovered: boolean; subGroups: number;
}
export interface PeStructure {
  id: number; code: string; title: string; type: number; status: number; isDefault: boolean; productId: number | null; baseQty: number | null;
  license: string; templateId: number | null; allowOver100: boolean; revisionCode: string; revisionStatus: number | null; effectivity: number | null;
  ecoNumber: string; revisionFrom: number | null; approver: string; revisionCount: number; licenseValidTo: number | null; licenseCount: number;
  itemCount: number; pctRows: number; pctSum: number; qsRows: number; yieldRows: number; yieldTotal: number | null; outputCount: number;
  costShareTotal: number | null; matrixCells: number; matrixMissing: number; openOrders: number; totalOrders: number; lastCompleted: number | null;
}
export interface PeItem {
  structureId: number; itemId: number; source: string; productId: number; seq: number; qtyType: number; qty: number; qtyAtBase: number | null;
  wastePct: number | null; wasteQty: number | null; qs: boolean; ai: boolean; main: boolean; roleTitle: string; minC: number | null; maxC: number | null;
  subGroupId: number | null; recovery: boolean; maxRecovered: number | null; dimensionId: number | null; childStructureId: number | null;
}
export type EntityType = 'STRUCT' | 'PRODUCT' | 'SUBGRP' | 'ECO';
export interface PeCheck {
  entityType: EntityType; entityId: number; entityCode: string; entityTitle: string; structureId: number | null; productId: number | null;
  code: string; passed: boolean; severity: number; form: string; detail: string;
}
export interface PeConsumption {
  woId: number; wo: string; woStatus: number; woType: number; structureId: number | null; itemId: number; productId: number; opSeq: number;
  std: number; produced: number; stdForProduced: number; actual: number | null; entries: number; potency: number | null; lastAt: number | null;
  substitutedId: number | null; recovered: boolean; ai: boolean;
}
export interface PeYield {
  woId: number; wo: string; structureId: number | null; productId: number; type: number; stdYield: number; min: number | null; max: number | null;
  orderQty: number; ratio: number | null; produced: number; received: number; actualYield: number | null;
}
export interface PeDemandRow {
  woId: number; wo: string; woStatus: number; woType: number; due: number | null; mainProductId: number; structureId: number | null; opSeq: number;
  productId: number; itemId: number | null; subGroupId: number | null; substitutedId: number | null; customer: boolean; std: number; consumed: number;
  remaining: number;
}
export interface PeRequest { id: number; number: string; status: number; priority: number; productId: number; qty: number; need: number | null; customer: string; linked: number }
export interface PeEco {
  id: number; number: string; title: string; origin: number; priority: number; status: number; requestedBy: string; requestDate: number | null;
  effectiveDate: number | null; policy: number | null; policyCondition: string; reason: string; itemCount: number; approverCount: number; signedCount: number;
  linkedRevisions: string;
}
export interface PeEcoItem {
  ecoId: number; id: number; entityType: number; changeType: number; structureId: number | null; productId: number | null; groupId: number | null;
  before: string; after: string; description: string;
}
export interface PeEcoApproval { ecoId: number; seq: number; role: string; approver: string; decision: number | null; signedOn: number | null }
export interface PeSubMember {
  groupId: number; groupCode: string; groupTitle: string; combinable: boolean; active: boolean; optionNo: number; optionTitle: string; priority: number | null;
  productId: number; ratio: number;
}
export interface PeOutput { structureId: number; productId: number; type: number; qty: number; yieldPct: number | null; min: number | null; max: number | null }
export interface PeRecoveryReceipt {
  receipt: string; wo: string; material: string; source: string; input: number; recovered: number; actualPct: number | null; stdPct: number | null;
  stdSource: string; threshold: number; batch: string; cycle: number | null; purity: number | null; minPurity: number | null; at: number | null;
}

export interface Pe10Bundle {
  products: PeProduct[]; structures: PeStructure[]; items: PeItem[]; checks: PeCheck[]; consumption: PeConsumption[]; yields: PeYield[];
  orders: PeDemandRow[]; requests: PeRequest[]; ecos: PeEco[]; ecoItems: PeEcoItem[]; ecoApprovals: PeEcoApproval[]; substitutes: PeSubMember[];
  outputs: PeOutput[]; recovery: PeRecoveryReceipt[];
}

// ───────── کدها ─────────
export const ROLE: Record<number, string> = { 1: 'محصول نهایی', 2: 'نیمه‌ساخته', 3: 'ماده‌ی اولیه', 4: 'مواد بسته‌بندی', 5: 'محصول جانبی' };
export const STRUCT_TYPE: Record<number, string> = { 1: 'تولیدی', 2: 'آزمایشی', 3: 'الگو', 4: 'نمونه‌سازی', 5: 'مهندسی' };
export const STRUCT_STATUS: Record<number, string> = { 1: 'پیش‌نویس', 2: 'در گردش تأیید', 3: 'تأییدشده', 4: 'منسوخ' };
export const ECO_STATUS: Record<number, string> = { 1: 'پیش‌نویس', 2: 'تحلیل اثر', 3: 'در انتظار تأیید', 4: 'تأییدشده', 5: 'اجراشده', 6: 'ردشده' };
export const ECO_ORIGIN: Record<number, string> = { 1: 'کیفیت', 2: 'تأمین', 3: 'بهبود', 4: 'الزام قانونی', 5: 'مشتری' };
export const ECO_POLICY: Record<number, string> = { 1: 'مصرف تا اتمام', 2: 'کنارگذاری', 3: 'اختلاط با شرط' };
export const ECO_ENTITY: Record<number, string> = { 1: 'ساختار', 2: 'کالا', 3: 'گروه جایگزین', 4: 'الگو' };
export const ECO_CHANGE: Record<number, string> = { 1: 'افزودن', 2: 'حذف', 3: 'تغییر', 4: 'جایگزینی' };
export const OUTPUT_TYPE: Record<number, string> = { 1: 'اصلی', 2: 'هم‌زاد', 3: 'جانبی', 4: 'ضایعات', 5: 'بازیابی‌شده' };
export const COUNT_UNITS = ['عدد', 'قرص', 'بلیستر'];

/** چک‌لیست سلامت مهندسی — همان کدهای mes.GetBiPeChecks (سرآغاز mes_frm_pe10_setup.sql) */
export interface CheckDef { title: string; owner: string; why: string }
export const CHECKS: Record<string, CheckDef> = {
  S01: { title: 'ساختار و نسخه‌ی جاری تأییدشده', owner: 'مهندسی فرمولاسیون', why: 'ساختار پیش‌نویس نباید مبنای صدور دستور باشد.' },
  S02: { title: 'پروانه‌ی ساخت معتبر', owner: 'امور قانونی و QA', why: 'تولید محصول نهایی بدون پروانه‌ی معتبر مجاز نیست.' },
  S03: { title: 'جمع ردیف‌های درصدی ۱۰۰٪', owner: 'مهندسی فرمولاسیون', why: 'فرمول درصدی ناقص یعنی کمبود یا مازاد مواد در هر بچ.' },
  S04: { title: 'موازنه‌ی جرم خروجی‌ها (۱۰۰٪)', owner: 'مهندسی فرایند', why: 'جمع بازده‌ها باید کل ورودی را توضیح دهد.' },
  S05: { title: 'ماده‌ی خریدنی گروه جایگزین دارد', owner: 'مهندسی فرمولاسیون', why: 'بدون جایگزین، کمبود یک ماده خط را می‌خواباند.' },
  S06: { title: 'گروه جایگزین با کالای ردیف می‌خواند', owner: 'مهندسی فرمولاسیون', why: 'گروه نادرست یعنی جایگزینی اشتباه در کارگاه.' },
  S07: { title: 'سقف مصرف بازیافتی، ماده‌ی بازیافتی دارد', owner: 'مهندسی فرایند', why: 'اجازه‌ی مصرف بازیافتی بدون تعریف ماده‌ی بازیافتی قابل اجرا نیست.' },
  S08: { title: 'ECO باز روی ساختار نیست', owner: 'دبیرخانه‌ی تغییر مهندسی', why: 'ساختار در حال تغییر است؛ برنامه‌ریزی باید بداند.' },
  S09: { title: 'ماتریس ابعادی کامل', owner: 'مهندسی بسته‌بندی', why: 'واریانت بدون مقدار، ساختار مشتق ناقص می‌سازد.' },
  S10: { title: 'همه‌ی کالاها نقش تولیدی دارند', owner: 'مدیریت داده‌ی کالا', why: 'کالای بدون نقش در کیت، مصرف و ردیابی دیده نمی‌شود.' },
  S11: { title: 'نیمه‌ساخته‌ها ساختار دارند', owner: 'مهندسی فرمولاسیون', why: 'بسط چندسطحی و برنامه‌ریزی مواد در این گره قطع می‌شود.' },
  P01: { title: 'کالای به‌کاررفته نقش تولیدی دارد', owner: 'مدیریت داده‌ی کالا', why: 'افزوده‌ی تولیدی (PE-01) برای هر کالای ساختار لازم است.' },
  P02: { title: 'ردیابی بچ درست', owner: 'مدیریت داده‌ی کالا', why: 'GMP: محصول و نیمه‌ساخته ردیابی بچ می‌خواهند؛ فانتوم موجودی نمی‌شود.' },
  P03: { title: 'اندازه‌ی بچ تعریف‌شده', owner: 'برنامه‌ریزی و مهندسی', why: 'بدون اندازه‌ی بچ، دستور کار مقدار مبنا ندارد.' },
  P04: { title: 'کالای تولیدی ساختار دارد', owner: 'مهندسی فرمولاسیون', why: 'تولید داخلی بدون ساختار تولیدی ممکن نیست.' },
  P05: { title: 'سیاست تأمین به پیمانکار سالم', owner: 'مدیریت داده‌ی کالا', why: 'برون‌سپاری به پیمانکار تعلیق/غیرفعال پشتیبان واقعی نیست.' },
  G01: { title: 'اولویت یکتا در گروه جایگزین', owner: 'مهندسی فرمولاسیون', why: 'دو گزینه با اولویت یکسان انتخاب کارگاه را مبهم می‌کند.' },
  G02: { title: 'گروه جایگزین به کار رفته', owner: 'مهندسی فرمولاسیون', why: 'گروه بی‌استفاده داده‌ی مرده است.' },
  G03: { title: 'اعضای گروه نقش تولیدی دارند', owner: 'مدیریت داده‌ی کالا', why: 'جایگزین بدون نقش تولیدی در کارگاه قابل مصرف نیست.' },
  E01: { title: 'ECO تاریخ اثر و سیاست موجودی دارد', owner: 'دبیرخانه‌ی تغییر مهندسی', why: 'بدون تاریخ اثر و سیاست موجودی، اجرای تغییر نامعین است.' },
  E02: { title: 'امضای معوق بیش از ۷ روز نیست', owner: 'دبیرخانه‌ی تغییر مهندسی', why: 'تأخیر امضا اثر تغییر را عقب می‌اندازد.' },
};
/** وزن هر کنترل در امتیاز سلامت = شدت به توان دو (۱، ۴، ۹) تا کنترل بحرانی غالب باشد */
export const severityWeight = (sev: number): number => sev * sev;
export const HEALTH_FORMULA =
  'امتیاز سلامت = ۱۰۰ × Σ(وزن کنترل‌های قبول) ÷ Σ(وزن همه‌ی کنترل‌ها)؛ وزن = شدت² (توصیه ۱، مهم ۴، بحرانی ۹). کنترل‌های کالا و همه‌ی ساختارهای کالا در امتیاز کالا جمع می‌شوند.';
export const IMPACT_FORMULA = 'اثر نقص = شدت² × دامنه؛ دامنه = ۱ + دستورهای باز درگیر + ساختارهای بالادستی + درخواست‌های باز محصولات درگیر.';
export const SUGGEST_FORMULA =
  'نسبت = مصرف واقعی ÷ استاندارد برای مقدار تولیدشده (ماده‌ی مؤثره پس از تصحیح عیار: × عیار ÷ ۱۰۰). مقدار پیشنهادی = مقدار ردیف × (۱ + w × سوگیری)، w = n ÷ (n + k) — هرچه نمونه بیشتر، اعتماد به داده بیشتر.';

// ───────── قالب‌بندی ─────────
const FA = '۰۱۲۳۴۵۶۷۸۹';
/** عددهای مستقل متن‌های آماده‌ی دیتابیس را فارسی می‌کند؛ رقم‌های درون کد (P-1005، K30، v1) دست نمی‌خورند */
export const faDigits = (s: string): string =>
  s.replace(/(^|[^A-Za-z0-9\-])([0-9][0-9.\-]*)/g, (_m, pre: string, num: string) => pre + num.replace(/[0-9]/g, (d) => FA[+d]).replace(/\./g, '٫'));
export const faD = (t: number | null | undefined): string =>
  t === null || t === undefined ? '—' : new Date(t).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', month: '2-digit', day: '2-digit', year: '2-digit' });
export const faDM = (t: number | null | undefined): string =>
  t === null || t === undefined ? '—' : new Date(t).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', month: 'short', day: 'numeric' });
export const healthTone = (s: number | null): Tone => (s === null ? 'muted' : s >= 90 ? 'success' : s >= 70 ? 'warning' : 'danger');
/** رنگ پیوسته‌ی سلامت: قرمز (۴۰) ← کهربایی (۷۵) ← سبز (۱۰۰) */
export function healthColor(s: number | null): string {
  if (s === null) return '#7d8ea3';
  const k = Math.max(0, Math.min(1, (s - 40) / 60));
  const hue = 4 + k * 138;
  return `hsl(${hue.toFixed(0)}, 78%, ${(56 - k * 8).toFixed(0)}%)`;
}
