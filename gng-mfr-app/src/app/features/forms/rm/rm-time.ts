/**
 * کمک‌تابع‌های زمان و تاریخ مشترک فرم‌های تقویمی حوزه‌ی مدیریت منابع.
 *
 * زمان‌ها در دیتابیس «دقیقه از نیمه‌شب»‌اند. تاریخ‌ها «روز تقویمی»‌اند، نه لحظه:
 * همیشه در UTC خوانده می‌شوند تا با منطقه‌ی زمانی مرورگر جابه‌جا نشوند.
 */
export const DAY_MINUTES = 1440;

const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

export const fa = (n: number): string => n.toLocaleString('fa-IR', { maximumFractionDigits: 2 });

/** دقیقه از نیمه‌شب → «۰۶:۰۰». */
export function faTime(minutes: number): string {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const two = (n: number) => n.toLocaleString('fa-IR', { minimumIntegerDigits: 2, useGrouping: false });
  return `${two(Math.floor(m / 60))}:${two(m % 60)}`;
}

/** دقیقه → ساعت با حداکثر یک رقم اعشار («۴٫۵»). */
export const faHours = (minutes: number): string =>
  (minutes / 60).toLocaleString('fa-IR', { maximumFractionDigits: 1 });

export const isoDay = (value: string): string => value.slice(0, 10);

export const utcDay = (iso: string): Date => new Date(`${isoDay(iso)}T00:00:00Z`);

export const faDate = (iso: string, opts: Intl.DateTimeFormatOptions): string =>
  utcDay(iso).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', ...opts });

export const faFullDate = (iso: string): string => faDate(iso, { year: 'numeric', month: '2-digit', day: '2-digit' });

export function addDays(iso: string, n: number): string {
  const d = utcDay(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ستون‌های یک پنجره‌ی چندروزه — سرستون مشترک جدول‌های تقویمی. */
export interface WindowDay {
  iso: string;
  weekday: string;
  dayText: string;
  monthText: string;
  isFriday: boolean;
  isToday: boolean;
}

export function buildWindowDays(from: string, days: number, today: string): WindowDay[] {
  return Array.from({ length: days }, (_, i) => {
    const iso = addDays(from, i);
    const weekdayIndex = utcDay(iso).getUTCDay();
    return {
      iso,
      weekday: WEEKDAYS[weekdayIndex],
      dayText: faDate(iso, { day: 'numeric' }),
      monthText: faDate(iso, { month: 'long' }),
      isFriday: weekdayIndex === 5,
      isToday: iso === today,
    };
  });
}

export const windowText = (from: string, days: number): string =>
  `${faFullDate(from)} تا ${faFullDate(addDays(from, days - 1))}`;

const WEEKDAY_BITS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

/** ماسک روزهای کاری (بیت ۰ = شنبه … بیت ۶ = جمعه) → متن. */
export function workDaysText(mask: number): string {
  if (mask === 127) return 'همه‌ی روزهای هفته';
  if (mask === 63) return 'شنبه تا پنجشنبه';
  if (mask === 31) return 'شنبه تا چهارشنبه';
  return WEEKDAY_BITS.filter((_, i) => (mask & (1 << i)) !== 0).join('، ') || '—';
}
