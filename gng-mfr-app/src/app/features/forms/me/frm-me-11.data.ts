/**
 * FRM-ME-11 «رصدخانه‌ی مهندسی تولید» — شکل داده‌ها (نگاشت‌شده از /api/me11/bundle) و ثابت‌های نمایش.
 * همه‌ی محاسبه‌ها در me11/me11-engine.ts است.
 */

export interface Routing {
  id: number; code: string; version: string; title: string; status: number; ptype: number; method: number; batch: number;
  lineId: number | null; line: string; isTemplate: boolean; isToll: boolean; customer: string; rate: number | null; rateBasis: number | null;
  processWaste: number | null; productId: number | null; productCode: string; product: string; unit: string; structures: string;
  opCount: number; activeVersions: number; versions: string; openWos: number; wos: number; reports: number;
}

export interface Op {
  id: number; routingId: number; seq: number; opId: number; opCode: string; title: string; nature: number; outsourced: boolean;
  alloc: number | null; yield: number | null; resKind: 'S' | 'G' | null; resId: number | null; resTitle: string; resSource: number; resLineId: number | null;
  hasTiming: boolean; timingBatch: number | null; setup: number; eqRun: number; labRun: number; outRun: number; teardown: number; wait: number;
  waitOccupies: boolean; timingYield: number | null; transferBatch: number | null; capCount: number; matCount: number; outCount: number;
  attrCount: number; actCount: number; actMin: number; vaMin: number; subCount: number; qualifiedSubs: number; recCount: number; altCount: number;
}

export interface Alt { roId: number; routingId: number; title: string; resKind: 'S' | 'G' | null; resId: number | null; resTitle: string; rule: number; from: number | null; to: number | null; priority: number }
export interface Link { routingId: number; from: number; to: number; share: number | null; overlap: number }

export interface Defect {
  key: string; rule: string; cat: string; sev: number; form: string; routingId: number | null; roId: number | null; libOpId: number | null;
  ref: string; title: string; detail: string;
}

export interface Report {
  id: number; number: string; woId: number; wo: string; woType: number; woStatus: number; wooId: number; roId: number | null; routingId: number | null;
  seq: number; title: string; lineId: number | null; resource: string; start: number; end: number; minutes: number; good: number; waste: number;
  reprocess: boolean; source: number; toComplete: number; first: boolean; reportsInOp: number;
}

export interface Usage {
  wooId: number; roId: number | null; capId: number; capCode: string; capTitle: string; unit: string; produced: number; actual: number | null;
  basis: number | null; fixed: number | null; variable: number | null; per: number | null; steps: string;
}

export interface Elig {
  productId: number; lineId: number; orderType: number; versionId: number; code: string; title: string; priority: number; min: number | null; max: number | null;
  status: number; eff: number; routingId: number; routingCode: string; reject: string;
}

export interface CovProduct { id: number; code: string; title: string; unit: string; versions: number; openReq: number; openWos: number; hasStructure: boolean }
export interface Line { id: number; code: string; title: string }

export interface Resource {
  key: string; kind: 'S' | 'G'; id: number; title: string; lineId: number | null; lineTitle: string; active: boolean; bottleneckFlag: boolean;
  dayMin: number; weekDays: number; calendar: string; groupId: number | null; machines: number | null; avail: number | null; prod: number | null;
  downtime: number | null; labor: number | null; capSource: number;
}

export interface Demand { source: 'REQ' | 'WO'; number: string; productId: number; remaining: number; need: number | null; lineId: number | null; routingId: number | null; versionId: number | null; priority: number; orderType: number }

export interface Subcontract {
  roId: number; contractorId: number; contractor: string; contractorActive: boolean; qual: number; contractTo: number | null; capOp: string; priority: number;
  rule: number; fee: number | null; feeUnit: string; lead: number | null; wastePct: number | null; service: string; isActive: boolean; hasCap: boolean; regFee: number | null;
}

export interface Contractor { id: number; code: string; title: string; daysLeft: number | null; qual: number; active: boolean; caps: number; expiredQual: number }

export interface SubOrder {
  woId: number; wo: string; product: string; opTitle: string; contractorId: number | null; contractor: string; toComplete: number; sentAt: number | null;
  expectedReturn: number | null; expectedReady: number | null; delayDays: number; overdue: boolean; progressCompleted: number; progressWasted: number;
  receivedGood: number; defective: number; declaredWaste: number; fee: number | null; lead: number | null;
}

export interface Me11Bundle {
  routings: Routing[]; ops: Op[]; alts: Alt[]; links: Link[]; defects: Defect[]; reports: Report[]; usage: Usage[]; elig: Elig[]; products: CovProduct[];
  lines: Line[]; resources: Resource[]; demand: Demand[]; subcontracts: Subcontract[]; contractors: Contractor[]; subOrders: SubOrder[];
}

// ───────── ثابت‌ها ─────────

export type Tone = 'ok' | 'info' | 'warn' | 'bad' | 'muted';

/** دسته‌های چک‌لیست سلامت روش با فرم مالک */
export const CATEGORIES: { code: string; label: string; form: string; owner: string }[] = [
  { code: 'RES', label: 'منبع و ایستگاه', form: 'FRM-ME-02', owner: 'مهندسی فرایند' },
  { code: 'GRAPH', label: 'گراف عملیات', form: 'FRM-ME-02', owner: 'مهندسی فرایند' },
  { code: 'TIME', label: 'زمان و کارکرد', form: 'FRM-ME-03', owner: 'مطالعه‌ی کار و زمان' },
  { code: 'MAT', label: 'تخصیص مواد', form: 'FRM-ME-04', owner: 'مهندسی فرایند' },
  { code: 'OUT', label: 'پوشش خروجی‌ها', form: 'FRM-ME-04', owner: 'مهندسی فرایند' },
  { code: 'BATCH', label: 'ویژگی‌های بچ', form: 'FRM-ME-04', owner: 'تضمین کیفیت' },
  { code: 'POL', label: 'سیاست مواد', form: 'FRM-ME-06', owner: 'برنامه‌ریزی مواد' },
  { code: 'VER', label: 'نسخه‌ی تولید', form: 'FRM-ME-08', owner: 'مدیر فنی' },
  { code: 'SUB', label: 'برون‌سپاری', form: 'FRM-ME-07', owner: 'تأمین و برون‌سپاری' },
  { code: 'REC', label: 'بازیابی', form: 'FRM-ME-05', owner: 'مهندسی فرایند' },
  { code: 'CONT', label: 'تولید پیوسته', form: 'FRM-ME-09', owner: 'برنامه‌ریزی تولید' },
  { code: 'COST', label: 'محرک هزینه', form: 'FRM-ME-10', owner: 'بهای تمام‌شده' },
  { code: 'LIB', label: 'کتابخانه‌ی عملیات', form: 'FRM-ME-01', owner: 'مهندسی فرایند' },
];
export const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.code, c.label]));
export const CAT_OWNER: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.code, c.owner]));
export const FORM_OWNER: Record<string, string> = {
  'FRM-ME-01': 'مهندسی فرایند', 'FRM-ME-02': 'مهندسی فرایند', 'FRM-ME-03': 'مطالعه‌ی کار و زمان', 'FRM-ME-04': 'مهندسی فرایند', 'FRM-ME-05': 'مهندسی فرایند',
  'FRM-ME-06': 'برنامه‌ریزی مواد', 'FRM-ME-07': 'تأمین و برون‌سپاری', 'FRM-ME-08': 'مدیر فنی', 'FRM-ME-09': 'برنامه‌ریزی تولید', 'FRM-ME-10': 'بهای تمام‌شده',
  'FRM-RM-06': 'برنامه‌ریزی ظرفیت',
};

export const SEV_LABEL: Record<number, string> = { 1: 'اطلاع', 2: 'هشدار', 3: 'بحرانی' };
export const ORDER_TYPE: Record<number, string> = { 1: 'عادی', 2: 'دوباره‌کاری', 3: 'نمونه', 4: 'کارمزدی' };
export const ROUTING_STATUS: Record<number, string> = { 1: 'پیش‌نویس', 2: 'در گردش تأیید', 3: 'تأییدشده', 4: 'منسوخ' };
export const QUAL_STATUS: Record<number, string> = { 1: 'تأییدشده', 2: 'مشروط', 3: 'تعلیق' };
export const NATURE: Record<number, string> = { 1: 'تولیدی', 2: 'کیفی', 3: 'تولیدی-کیفی', 4: 'اطلاعاتی', 5: 'برون‌سپاری', 6: 'انتقال' };

/** شرح فرمول‌ها برای راهنمای هر فضا */
export const HEALTH_FORMULA =
  'امتیاز سلامت = ۱۰۰ × e^(−جریمه ÷ ۱۲۰)؛ جریمه = جمع نقص‌ها (بحرانی ۲۵، هشدار ۱۰، اطلاع ۳؛ سقف ۴۰ در هر دسته). نقص کتابخانه‌ای عملیات‌های روش با وزن «اطلاع» به ارث می‌رسد. ' +
  'رنگ: ≥۹۰ سالم، ≥۷۰ قابل‌قبول، ≥۵۰ ضعیف، کمتر بحرانی.';
export const CALIB_FORMULA =
  'هر گزارش: زمان اجرا ÷ (تکمیل + ضایعات). در اولین گزارش هر عملیات دستور، راه‌اندازی استاندارد کم می‌شود. استاندارد = بیشینه‌ی زمان ماشین و نیرو به‌ازای واحد. ' +
  'پیشنهاد = استاندارد + w × (میانه‌ی واقعی − استاندارد)؛ در حالت خودکار w = n ÷ (n + k) (انقباض بیزی به سمت استاندارد).';
export const SIM_FORMULA =
  'دقیقه‌ی لازم = Σ بچ‌ها × (راه‌اندازی + پس از اجرا + انتظارِ اشغال‌کننده) + مقدار × سهم شاخه × زمان اجرا ÷ کارایی. ' +
  'ظرفیت = دقیقه‌ی روز تقویم × روز کاری × تعداد × دسترس‌پذیری × بهره‌وری − توقف استاندارد هر شیفت. ایستگاه عضو گروه منبع روی ظرفیت گروه حساب می‌شود.';
export const DEBT_FORMULA = 'اثر = وزن شدت (۹/۴/۱) × ضریب وضعیت روش (تأییدشده ۱، در تأیید ۰٫۸، الگو ۰٫۶، پیش‌نویس ۰٫۵، منسوخ ۰٫۳) × گستره (۱ + دستور باز + نسخه‌ی فعال).';
