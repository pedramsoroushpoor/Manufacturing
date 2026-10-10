import { TreeNode } from 'primeng/api';

/**
 * نوع‌های داده و داده‌ی نمونه (Mock) فرم FRM-RM-02 — «تجهیزات، ابزار و قالب».
 * داده‌ی واقعی از FrmRm02Service می‌آید؛ Mock فقط وقتی نمایش داده می‌شود که
 * API/دیتابیس در دسترس نباشد.
 */

/** درخت نمونه برای حالت Mock (در حالت واقعی، درخت سازمانی مشترک می‌آید). */
export const EQUIPMENT_TREE: TreeNode[] = [
  {
    key: 'line2',
    label: 'خط قرص‌سازی ۲',
    icon: 'pi pi-directions',
    expanded: true,
    children: [
      { key: 'st20', label: '20 — گرانولاسیون', icon: 'pi pi-stop' },
      { key: 'st30a', label: '30A — پرس A', icon: 'pi pi-stop' },
      { key: 'st30b', label: '30B — پرس B', icon: 'pi pi-stop' },
      { key: 'st40', label: '40 — روکش‌دهی', icon: 'pi pi-stop' },
      { key: 'st50', label: '50 — بسته‌بندی', icon: 'pi pi-stop' },
    ],
  },
];

/** وضعیت نگهداری که از سیستم نت می‌آید. */
export type MaintenanceCode = 'available' | 'repair' | 'stopped';

export interface EquipmentRow {
  id?: number;
  code: string;
  title: string;
  /** عمق در سلسله‌مراتب والد/فرزند تجهیز (۰ = تجهیز اصلی). */
  depth: number;
  parent: string;
  type: string;
  /** محل نصب: خط و ایستگاه، یا واحد سازمانی برای تأسیسات عمومی. */
  location: string;
  status: 'فعال' | 'خارج از سرویس';
  hoursText: string;
  hoursUpdatedText: string;
  maintenance: MaintenanceCode;
}
export const EQUIPMENT_LIST: EquipmentRow[] = [
  { code: 'EQ-1042', title: 'میکسر گرانولاتور شماره ۳', depth: 0, parent: '—', type: 'میکسر', location: 'خط قرص‌سازی ۲ · ایستگاه 20', status: 'فعال', hoursText: '۱۸٬۳۲۰', hoursUpdatedText: '—', maintenance: 'available' },
  { code: 'EQ-1042-01', title: 'موتور گیربکس', depth: 1, parent: 'EQ-1042', type: 'زیرمجموعه', location: 'خط قرص‌سازی ۲ · ایستگاه 20', status: 'فعال', hoursText: '۱۸٬۳۲۰', hoursUpdatedText: '—', maintenance: 'available' },
  { code: 'EQ-1055', title: 'پرس روتاری A', depth: 0, parent: '—', type: 'پرس', location: 'خط قرص‌سازی ۲ · ایستگاه 30A', status: 'فعال', hoursText: '۱۲٬۷۶۰', hoursUpdatedText: '—', maintenance: 'available' },
  { code: 'EQ-1056', title: 'پرس روتاری B', depth: 0, parent: '—', type: 'پرس', location: 'خط قرص‌سازی ۲ · ایستگاه 30B', status: 'فعال', hoursText: '۱۱٬۸۹۰', hoursUpdatedText: '—', maintenance: 'available' },
  { code: 'EQ-1071', title: 'دستگاه کوتینگ', depth: 0, parent: '—', type: 'روکش‌دهی', location: 'خط قرص‌سازی ۲ · ایستگاه 40', status: 'فعال', hoursText: '۱۴٬۳۰۵', hoursUpdatedText: '—', maintenance: 'stopped' },
  { code: 'EQ-1088', title: 'بلیستر ماشین', depth: 0, parent: '—', type: 'بسته‌بندی', location: 'خط قرص‌سازی ۲ · ایستگاه 50', status: 'فعال', hoursText: '۸٬۴۴۰', hoursUpdatedText: '—', maintenance: 'available' },
];

export interface AttributeRow {
  equipment: string;
  attribute: string;
  value: string;
  unit: string;
}
export const TECHNICAL_ATTRIBUTES: AttributeRow[] = [
  { equipment: 'EQ-1055 — پرس روتاری A', attribute: 'تعداد پانچ', value: '۳۶', unit: 'عدد' },
  { equipment: 'EQ-1055 — پرس روتاری A', attribute: 'حداکثر سرعت', value: '۱۸۰٬۰۰۰', unit: 'قرص/ساعت' },
  { equipment: 'EQ-1042 — میکسر گرانولاتور شماره ۳', attribute: 'ظرفیت مخزن', value: '۵۰۰', unit: 'kg' },
  { equipment: 'EQ-1071 — دستگاه کوتینگ', attribute: 'حجم پن', value: '۲۵۰', unit: 'لیتر' },
];

export interface CapabilityRow {
  equipment: string;
  operation: string;
  productRange: string;
  nominalRate: string;
  requiredTool: string;
}
export const CAPABILITIES: CapabilityRow[] = [
  { equipment: 'EQ-1055 — پرس روتاری A', operation: 'پرس — قرص جامد بدون روکش', productRange: '۸ – ۱۴ mm', nominalRate: '۱۸۰٬۰۰۰ قرص/ساعت', requiredTool: 'قالب پانچ متناظر با قطر' },
  { equipment: 'EQ-1055 — پرس روتاری A', operation: 'پرس — قرص روکش‌پذیر', productRange: '۱۰ – ۱۴ mm', nominalRate: '۱۵۰٬۰۰۰ قرص/ساعت', requiredTool: 'TL-204 — قالب پانچ ۱۲ mm' },
];

export type ToolSeverity = 'success' | 'warning' | 'danger' | 'info';

export interface ToolRow {
  code: string;
  title: string;
  /** تجهیزی که ابزار روی آن نصب است، یا «انبار ابزار». */
  mountedOn: string;
  lifePercent: number;
  severity: ToolSeverity;
  note: string;
}
export const TOOL_LIFE: ToolRow[] = [
  { code: 'TL-204', title: 'قالب پانچ ۱۲ mm', mountedOn: 'EQ-1055 — پرس روتاری A', lifePercent: 72, severity: 'success', note: '۲۶۰٬۰۰۰ از ۳۶۰٬۰۰۰ ضربه · تیزکاری بعدی در ۳۰۰٬۰۰۰' },
  { code: 'TL-205', title: 'قالب پانچ ۱۰ mm', mountedOn: 'EQ-1055 — پرس روتاری A', lifePercent: 91, severity: 'danger', note: '۲٬۵۵۰٬۰۰۰ از ۲٬۸۰۰٬۰۰۰ ضربه · نیازمند تعویض' },
  { code: 'TL-311', title: 'قالب کپسول', mountedOn: 'انبار ابزار — سالن جامدات', lifePercent: 34, severity: 'info', note: '۱٬۷۰۰٬۰۰۰ از ۵٬۰۰۰٬۰۰۰ ضربه' },
];

/** ماتریس زمان تعویض یک تجهیز — دقیقه؛ سطر = از، ستون = به؛ null = تعریف‌نشده. */
export interface ChangeoverMatrix {
  equipment: string;
  classes: string[];
  cells: (number | null)[][];
}
export const CHANGEOVER_MATRICES: ChangeoverMatrix[] = [
  {
    equipment: 'EQ-1055 — پرس روتاری A',
    classes: ['قرص سفید', 'قرص روکش‌دار', 'قرص رنگی', 'کپسول'],
    cells: [
      [null, 25, 45, 90],
      [90, null, 35, 20],
      [95, 30, null, 40],
      [90, 85, 85, null],
    ],
  },
];

export interface SoftwareVersionRow {
  equipment: string;
  software: string;
  currentVersion: string;
  latestVersion: string;
  updatedAt: string;
  status: 'به‌روز' | 'نیازمند به‌روزرسانی';
}
export const SOFTWARE_VERSIONS: SoftwareVersionRow[] = [
  { equipment: 'EQ-1055 — پرس روتاری A', software: 'PLC-FW', currentVersion: '4.2.1', latestVersion: '4.2.1', updatedAt: '۱۴۰۵/۰۳/۱۰', status: 'به‌روز' },
  { equipment: 'EQ-1071 — دستگاه کوتینگ', software: 'HMI', currentVersion: '2.8.0', latestVersion: '3.0.0', updatedAt: '۱۴۰۴/۱۱/۰۲', status: 'نیازمند به‌روزرسانی' },
];
