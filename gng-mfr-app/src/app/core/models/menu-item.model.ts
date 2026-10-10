/**
 * ساختار این مدل عیناً منطبق بر ستون‌های جدول alm.Menu است تا در فاز اتصال
 * به دیتابیس (از طریق یک API میانی — Angular مستقیماً به SQL Server وصل
 * نمی‌شود)، جایگزینی MenuMockService با یک HTTP Service واقعی بدون تغییر
 * در بقیه‌ی اپ ممکن باشد.
 *
 * فیلدهای FormTypeCode / FormCode برای منوهای سطح ۲ استفاده می‌شوند که
 * طبق تصمیم پروژه، اتصال آن‌ها به فرم‌های واقعی در مرحله‌ی بعد انجام می‌شود.
 */
export interface AlmMenuRow {
  code: string;
  title: string;
  parentCode: string | null;
  subSystemCode: string;
  menuLevel: number;
  analysisDocumentCode?: string | null;
  formTypeCode?: string | null;
  formCode?: string | null;
  sortOrder?: number | null;
  note?: string | null;
}

/**
 * ردیف سطح صفر (MenuLevel = 0) alm.Menu — یک «سیستم» انتخاب‌پذیر (مدیریت
 * تولید، برنامه‌ریزی تولید، بهای تمام‌شده، ...). پیکر انتخاب سیستم در
 * نوار برند سایدبار از فهرست این ردیف‌ها (GET /api/alm/systems) پر
 * می‌شود؛ با انتخاب یکی، subSystemCode آن برای بارگذاری منوی درختی
 * (GET /api/alm/menu?subSystemCode=...) استفاده می‌شود. افزودن سیستم
 * جدید یعنی فقط یک ردیف MenuLevel=0 جدید در alm.Menu — بدون تغییر کد.
 */
export interface AlmSystemRow {
  code: string;
  title: string;
  subSystemCode: string;
  sortOrder?: number | null;
}

/**
 * گره‌ی درخت منو پس از تبدیل لیست مسطح alm.Menu به ساختار سلسله‌مراتبی.
 *
 * عمداً از `icon` استاندارد PrimeNG TreeNode استفاده نمی‌شود: p-tree هر جا
 * `node.icon` مقداردهی شده باشد، صرف‌نظر از قالب سفارشی محتوا، یک
 * `.p-treenode-icon` داخلی هم رندر می‌کند و باعث دوتایی‌شدن آیکون می‌شود.
 * به‌جای آن `displayIcon`/`displayIconColor` فقط توسط قالب سفارشی ما در
 * sidebar-menu خوانده می‌شوند.
 */
export interface MenuTreeNode {
  key: string;
  label: string;
  data: AlmMenuRow;
  displayIcon?: string;
  /** متغیر رنگ CSS اختصاصی دامنه (مثلاً var(--gng-info)) — برای تنوع بصری آیکون‌ها */
  displayIconColor?: string;
  children?: MenuTreeNode[];
}
