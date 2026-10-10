export const HEALTH_STATS = [
  { label: 'نرخ موفقیت', value: '۹۹٫۸٪', tone: 'success' as const },
  { label: 'رویداد امروز', value: '۵٬۰۵۴', tone: 'default' as const },
  { label: 'API فعال', value: '۳۷', tone: 'default' as const },
  { label: 'صف ناموفق', value: '۱۱', tone: 'danger' as const, meta: 'قابل ارسال مجدد' },
];

export interface AdjacentContract {
  code: string;
  name: string;
  direction: string;
  tone: 'success' | 'warning' | 'secondary';
}
export const ADJACENT_CONTRACTS: AdjacentContract[] = [
  { code: 'WM', name: 'انبار', direction: 'دوطرفه — سالم', tone: 'success' },
  { code: 'HR', name: 'منابع انسانی', direction: 'ورودی — سالم', tone: 'success' },
  { code: 'MN', name: 'نگهداری و تعمیرات', direction: 'دوطرفه — سالم', tone: 'success' },
  { code: 'CO', name: 'بهای تمام‌شده', direction: 'خروجی — فاز بعد', tone: 'secondary' },
  { code: 'PP', name: 'برنامه‌ریزی تولید', direction: 'دوطرفه — فاز بعد', tone: 'secondary' },
  { code: 'تدارکات', name: 'تدارکات', direction: 'خروجی — سالم', tone: 'success' },
];
export const CRITICAL_NOTE = 'ریسک مسیر بحرانی: قراردادهای یکپارچگی باید در اسپرینت‌های اولیه توافق شوند؛ تاخیر در آن‌ها توسعه‌ی فاز ۲ را قفل می‌کند.';

export interface EventRow {
  event: string;
  publisher: string;
  consumers: string;
  volumeToday: string;
  avgLatency: string;
  status: 'سالم' | 'کند';
}
export const EVENT_CATALOG: EventRow[] = [
  { event: 'OrderReleased', publisher: 'PC', consumers: 'WM · PP · MN', volumeToday: '۱۸۴', avgLatency: '۱۲ ms', status: 'سالم' },
  { event: 'MaterialConsumed', publisher: 'PC', consumers: 'WM · CO · QC', volumeToday: '۲٬۹۴۱', avgLatency: '۱۸ ms', status: 'سالم' },
  { event: 'ProductReceived', publisher: 'PC', consumers: 'WM · CO · SL', volumeToday: '۶۲۷', avgLatency: '۴۱۰ ms', status: 'کند' },
  { event: 'OperationCompleted', publisher: 'PC', consumers: 'PP · CO · MN', volumeToday: '۱٬۲۰۵', avgLatency: '۱۵ ms', status: 'سالم' },
  { event: 'DowntimeLogged', publisher: 'PC', consumers: 'MN · RM', volumeToday: '۹۳', avgLatency: '۹ ms', status: 'سالم' },
  { event: 'BomChanged', publisher: 'PE', consumers: 'PP · WM · PR · QC', volumeToday: '۴', avgLatency: '۲۲ ms', status: 'سالم' },
];

export interface EquipmentRow {
  line: string;
  protocol: string;
  tags: string;
  mode: string;
  lastData: string;
  status: 'متصل' | 'قطع موقت';
}
export const EQUIPMENT_ROWS: EquipmentRow[] = [
  { line: 'خط قرص‌سازی ۲ — پرس روتاری', protocol: 'OPC-UA', tags: 'تگ ۱۴', mode: 'پیشنهاد + تایید', lastData: 'پیش ۳ ثانیه', status: 'متصل' },
  { line: 'خط قرص‌سازی ۲ — بلیستر', protocol: 'Modbus TCP', tags: 'تگ ۹', mode: 'خودکار', lastData: 'پیش ۱ ثانیه', status: 'متصل' },
  { line: 'خط شربت — پرکن', protocol: 'OPC-UA', tags: 'تگ ۱۱', mode: 'پیشنهاد + تایید', lastData: 'پیش ۱۴:۲۲', status: 'قطع موقت' },
];

export const BANNER_DANGER = 'اتصال پرکن خط شربت قطع شده است. ثبت گزارش تولید آن خط به حالت دستی برگشته است.';
export const BANNER_WARNING = 'رویداد ProductReceived کند شده — تاخیر میانگین ۴۱۰ میلی‌ثانیه در برابر آستانه‌ی ۱۰۰.';

export const CONTRACT_NOTE = 'هر سیستم مرز خود را با قرارداد صریح (نسخه‌بندی‌شده) تعریف می‌کند — بدون دسترسی مستقیم دیگر سیستم‌ها به دیتابیس هم.';
export const EVENT_ARCH_NOTE = 'معماری رویدادمحور: تولید یک رویداد را منتشر می‌کند و مصرف‌کننده‌ها بدون کوپلینگ مستقیم دریافت می‌کنند.';
export const API_NOTE = 'API عمومی (REST) برای همه‌ی موجودیت‌های اصلی — با نسخه‌بندی و سند OpenAPI خودکار.';
export const EQUIPMENT_LAYER_NOTE = 'لایه‌ی اتصال به تجهیزات: میان‌افزار مستقل از پروتکل (OPC-UA / Modbus / MQTT) بین PLC/SCADA و رویدادهای سیستم.';
export const WEBHOOK_NOTE = 'Webhook خروجی برای رویدادها — امکان اشتراک هر سیستم بیرونی در رویدادهای منتخب بدون توسعه‌ی اختصاصی.';

export const AUDIT_RANGE = 'F-PF-031 تا F-PF-034, F-PF-036';
