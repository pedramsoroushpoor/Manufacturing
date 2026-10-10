import { AlmMenuRow, AlmSystemRow } from '../models/menu-item.model';

/**
 * فهرست نمونه‌ی «سیستم‌ها» (سطح صفر alm.Menu) — معادل mock پاسخ
 * GET /api/alm/systems، برای وقتی که gng-mfr-api در دسترس نباشد.
 *
 * فعلاً فقط «مدیریت تولید» (subSystemCode='mes') واقعاً پیاده‌سازی شده؛
 * وقتی سیستم‌های دیگر (برنامه‌ریزی تولید، بهای تمام‌شده، ...) به
 * alm.Menu واقعی اضافه شدند، همین‌جا هم — فقط برای حالت آفلاین/mock —
 * می‌توانند ردیف بگیرند. عمداً اینجا سیستم ساختگی اضافه نشده تا حالت
 * mock وانمود نکند چیزی ساخته شده که هنوز نیست.
 */
export const MENU_SYSTEMS_MOCK_DATA: AlmSystemRow[] = [
  { code: '400', title: 'مدیریت تولید', subSystemCode: 'mes', sortOrder: 1 },
];

/**
 * داده‌ی نمونه — معادل ساختاری alm.Menu برای هر ۵ دامنه‌ی Manufacturing
 * (چارچوب مشترک، مدیریت منابع، مهندسی محصول، مهندسی تولید، کنترل تولید) به
 * همراه هر ۴۷ فرم عملیاتی که در `DETAILED_FORM_COMPONENTS` ثبت شده‌اند.
 * همه‌ی ردیف‌ها subSystemCode='mes' دارند (مطابق کشف واقعی از دیتابیس —
 * mes کد منطقیِ زیرسیستم «مدیریت تولید» در ALM است، نه نام اسکیمای SQL).
 *
 * این آرایه فقط وقتی استفاده می‌شود که gng-mfr-api در دسترس نباشد (مثلاً
 * run-api.bat اجرا نشده) — تا دمو/توسعه بدون بک‌اند هم با منوی کامل و
 * ناوبری واقعی به همه‌ی فرم‌ها ممکن باشد. در فاز اتصال واقعی، جایگزین پاسخ
 * API از جدول alm.Menu می‌شود.
 */
export const MENU_MOCK_DATA: AlmMenuRow[] = [
  { code: '410', title: 'چارچوب مشترک', parentCode: null, subSystemCode: 'mes', menuLevel: 1, sortOrder: 1 },
  { code: 'FRM-PF-01', title: 'کنسول پیکربندی پلتفرم', parentCode: '410', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PF-01', sortOrder: 1 },
  { code: 'FRM-PF-02', title: 'مدیریت نسخه، اعتبار و تغییر مهندسی', parentCode: '410', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PF-02', sortOrder: 2 },
  { code: 'FRM-PF-03', title: 'طراح گردش کار و دسترسی', parentCode: '410', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PF-03', sortOrder: 3 },
  { code: 'FRM-PF-04', title: 'استودیوی توسعه‌پذیری', parentCode: '410', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PF-04', sortOrder: 4 },
  { code: 'FRM-PF-05', title: 'مرکز یکپارچگی', parentCode: '410', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PF-05', sortOrder: 5 },
  { code: 'FRM-PF-06', title: 'انطباق و ممیزی', parentCode: '410', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PF-06', sortOrder: 6 },
  { code: 'FRM-PF-07', title: 'مدیریت نیازمندی و ماتریس ردیابی', parentCode: '410', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PF-07', sortOrder: 7 },

  { code: '420', title: 'مدیریت منابع', parentCode: null, subSystemCode: 'mes', menuLevel: 1, sortOrder: 2 },
  { code: 'FRM-RM-01', title: 'ساختار کارخانه و خطوط تولید', parentCode: '420', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-RM-01', sortOrder: 1 },
  { code: 'FRM-RM-02', title: 'تجهیزات، ابزار و قالب', parentCode: '420', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-RM-02', sortOrder: 2 },
  { code: 'FRM-RM-03', title: 'نیروی کار و ماتریس مهارت', parentCode: '420', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-RM-03', sortOrder: 3 },
  { code: 'FRM-RM-04', title: 'شیفت و برنامه‌ی حضور', parentCode: '420', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-RM-04', sortOrder: 4 },
  { code: 'FRM-RM-05', title: 'تقویم تولید', parentCode: '420', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-RM-05', sortOrder: 5 },
  { code: 'FRM-RM-06', title: 'کارکرد استاندارد و ظرفیت', parentCode: '420', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-RM-06', sortOrder: 6 },
  { code: 'FRM-RM-07', title: 'طبقه‌بندی علل', parentCode: '420', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-RM-07', sortOrder: 7 },
  { code: 'FRM-RM-08', title: 'پیمانکاران تولید', parentCode: '420', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-RM-08', sortOrder: 8 },
  { code: 'FRM-RM-09', title: 'مبانی هزینه‌یابی و ABC', parentCode: '420', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-RM-09', sortOrder: 9 },

  { code: '430', title: 'مهندسی محصول', parentCode: null, subSystemCode: 'mes', menuLevel: 1, sortOrder: 3 },
  { code: 'FRM-PE-01', title: 'ویژگی‌های تولیدی قلم', parentCode: '430', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PE-01', sortOrder: 1 },
  { code: 'FRM-PE-02', title: 'ساختار محصول', parentCode: '430', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PE-02', sortOrder: 2 },
  { code: 'FRM-PE-03', title: 'گروه جایگزین و سیاست جایگزینی', parentCode: '430', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PE-03', sortOrder: 3 },
  { code: 'FRM-PE-04', title: 'خروجی‌های ساختار و بازدهی', parentCode: '430', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PE-04', sortOrder: 4 },
  { code: 'FRM-PE-05', title: 'بازیابی مواد در فرایند', parentCode: '430', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PE-05', sortOrder: 5 },
  { code: 'FRM-PE-06', title: 'ساختار ماتریسی و اقلام ابعادی', parentCode: '430', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PE-06', sortOrder: 6 },
  { code: 'FRM-PE-07', title: 'پیکربندی محصول', parentCode: '430', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PE-07', sortOrder: 7 },
  { code: 'FRM-PE-08', title: 'نماها و محاسبات ساختار', parentCode: '430', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PE-08', sortOrder: 8 },
  { code: 'FRM-PE-09', title: 'مدیریت تغییر مهندسی (ECO)', parentCode: '430', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PE-09', sortOrder: 9 },

  { code: '440', title: 'مهندسی تولید', parentCode: null, subSystemCode: 'mes', menuLevel: 1, sortOrder: 4 },
  { code: 'FRM-ME-01', title: 'کتابخانه‌ی عملیات', parentCode: '440', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-ME-01', sortOrder: 1 },
  { code: 'FRM-ME-02', title: 'روش ساخت', parentCode: '440', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-ME-02', sortOrder: 2 },
  { code: 'FRM-ME-03', title: 'کارکرد استاندارد و زمان عملیات', parentCode: '440', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-ME-03', sortOrder: 3 },
  { code: 'FRM-ME-04', title: 'اقلام و خروجی در سطح عملیات', parentCode: '440', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-ME-04', sortOrder: 4 },
  { code: 'FRM-ME-05', title: 'عملیات بازیابی مواد', parentCode: '440', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-ME-05', sortOrder: 5 },
  { code: 'FRM-ME-06', title: 'سیاست‌های تغذیه، مصرف و رسید', parentCode: '440', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-ME-06', sortOrder: 6 },
  { code: 'FRM-ME-07', title: 'برون‌سپاری و کارمزدی', parentCode: '440', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-ME-07', sortOrder: 7 },
  { code: 'FRM-ME-08', title: 'نسخه‌ی تولید', parentCode: '440', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-ME-08', sortOrder: 8 },
  { code: 'FRM-ME-09', title: 'تولید پیوسته و کمپین', parentCode: '440', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-ME-09', sortOrder: 9 },
  { code: 'FRM-ME-10', title: 'فعالیت و محرک هزینه‌ی عملیات', parentCode: '440', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-ME-10', sortOrder: 10 },

  { code: '450', title: 'کنترل تولید', parentCode: null, subSystemCode: 'mes', menuLevel: 1, sortOrder: 5 },
  { code: 'FRM-PC-01', title: 'درخواست تولید', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-01', sortOrder: 1 },
  { code: 'FRM-PC-02', title: 'دستور کار', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-02', sortOrder: 2 },
  { code: 'FRM-PC-03', title: 'آزادسازی، شارژ و تغذیه‌ی پای کار', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-03', sortOrder: 3 },
  { code: 'FRM-PC-04', title: 'گزارش تولید', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-04', sortOrder: 4 },
  { code: 'FRM-PC-05', title: 'ترمینال کف کارگاه', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-05', sortOrder: 5 },
  { code: 'FRM-PC-06', title: 'مصرف مواد', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-06', sortOrder: 6 },
  { code: 'FRM-PC-07', title: 'رسید محصول و هویت‌بخشی', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-07', sortOrder: 7 },
  { code: 'FRM-PC-08', title: 'بازیابی مواد در اجرا', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-08', sortOrder: 8 },
  { code: 'FRM-PC-09', title: 'ضایعات، دوباره‌کاری و بازیافت', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-09', sortOrder: 9 },
  { code: 'FRM-PC-10', title: 'اجرای برون‌سپاری و کارمزدی', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-10', sortOrder: 10 },
  { code: 'FRM-PC-11', title: 'پورتال پیمانکار و مشتری کارمزدی', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-11', sortOrder: 11 },
  { code: 'FRM-PC-12', title: 'کنسول پایش و بستن دستور', parentCode: '450', subSystemCode: 'mes', menuLevel: 2, formCode: 'FRM-PC-12', sortOrder: 12 },
];
