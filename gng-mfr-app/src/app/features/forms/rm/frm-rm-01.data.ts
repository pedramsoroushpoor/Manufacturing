import { TreeNode } from 'primeng/api';
import { GraphEdge, GraphNode } from '../../../shared/topology-graph/topology-graph.component';

/**
 * داده‌ی نمونه (Mock) برای پروتوتایپ FRM-RM-01 — «ساختار کارخانه و خطوط
 * تولید». این‌ها صرفاً برای نمایش چیدمان و رفتار UI هستند و از دیتابیس
 * واقعی (mfr/generalmfr) نمی‌آیند؛ در فاز اتصال به دیتابیس جایگزین می‌شوند.
 */

export const ORG_HIERARCHY_TREE: TreeNode[] = [
  {
    key: 'company',
    label: 'گروه صنعتی گلرنگ',
    icon: 'pi pi-building',
    expanded: true,
    children: [
      {
        key: 'branch',
        label: 'شعبه‌ی دارو و بهداشت',
        icon: 'pi pi-sitemap',
        expanded: true,
        children: [
          {
            key: 'factory',
            label: 'داروسازی شماره ۱',
            icon: 'pi pi-building',
            expanded: true,
            children: [
              {
                key: 'unit',
                label: 'سالن جامدات',
                icon: 'pi pi-th-large',
                expanded: true,
                children: [
                  { key: 'line1', label: 'خط قرص‌سازی ۱', icon: 'pi pi-directions' },
                  {
                    key: 'line2',
                    label: 'خط قرص‌سازی ۲',
                    icon: 'pi pi-directions',
                    expanded: true,
                    children: [
                      { key: 'st10', label: '۱۰ — توزین', icon: 'pi pi-stop' },
                      { key: 'st20', label: '۲۰ — گرانولاسیون', icon: 'pi pi-stop' },
                      { key: 'st30', label: '۳۰ — پرس A/B', icon: 'pi pi-stop' },
                      { key: 'st40', label: '۴۰ — روکش‌دهی', icon: 'pi pi-stop' },
                      { key: 'st50', label: '۵۰ — بسته‌بندی', icon: 'pi pi-stop' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export type TopologyNodeType = 'sequential' | 'parallel' | 'buffer';

export interface TopologyNode {
  code: string;
  label: string;
  sublabel: string;
  type: TopologyNodeType;
}

/** توپولوژی خط ۲ (نمونه)، از راست به چپ به همان ترتیب گردش تولید */
export const LINE_TOPOLOGY: TopologyNode[] = [
  { code: '10', label: 'توزین', sublabel: 'ایستگاه ۲', type: 'sequential' },
  { code: '20', label: 'گرانولاسیون', sublabel: 'میکسر ۳', type: 'sequential' },
  { code: '30AB', label: 'پرس A / B', sublabel: 'موازی', type: 'parallel' },
  { code: 'BUF', label: 'بافر میانی', sublabel: 'ظرفیت ۵۰۰ kg', type: 'buffer' },
  { code: '40', label: 'روکش‌دهی', sublabel: 'دستگاه کوتینگ', type: 'sequential' },
  { code: '50', label: 'بسته‌بندی', sublabel: 'بلیستر + کارتن', type: 'sequential' },
];

/**
 * توپولوژی یک خط به شکل «گراف» (گره + یال) — همان شکلی که
 * GET /api/rm01/topology برمی‌گرداند و TopologyGraphComponent رسم می‌کند.
 */
export interface LineTopology {
  lineId: number;
  code: string;
  title: string;
  unitTitle: string;
  active: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** نسخه‌ی گرافیِ همان خط نمونه (Mock) — وقتی API در دسترس نیست. */
export const MOCK_LINE_TOPOLOGIES: LineTopology[] = [
  {
    lineId: -1,
    code: 'L2-TABLET',
    title: 'خط قرص‌سازی ۲',
    unitTitle: 'سالن جامدات',
    active: true,
    nodes: LINE_TOPOLOGY.map((n, i) => ({
      id: -(i + 1),
      code: n.code,
      label: n.label,
      sublabel: n.sublabel,
      kind: n.type,
      active: true,
      seq: (i + 1) * 10,
    })),
    edges: LINE_TOPOLOGY.slice(1).map((_, i) => ({ from: -(i + 1), to: -(i + 2), kind: 'main' as const, active: true })),
  },
];

export interface StationRow {
  /** شناسه‌ی ایستگاه — فقط در داده‌ی واقعی پر می‌شود. */
  id?: number;
  /** خطی که ایستگاه به آن تعلق دارد (وقتی چند خط هم‌زمان نمایش داده می‌شوند). */
  lineId?: number;
  lineTitle?: string;
  code: string;
  title: string;
  type: string;
  costCenter: string;
  resourceGroup: string;
  sharePercent: string;
  lineSideWarehouse: string;
  status: 'فعال' | 'غیرفعال از تاریخ اثر';
}

export const LINE_STATIONS: StationRow[] = [
  { code: '10', title: 'توزین', type: 'دستی', costCenter: 'CC-2101 جامدات', resourceGroup: '—', sharePercent: '۱۰۰٪', lineSideWarehouse: 'WH-L2-01', status: 'فعال' },
  { code: '20', title: 'گرانولاسیون', type: 'ماشینی', costCenter: 'CC-2101 جامدات', resourceGroup: 'POOL-MIX', sharePercent: '۱۰۰٪', lineSideWarehouse: 'WH-L2-01', status: 'فعال' },
  { code: '30A', title: 'پرس A', type: 'ماشینی', costCenter: 'CC-2101 / CC-2102', resourceGroup: 'POOL-PRESS', sharePercent: '۷۰٪ / ۳۰٪', lineSideWarehouse: 'WH-L2-02', status: 'فعال' },
  { code: '30B', title: 'پرس B', type: 'ماشینی', costCenter: 'CC-2101 / CC-2102', resourceGroup: 'POOL-PRESS', sharePercent: '۷۰٪ / ۳۰٪', lineSideWarehouse: 'WH-L2-02', status: 'فعال' },
  { code: '40', title: 'روکش‌دهی', type: 'ماشینی', costCenter: 'CC-2103 روکش', resourceGroup: '—', sharePercent: '۱۰۰٪', lineSideWarehouse: 'WH-L2-03', status: 'فعال' },
  { code: '25', title: 'بازرسی بصری', type: 'بازرسی', costCenter: 'CC-2104 کیفیت', resourceGroup: '—', sharePercent: '۱۰۰٪', lineSideWarehouse: '—', status: 'غیرفعال از تاریخ اثر' },
];

export interface ResourceGroupRow {
  code: string;
  title: string;
  members: string;
  dispatchRule: string;
}

export const RESOURCE_GROUPS: ResourceGroupRow[] = [
  { code: 'POOL-MIX', title: 'گروه میکسرهای گرانولاسیون', members: 'میکسر ۱، میکسر ۲، میکسر ۳', dispatchRule: 'اولین منبع آزاد' },
  { code: 'POOL-PRESS', title: 'گروه پرس‌های قرص', members: 'پرس A، پرس B', dispatchRule: 'موازی — بار برابر' },
];

export interface MobileResourceRow {
  code: string;
  title: string;
  currentSite: string;
  capability: string;
}

export const MOBILE_RESOURCES: MobileResourceRow[] = [
  { code: 'MOB-01', title: 'داینامومتر قابل‌حمل', currentSite: 'کارخانه ۱ — سالن جامدات', capability: 'سنجش گشتاور پرس' },
  { code: 'MOB-02', title: 'دستگاه توزین سیار', currentSite: 'کارخانه ۱ — انبار مواد اولیه', capability: 'توزین دقیق دسته' },
];

export interface LineSideWarehouseRow {
  code: string;
  title: string;
  linkedStation: string;
  referenceWarehouse: string;
}

export const LINE_SIDE_WAREHOUSES: LineSideWarehouseRow[] = [
  { code: 'WH-L2-01', title: 'انبار پای کار — توزین/گرانولاسیون', linkedStation: 'ایستگاه ۱۰ / ۲۰', referenceWarehouse: 'INV-RM-01 (انبار مواد اولیه)' },
  { code: 'WH-L2-02', title: 'انبار پای کار — پرس', linkedStation: 'ایستگاه ۳۰A / ۳۰B', referenceWarehouse: 'INV-WIP-02 (انبار نیمه‌ساخته)' },
  { code: 'WH-L2-03', title: 'انبار پای کار — روکش/بسته‌بندی', linkedStation: 'ایستگاه ۴۰ / ۵۰', referenceWarehouse: 'INV-WIP-02 (انبار نیمه‌ساخته)' },
];

export interface OrgLevelRow {
  level: string;
  title: string;
  owner: string;
  backup: string;
  status: 'فعال' | 'غیرفعال';
}

export const ORG_LEVELS: OrgLevelRow[] = [
  { level: 'شرکت', title: 'گروه صنعتی گلرنگ', owner: 'مدیرعامل هلدینگ', backup: '—', status: 'فعال' },
  { level: 'شعبه', title: 'دارو و بهداشت', owner: 'مدیر شعبه دارو', backup: 'معاون شعبه', status: 'فعال' },
  { level: 'کارخانه', title: 'داروسازی شماره ۱', owner: 'مدیر کارخانه', backup: 'سرپرست تولید', status: 'فعال' },
  { level: 'واحد تولیدی', title: 'سالن جامدات', owner: 'سرپرست سالن', backup: 'کارشناس ارشد شیفت', status: 'فعال' },
  { level: 'خط', title: 'خط قرص‌سازی ۲', owner: 'مدیر تولید خط', backup: 'جانشین مدیر تولید', status: 'فعال' },
];
