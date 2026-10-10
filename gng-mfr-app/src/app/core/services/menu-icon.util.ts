import { AlmMenuRow } from '../models/menu-item.model';

/**
 * انتخاب آیکون و رنگ متنوع برای هر گره‌ی منو — بر اساس کد سطح ۱ (دامنه) و
 * کلیدواژه‌ی عنوان برای سطح ۲ (فرم‌ها). قبلاً همه‌ی گره‌ها یک آیکون یکسان
 * (pi-folder / pi-file) داشتند؛ این فایل با نگاشت معنایی، هر آیکون را به
 * محتوای واقعی فرم نزدیک می‌کند و به هر دامنه یک رنگ اختصاصی می‌دهد.
 *
 * چون کاملاً data-driven از alm.Menu کار می‌کند (نه لیست ثابت کد فرم)، هم
 * روی داده‌ی mock و هم روی پاسخ واقعی API بدون تغییر کار می‌کند.
 */

export interface DomainVisual {
  key: string;
  icon: string;
  colorVar: string;
}

const DOMAIN_VISUALS: Array<{ match: RegExp; visual: DomainVisual }> = [
  { match: /410|چارچوب مشترک|چارچوب/, visual: { key: 'pf', icon: 'pi pi-sliders-h', colorVar: 'var(--gng-teal)' } },
  { match: /420|مدیریت منابع/, visual: { key: 'rm', icon: 'pi pi-users', colorVar: 'var(--gng-info)' } },
  { match: /430|مهندسی محصول/, visual: { key: 'pe', icon: 'pi pi-box', colorVar: 'var(--gng-success)' } },
  { match: /440|مهندسی تولید/, visual: { key: 'me', icon: 'pi pi-cog', colorVar: 'var(--gng-purple)' } },
  { match: /450|کنترل تولید/, visual: { key: 'pc', icon: 'pi pi-chart-line', colorVar: 'var(--gng-primary)' } },
  { match: /گزارش/, visual: { key: 'rpt', icon: 'pi pi-chart-bar', colorVar: 'var(--gng-warning)' } },
];

const DEFAULT_DOMAIN_VISUAL: DomainVisual = { key: 'default', icon: 'pi pi-folder', colorVar: 'var(--gng-primary)' };

// نگاشت کلیدواژه‌ی عنوان فرم → آیکون؛ ترتیب مهم است (خاص‌تر بالاتر)
const TITLE_ICON_RULES: Array<[RegExp, string]> = [
  [/ترمینال/, 'pi pi-desktop'],
  [/پورتال/, 'pi pi-globe'],
  [/پیکربندی/, 'pi pi-sliders-h'],
  [/کنسول/, 'pi pi-gauge'],
  [/درخواست/, 'pi pi-send'],
  [/دستور کار/, 'pi pi-clipboard'],
  [/آزادسازی|شارژ/, 'pi pi-unlock'],
  [/تغذیه/, 'pi pi-share-alt'],
  [/مصرف/, 'pi pi-bolt'],
  [/رسید/, 'pi pi-inbox'],
  [/بازیابی/, 'pi pi-refresh'],
  [/ضایعات|دوباره‌کاری|بازیافت/, 'pi pi-trash'],
  [/برون‌سپاری|کارمزد/, 'pi pi-truck'],
  [/پیمانکار/, 'pi pi-briefcase'],
  [/نسخه|Effectivity|اعتبار/, 'pi pi-tag'],
  [/کمپین|پیوسته/, 'pi pi-sync'],
  [/هزینه‌یابی|محرک هزینه|ABC/, 'pi pi-dollar'],
  [/کتابخانه/, 'pi pi-book'],
  [/روش ساخت/, 'pi pi-directions'],
  [/ظرفیت/, 'pi pi-gauge'],
  [/زمان عملیات|استاندارد/, 'pi pi-stopwatch'],
  [/اقلام و خروجی|خروجی‌های/, 'pi pi-box'],
  [/ساختار کارخانه|خطوط تولید/, 'pi pi-sitemap'],
  [/تجهیزات|ابزار و قالب/, 'pi pi-wrench'],
  [/نیروی کار|مهارت/, 'pi pi-users'],
  [/شیفت|حضور/, 'pi pi-clock'],
  [/تقویم/, 'pi pi-calendar'],
  [/طبقه‌بندی علل|علل/, 'pi pi-exclamation-triangle'],
  [/ویژگی‌های تولیدی/, 'pi pi-tags'],
  [/ساختار محصول/, 'pi pi-sitemap'],
  [/جایگزین/, 'pi pi-sync'],
  [/بازدهی/, 'pi pi-percentage'],
  [/ماتریسی|ابعادی/, 'pi pi-table'],
  [/پیکربندی محصول/, 'pi pi-sliders-h'],
  [/نماها و محاسبات/, 'pi pi-calculator'],
  [/تغییر مهندسی|ECO/, 'pi pi-history'],
  [/هویت‌بخشی/, 'pi pi-qrcode'],
  [/گردش کار|دسترسی/, 'pi pi-share-alt'],
  [/توسعه‌پذیری/, 'pi pi-code'],
  [/یکپارچگی/, 'pi pi-link'],
  [/انطباق|ممیزی/, 'pi pi-shield'],
  [/نیازمندی|ردیابی/, 'pi pi-verified'],
  [/گزارش/, 'pi pi-chart-bar'],
  [/پایش|بستن دستور/, 'pi pi-gauge'],
];

const LEVEL2_FALLBACK_BY_DOMAIN: Record<string, string> = {
  rm: 'pi pi-users',
  pe: 'pi pi-box',
  me: 'pi pi-cog',
  pc: 'pi pi-chart-line',
  pf: 'pi pi-sliders-h',
  rpt: 'pi pi-chart-bar',
  default: 'pi pi-file',
};

export function resolveDomainVisual(row: AlmMenuRow): DomainVisual {
  const haystack = `${row.code ?? ''} ${row.title ?? ''}`;
  for (const rule of DOMAIN_VISUALS) {
    if (rule.match.test(haystack)) return rule.visual;
  }
  return DEFAULT_DOMAIN_VISUAL;
}

export function resolveMenuIcon(row: AlmMenuRow, domainVisual: DomainVisual): string {
  if (row.menuLevel === 1) {
    return domainVisual.icon;
  }
  const title = row.title ?? '';
  for (const [pattern, icon] of TITLE_ICON_RULES) {
    if (pattern.test(title)) return icon;
  }
  return LEVEL2_FALLBACK_BY_DOMAIN[domainVisual.key] ?? LEVEL2_FALLBACK_BY_DOMAIN['default'];
}
