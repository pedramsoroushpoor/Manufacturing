/** مدل‌های نمایشی FRM-ME-06 «سیاست‌های تغذیه، مصرف و رسید». */

/** فیلدهای سیاست که لایه‌به‌لایه به ارث می‌رسند */
export const POLICY_FIELDS = [
  'feeding', 'consumption', 'backflushBasis', 'backflushMoment', 'shortage', 'backflushSource', 'excluded', 'exclusionReason',
  'receipt', 'consumptionInventory', 'receiptInventory', 'documentPattern', 'allocation', 'transferBasis', 'packageSize',
  'lineSide', 'lineSideCapacity', 'minStock', 'maxStock', 'reorderPoint', 'consumptionControl',
] as const;
export type PolicyField = (typeof POLICY_FIELDS)[number];

export interface PolicyRow {
  id: number;
  code: string;
  name: string;
  scopeCode: number;
  scope: string;
  group: string;
  productId: number | null;
  product: string;
  routingOperationId: number | null;
  operation: string;
  /** لایه‌ی نسخه‌ی تولید (FRM-ME-08) */
  version: string;
  description: string;
  values: Partial<Record<PolicyField, string | number | boolean | null>>;
}

export interface PolicyItemRow {
  productId: number;
  product: string;
  group: string;
  unit: string;
  trackingCode: number | null;
  isActiveIngredient: boolean;
  minConsumption: number | null;
  maxConsumption: number | null;
  routingOperationId: number;
  operation: string;
  backflushedInRouting: boolean;
}

export interface Me06Bundle {
  policies: PolicyRow[];
  items: PolicyItemRow[];
}

/** مقدار مؤثر یک فیلد و دامنه‌ای که از آن آمده */
export interface Resolved {
  value: string | number | boolean | null;
  from: string;
}

export interface EffectiveRow {
  item: PolicyItemRow;
  eff: Record<PolicyField, Resolved>;
}

export interface Issue {
  severity: 'danger' | 'warning';
  text: string;
}
