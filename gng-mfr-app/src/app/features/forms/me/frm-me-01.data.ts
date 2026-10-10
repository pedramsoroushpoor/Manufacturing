/** مدل‌های نمایشی FRM-ME-01 «کتابخانه‌ی عملیات». */

export interface OpGroupRow {
  id: number;
  parentId: number | null;
  code: string;
  title: string;
  description: string;
  level: number;
  path: string;
  sortOrder: number;
  operationCount: number;
}

export interface OperationRow {
  id: number;
  code: string;
  title: string;
  groupId: number | null;
  group: string;
  typeCode: number;
  nature: string;
  isActive: boolean;
  description: string;
  resourceCount: number;
  primaryResource: string;
  skillCount: number;
  toolCount: number;
  energyCount: number;
  activeInstructionCount: number;
  parameterCount: number;
  activityCount: number;
}

/** ۱ ایستگاه/گروه منبع، ۲ مهارت، ۳ ابزار، ۴ انرژی/کارکرد */
export interface ResourceRow {
  operationId: number;
  kindCode: 1 | 2 | 3 | 4;
  kind: string;
  title: string;
  scope: string;
  quantity: number | null;
  unit: string;
  mandatory: boolean;
  isPrimary: boolean | null;
  priority: number | null;
  level: string;
  isValid: boolean | null;
  description: string;
}

export interface InstructionRow {
  operationId: number;
  sequence: number | null;
  documentNumber: string;
  title: string;
  revision: number;
  statusCode: 1 | 2 | 3;
  status: string;
  media: string;
  mediaIcon: string;
  fileName: string;
  effectiveDate: string;
  approver: string;
  onTerminal: boolean;
  body: string;
  neededTools: string;
  neededUniforms: string;
  mandatory: boolean;
}

export interface ParameterRow {
  operationId: number;
  sequence: number | null;
  name: string;
  unit: string;
  target: number | null;
  min: number | null;
  max: number | null;
  source: string;
  sampling: number | null;
  stopsLine: boolean;
  critical: boolean;
  /** هدف بیرون از محدوده یا حد پایین بزرگ‌تر از حد بالا */
  inconsistent: boolean;
}

export interface Me01Bundle {
  groups: OpGroupRow[];
  operations: OperationRow[];
  resources: ResourceRow[];
  instructions: InstructionRow[];
  parameters: ParameterRow[];
}

export interface OpIssue {
  severity: 'danger' | 'warning';
  text: string;
}
