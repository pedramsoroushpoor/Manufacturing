/** مدل‌های نمایشی FRM-PE-07 «پیکربندی محصول». */

export interface ModelRow {
  id: number;
  code: string;
  title: string;
  product: string;
  structure: string;
  active: boolean;
  description: string;
  featureCount: number;
}

export interface ValueRow {
  modelId: number;
  featureId: number;
  sequence: number;
  featureCode: string;
  feature: string;
  mandatory: boolean;
  valueId: number;
  valueCode: string;
  value: string;
  isDefault: boolean;
  conditionCount: number;
}

/** یک ویژگی با مقادیرش برای پیکربند */
export interface FeatureGroup {
  featureId: number;
  feature: string;
  mandatory: boolean;
  values: ValueRow[];
  selected: number | null;
  hasEffect: boolean;
}

export interface RuleRow {
  modelId: number;
  typeCode: number;
  ifValueId: number;
  ifTitle: string;
  thenValueId: number;
  thenTitle: string;
  message: string;
}

export interface ConditionRow {
  modelId: number;
  actionCode: number;
  action: string;
  valueId: number;
  valueTitle: string;
  itemSequence: number | null;
  product: string;
  quantity: number | null;
  unit: string;
  hasProductionRole: boolean;
  description: string;
}

export interface Pe07Bundle {
  models: ModelRow[];
  values: ValueRow[];
  rules: RuleRow[];
  conditions: ConditionRow[];
}

export interface ResolvedRow {
  sequence: number | null;
  product: string;
  quantity: number | null;
  unit: string;
  status: 'base' | 'conditional' | 'excluded' | 'added';
  condition: string;
}

export interface Violation {
  kind: 'rule' | 'missing';
  text: string;
  message: string;
}

export interface Issue {
  severity: 'danger' | 'warning';
  text: string;
}
