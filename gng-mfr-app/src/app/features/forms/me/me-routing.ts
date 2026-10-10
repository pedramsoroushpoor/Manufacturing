import { TreeNode } from 'primeng/api';

/**
 * مشترک فرم‌های مهندسی تولید که روی «روش ساخت» کار می‌کنند (ME-02 تا ME-10):
 * شکل ردیف روش از mes.GetRoutings، کدهای موقت، و درخت پنل کناری (الگوها، سپس به تفکیک محصول).
 */

export interface RoutingApiRow {
  RoutingId: number;
  Code: string;
  Title: string;
  VersionCode: string | null;
  VersionId: number;
  ProductionTypeCode: number;
  RoutingMethodCode: number;
  RoutingBatchSize: number;
  MinBatchSize: number | null;
  MaxBatchSize: number | null;
  ValidFromDate: string;
  ValidToDate: string | null;
  StatusCode: number | null;
  LineId: number | null;
  LineTitle: string | null;
  IsTemplate: boolean;
  TemplateRoutingId: number | null;
  TemplateTitle: string | null;
  IsTollManufacturing: boolean;
  CustomerTitle: string | null;
  Description: string | null;
  UnitTitle: string | null;
  Products: string | null;
  OperationCount: number;
}

export interface RoutingRow {
  id: number;
  code: string;
  title: string;
  version: string;
  typeCode: number;
  type: string;
  methodCode: number;
  method: string;
  batch: number;
  minBatch: number | null;
  maxBatch: number | null;
  validFrom: string;
  validTo: string;
  validFromIso: string;
  validToIso: string | null;
  statusCode: number;
  status: string;
  line: string;
  lineId: number | null;
  isTemplate: boolean;
  templateId: number | null;
  template: string;
  isToll: boolean;
  customer: string;
  description: string;
  unit: string;
  products: string;
  operationCount: number;
}

export const ROUTING_STATUS: Record<number, string> = { 1: 'پیش‌نویس', 2: 'در گردش تأیید', 3: 'تأییدشده', 4: 'منسوخ' };
export const PRODUCTION_TYPE: Record<number, string> = { 1: 'بچی', 2: 'پیوسته' };
export const ROUTING_METHOD: Record<number, string> = { 1: 'تک‌مرحله‌ای', 2: 'چندمرحله‌ای' };
export const NATURE: Record<number, string> = { 1: 'تولیدی', 2: 'کیفی', 3: 'تولیدی-کیفی', 4: 'اطلاعاتی', 5: 'برون‌سپاری', 6: 'انتقال' };

export const faDay = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

export const faNum = (n: number | null | undefined, digits = 3): string =>
  n === null || n === undefined ? '—' : n.toLocaleString('fa-IR', { maximumFractionDigits: digits });

export function mapRouting(r: RoutingApiRow): RoutingRow {
  return {
    id: r.RoutingId,
    code: r.Code,
    title: r.Title,
    version: r.VersionCode ?? '',
    typeCode: r.ProductionTypeCode,
    type: PRODUCTION_TYPE[r.ProductionTypeCode] ?? '—',
    methodCode: r.RoutingMethodCode,
    method: ROUTING_METHOD[r.RoutingMethodCode] ?? '—',
    batch: r.RoutingBatchSize,
    minBatch: r.MinBatchSize,
    maxBatch: r.MaxBatchSize,
    validFrom: faDay(r.ValidFromDate),
    validTo: faDay(r.ValidToDate),
    validFromIso: r.ValidFromDate,
    validToIso: r.ValidToDate,
    statusCode: r.StatusCode ?? 1,
    status: ROUTING_STATUS[r.StatusCode ?? 1] ?? '—',
    line: r.LineTitle ?? '—',
    lineId: r.LineId,
    isTemplate: r.IsTemplate,
    templateId: r.TemplateRoutingId,
    template: r.TemplateTitle ?? '',
    isToll: r.IsTollManufacturing,
    customer: r.CustomerTitle ?? '',
    description: r.Description ?? '',
    unit: r.UnitTitle ?? '',
    products: r.Products ?? '',
    operationCount: r.OperationCount,
  };
}

export function routingStatusSeverity(code: number): 'success' | 'warning' | 'secondary' | 'info' {
  return code === 3 ? 'success' : code === 4 ? 'secondary' : code === 2 ? 'info' : 'warning';
}

/** درخت پنل کناری: الگوها جدا، بقیه به تفکیک محصول؛ هر برگ یک نسخه‌ی روش است. */
export function buildRoutingTree(routings: RoutingRow[], filter: (r: RoutingRow) => boolean = () => true): TreeNode<{ id: number }>[] {
  const visible = routings.filter(filter);
  const leaf = (r: RoutingRow): TreeNode<{ id: number }> => ({
    key: `r-${r.id}`,
    label: `${r.code} ${r.version} — ${r.title}`,
    icon: r.statusCode === 4 ? 'pi pi-history' : r.statusCode === 1 ? 'pi pi-pencil' : r.typeCode === 2 ? 'pi pi-sync' : 'pi pi-sitemap',
    styleClass: r.statusCode === 4 ? 'gng-text-muted' : '',
    data: { id: r.id },
  });
  const groups = new Map<string, RoutingRow[]>();
  for (const r of visible.filter((x) => !x.isTemplate)) {
    const key = r.isToll ? 'کارمزدی دریافتی' : r.products || 'بدون محصول';
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: TreeNode<{ id: number }>[] = [...groups.entries()].map(([label, rows]) => ({
    key: `g-${label}`,
    label,
    icon: 'pi pi-box',
    selectable: false,
    expanded: true,
    children: rows.map(leaf),
  }));
  const templates = visible.filter((x) => x.isTemplate);
  if (templates.length) out.push({ key: 'g-tpl', label: 'الگوها', icon: 'pi pi-clone', selectable: false, expanded: true, children: templates.map(leaf) });
  return out;
}

/** پیش‌فرض انتخاب: اولین روش تأییدشده‌ی جاری غیرالگو با بیشترین عملیات */
export function defaultRouting(routings: RoutingRow[]): RoutingRow | undefined {
  return [...routings].filter((r) => !r.isTemplate && r.statusCode === 3).sort((a, b) => b.operationCount - a.operationCount)[0] ?? routings[0];
}
