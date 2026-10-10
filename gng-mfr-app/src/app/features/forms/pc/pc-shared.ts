/**
 * مشترک فرم‌های کنترل تولید (FRM-PC-01 تا 12): ساعت سناریو، قالب‌بندی فارسی، کدهای موقت و بارکد.
 *
 * زمان‌ها در پایگاه‌داده بدون منطقه‌ی زمانی ذخیره شده‌اند و mssql آن‌ها را UTC برمی‌گرداند؛ پس همه‌ی
 * قالب‌بندی‌ها با timeZone: 'UTC' است تا همان ساعت ثبت‌شده دیده شود.
 */

/** ساعت سناریو = mes.fnShopNow() (۱۷ مهر ۱۴۰۵ ساعت ۱۱:۳۰)؛ در عملیات واقعی اکنونِ سرور. */
export const SHOP_NOW = new Date(Date.UTC(2026, 9, 9, 11, 30));

export const faNum = (n: number | null | undefined, digits = 2): string =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : Number(n).toLocaleString('fa-IR', { maximumFractionDigits: digits });

export const faInt = (n: number | null | undefined): string => faNum(n, 0);

export const faPct = (n: number | null | undefined, digits = 1): string => (n === null || n === undefined ? '—' : `${faNum(n, digits)}٪`);

export const faDay = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

export const faTime = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleTimeString('fa-IR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

/** «۱۷ مهر ۱۱:۳۰» */
export const faDateTime = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString('fa-IR-u-ca-persian', { timeZone: 'UTC', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : '—';

/** دقیقه‌ی سپری‌شده تا ساعت سناریو */
export const minutesAgo = (iso: string | null | undefined): number | null =>
  iso ? Math.round((SHOP_NOW.getTime() - new Date(iso).getTime()) / 60000) : null;

/** «۴۵ دقیقه»، «۳ ساعت و ۱۰ دقیقه»، «۲ روز» */
export function faDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const m = Math.abs(Math.round(minutes));
  if (m < 60) return `${faInt(m)} دقیقه`;
  if (m < 1440) return m % 60 ? `${faInt(Math.floor(m / 60))} ساعت و ${faInt(m % 60)} دقیقه` : `${faInt(m / 60)} ساعت`;
  const d = Math.floor(m / 1440);
  const h = Math.round((m % 1440) / 60);
  return h ? `${faInt(d)} روز و ${faInt(h)} ساعت` : `${faInt(d)} روز`;
}

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';

// ───────── کدهای موقت (سرآیند اسکریپت‌های mes_frm_pcNN_setup.sql) ─────────

export const WO_TYPE: Record<number, string> = {
  1: 'عادی', 2: 'شیفتی/پیوسته', 3: 'دوباره‌کاری', 4: 'بازیافت', 5: 'برون‌سپاری', 6: 'کارمزدی دریافتی', 7: 'نمونه‌سازی/R&D', 8: 'تعمیراتی-تولیدی', 9: 'پروژه‌ای',
};
export const WO_STATUS: Record<number, string> = { 1: 'برنامه‌ریزی‌شده', 2: 'آزادشده', 3: 'در جریان', 4: 'تکمیل‌شده', 5: 'بسته‌شده', 6: 'باطل', 7: 'معلق' };
export const woStatusTone = (c: number): Tone =>
  c === 3 ? 'info' : c === 2 ? 'warning' : c === 4 ? 'success' : c === 5 ? 'secondary' : c === 6 ? 'danger' : c === 7 ? 'danger' : 'contrast';
export const PRIORITY: Record<number, string> = { 1: 'عادی', 2: 'بالا', 3: 'فوری' };
export const priorityTone = (c: number): Tone => (c === 3 ? 'danger' : c === 2 ? 'warning' : 'secondary');

export const OP_STATUS: Record<number, string> = { 1: 'در انتظار', 2: 'آماده', 3: 'در جریان', 4: 'متوقف', 5: 'تکمیل‌شده', 6: 'نزد پیمانکار' };
export const opStatusTone = (c: number): Tone => (c === 3 ? 'info' : c === 2 ? 'warning' : c === 4 ? 'danger' : c === 5 ? 'success' : c === 6 ? 'contrast' : 'secondary');

export const MATERIAL_STATUS: Record<number, string> = { 1: 'برنامه‌ای', 2: 'کیت‌شده', 3: 'تحویل پای کار', 4: 'در مصرف', 5: 'تسویه‌شده' };

export const REQUEST_ORIGIN: Record<number, string> = { 1: 'فروش', 2: 'انبار (نقطه‌ی سفارش)', 3: 'برنامه‌ریزی مواد', 4: 'داخلی', 5: 'مشتری کارمزدی' };
export const REQUEST_STATUS: Record<number, string> = { 1: 'پیش‌نویس', 2: 'در انتظار تأیید', 3: 'تأییدشده', 4: 'در تولید', 5: 'تکمیل‌شده', 6: 'ردشده' };

export const INVENTORY_KIND: Record<number, string> = { 1: 'انبار مرکزی', 2: 'پای کار', 3: 'قرنطینه', 4: 'امانی مشتری', 5: 'نزد پیمانکار', 6: 'در راه' };
export const STOCK_QC: Record<number, string> = { 1: 'آزاد', 2: 'قرنطینه', 3: 'مردود' };

export const REPORT_SOURCE: Record<number, string> = { 1: 'ثبت اداری', 2: 'ترمینال کارگاه', 3: 'PLC/دستگاه', 4: 'محاسبه‌ای' };
export const CONSUMPTION_MODE: Record<number, string> = { 1: 'دستی', 2: 'Backflush پایان عملیات', 3: 'Backflush در رسید' };

export const OUTPUT_TYPE: Record<number, string> = { 1: 'اصلی', 2: 'هم‌زاد', 3: 'جانبی', 4: 'ضایعات', 5: 'بازیابی‌شده' };
export const RECEIPT_POLICY: Record<number, string> = { 1: 'رسید مستقیم', 2: 'مجوز ورود', 3: 'مشروط به QC', 4: 'انبار قرنطینه' };
export const RECEIPT_QC: Record<number, string> = { 1: 'در انتظار', 2: 'آزاد', 3: 'رد', 4: 'آزاد جزئی' };
export const BATCH_STATUS: Record<number, string> = { 1: 'باز', 2: 'در تولید', 3: 'منتظر QC', 4: 'آزاد', 5: 'آزاد جزئی', 6: 'قرنطینه', 7: 'باطل' };
export const SERIAL_STATUS: Record<number, string> = { 1: 'تولیدشده', 2: 'تخصیص/چاپ', 3: 'تجمیع‌شده', 4: 'ارسال‌شده', 5: 'باطل' };
export const SERIAL_LEVEL: Record<number, string> = { 1: 'واحد', 2: 'کارتن', 3: 'شیپر', 4: 'ظرف نیمه‌ساخته' };
export const GENEALOGY_RELATION: Record<number, string> = { 1: 'مصرف', 2: 'دوباره‌کاری', 3: 'بازیافت', 4: 'تفکیک', 5: 'بازیابی' };

export const NC_TYPE: Record<number, string> = { 1: 'اسقاط', 2: 'قابل بازیافت', 3: 'قابل دوباره‌کاری', 4: 'درجه‌دو' };
export const NC_SOURCE: Record<number, string> = { 1: 'گزارش تولید', 2: 'رد QC', 3: 'اعلام پیمانکار', 4: 'گزارش دوباره‌کاری' };
export const DECISION_STATUS: Record<number, string> = { 1: 'منتظر تصمیم', 2: 'تصمیم گرفته شد', 3: 'اجراشده' };
export const CONTRACTOR_DISPOSITION: Record<number, string> = { 1: 'بازگشت به ما', 2: 'جریمه', 3: 'پذیرش در حد مجاز' };

export const SHIPMENT_DIRECTION: Record<number, string> = { 1: 'ارسال به پیمانکار', 2: 'دریافت از پیمانکار', 3: 'ورود مواد مشتری', 4: 'تحویل به مشتری' };
export const SHIPMENT_ROLE: Record<number, string> = {
  1: 'ماده‌ی ارسالی', 2: 'خروجی سالم', 3: 'خروجی معیوب برگشتی', 4: 'مصرف‌نشده‌ی برگشتی', 5: 'مصرف اعلامی', 6: 'ضایعات اعلامی', 7: 'ماده‌ی مشتری', 8: 'محصول تحویلی',
};
export const SUBCONTRACT_STAGE: Record<number, string> = { 1: 'دریافت مواد', 2: 'در جریان', 3: 'آماده‌ی ارسال', 4: 'ارسال‌شده' };

export const ALERT_SEVERITY: Record<number, string> = { 1: 'اطلاع', 2: 'هشدار', 3: 'بحرانی' };
export const alertTone = (c: number): Tone => (c === 3 ? 'danger' : c === 2 ? 'warning' : 'info');
export const ALERT_CHANNEL: Record<number, string> = { 1: 'داخل سامانه', 2: 'پیامک', 3: 'ایمیل', 4: 'آندون' };
export const ALERT_STATUS: Record<number, string> = { 1: 'باز', 2: 'دیده‌شده', 3: 'ارجاع‌شده', 4: 'رفع‌شده' };
export const ANDON: Record<number, string> = { 1: 'بیکار', 2: 'در حال کار', 3: 'متوقف (برنامه‌ای)', 4: 'توقف باز', 5: 'هم‌پوشانی' };
export const CA_STATUS: Record<number, string> = { 1: 'باز', 2: 'در جریان', 3: 'انجام‌شده' };

// ───────── بارکد Code 39 (برای پیش‌نمایش برچسب؛ اسکن‌پذیر) ─────────

const CODE39: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', A: '100001001', B: '001001001', C: '101001000', D: '000011001', E: '100011000', F: '001011000',
  G: '000001101', H: '100001100', I: '001001100', J: '000011100', K: '100000011', L: '001000011', M: '101000010', N: '000010011',
  O: '100010010', P: '001010010', Q: '000000111', R: '100000110', S: '001000110', T: '000010110', U: '110000001', V: '011000001',
  W: '111000000', X: '010010001', Y: '110010000', Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
};

/**
 * میله‌های Code 39 برای متن (حروف لاتین بزرگ، رقم، - . فاصله): هر عنصر {x, w} در واحد «باریک»؛
 * پهنای کل در total. عنصرهای زوج میله و فرد فاصله‌اند؛ فقط میله‌ها برگردانده می‌شوند.
 */
export function code39Bars(text: string, wide = 2.5): { bars: { x: number; w: number }[]; total: number } {
  const clean = `*${text.toUpperCase().replace(/[^0-9A-Z\-. ]/g, '')}*`;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of clean) {
    const p = CODE39[ch];
    if (!p) continue;
    for (let i = 0; i < 9; i++) {
      const w = p[i] === '1' ? wide : 1;
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    }
    x += 1; // فاصله‌ی بین کاراکترها
  }
  return { bars, total: x - 1 };
}
