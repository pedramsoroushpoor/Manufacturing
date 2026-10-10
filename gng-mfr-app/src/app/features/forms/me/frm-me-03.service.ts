import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { RoutingApiRow, mapRouting } from './me-routing';
import { Me03Bundle } from './frm-me-03.data';

interface ApiBundle {
  routings: RoutingApiRow[];
  timings: {
    RoutingId: number; RoutingOperationId: number; Sequence: number; OperationCode: string; OperationTitle: string; NatureCode: number; IsOutsourcing: boolean | null; AllocationPercent: number | null;
    HasTiming: boolean; RoutingBatchSize: number | null; SetupTimePerBatch: number | null; EquipmentRunTimePerPart: number | null; LaborRunTimePerPart: number | null;
    OutsourceTimePerPart: number | null; TeardownTimePerBatch: number | null; WaitTimePerBatch: number | null; IsWaitOccupyingResource: boolean | null;
    IsWaitRequiringLabor: boolean | null; MoveTimePerBatch: number | null; QueueTimePerBatch: number | null; TransferBatchSize: number | null;
    BatchSplitRuleCode: number | null; MaxRunQuantity: number | null; Description: string | null;
  }[];
  capacities: {
    RoutingId: number; RoutingOperationId: number; Sequence: number; OperationTitle: string; CapacityTypeId: number; CapacityTitle: string; UnitTitle: string | null;
    CapacityIsActive: boolean; IsCostDriver: boolean | null; CalculationBasisCode: number; FixedQuantity: number | null; VariableQuantity: number | null;
    PerQuantity: number | null; StepsText: string | null; Formula: string | null; Description: string | null;
  }[];
  changeovers: { RoutingId: number; RoutingOperationId: number; Sequence: number; EquipmentId: number; EquipmentTitle: string; FromClassId: number | null; ToClassId: number | null; Minutes: number | null }[];
  classes: { ClassId: number; Code: string; Title: string }[];
  productClasses: { RoutingId: number; ClassId: number | null }[];
}

export const BASIS: Record<number, string> = { 1: 'ثابت به‌ازای سفارش', 2: 'متناسب با مقدار', 3: 'پلکانی', 4: 'ثابت + متغیر', 5: 'فرمول' };
export const SPLIT_RULE: Record<number, string> = { 1: 'تقسیم به چند اجرا', 2: 'گرد کردن به مضرب بچ', 3: 'اجرای یکجا تا سقف' };

/** FRM-ME-03 روی mes.GetRoutingTimings، GetRoutingCapacities، GetRoutingChangeovers. */
@Injectable({ providedIn: 'root' })
export class FrmMe03Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<Me03Bundle> {
    return this.http.get<ApiBundle>(`${API_BASE_URL}/api/me03/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        routings: b.routings.map(mapRouting),
        timings: b.timings.map((t) => ({
          routingId: t.RoutingId,
          routingOperationId: t.RoutingOperationId,
          sequence: t.Sequence,
          operation: `${t.OperationCode} — ${t.OperationTitle}`,
          natureCode: t.NatureCode,
          outsourced: !!t.IsOutsourcing,
          share: t.AllocationPercent,
          hasTiming: t.HasTiming,
          batch: t.RoutingBatchSize,
          setup: t.SetupTimePerBatch ?? 0,
          equipmentRun: t.EquipmentRunTimePerPart ?? 0,
          laborRun: t.LaborRunTimePerPart ?? 0,
          outsourceRun: t.OutsourceTimePerPart ?? 0,
          teardown: t.TeardownTimePerBatch ?? 0,
          wait: t.WaitTimePerBatch ?? 0,
          waitOccupiesResource: !!t.IsWaitOccupyingResource,
          waitNeedsLabor: !!t.IsWaitRequiringLabor,
          move: t.MoveTimePerBatch ?? 0,
          queue: t.QueueTimePerBatch ?? 0,
          transferBatch: t.TransferBatchSize,
          splitRuleCode: t.BatchSplitRuleCode ?? 1,
          maxRun: t.MaxRunQuantity,
          description: t.Description ?? '',
        })),
        capacities: b.capacities.map((c) => ({
          routingId: c.RoutingId,
          routingOperationId: c.RoutingOperationId,
          sequence: c.Sequence,
          operation: c.OperationTitle,
          capacityTypeId: c.CapacityTypeId,
          capacity: c.CapacityTitle,
          unit: c.UnitTitle ?? '',
          capacityActive: c.CapacityIsActive,
          isCostDriver: !!c.IsCostDriver,
          basisCode: c.CalculationBasisCode,
          basis: BASIS[c.CalculationBasisCode] ?? '—',
          fixed: c.FixedQuantity,
          variable: c.VariableQuantity,
          per: c.PerQuantity,
          steps: c.StepsText ?? '',
          formula: c.Formula ?? '',
          description: c.Description ?? '',
        })),
        changeovers: b.changeovers.map((x) => ({
          routingId: x.RoutingId,
          routingOperationId: x.RoutingOperationId,
          sequence: x.Sequence,
          equipmentId: x.EquipmentId,
          equipment: x.EquipmentTitle,
          fromClassId: x.FromClassId,
          toClassId: x.ToClassId,
          minutes: x.Minutes,
        })),
        classes: b.classes.map((c) => ({ id: c.ClassId, code: c.Code, title: c.Title })),
        productClasses: b.productClasses.map((p) => ({ routingId: p.RoutingId, classId: p.ClassId })),
      }))
    );
  }
}

/**
 * ارزیاب کوچک فرمول کارکرد: فقط عدد، Quantity، + - * / و پرانتز. eval استفاده نمی‌شود.
 * خطا با استثنا گزارش می‌شود.
 */
export function evalFormula(expr: string, quantity: number): number {
  const tokens = expr.match(/\d+(\.\d+)?|Quantity|[-+*/()]/g);
  if (!tokens || tokens.join('') !== expr.replace(/\s+/g, '')) throw new Error('نماد ناشناخته در فرمول');
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const factor = (): number => {
    const t = next();
    if (t === '(') {
      const v = sum();
      if (next() !== ')') throw new Error('پرانتز بسته نشده');
      return v;
    }
    if (t === '-') return -factor();
    if (t === 'Quantity') return quantity;
    if (t !== undefined && /^\d/.test(t)) return parseFloat(t);
    throw new Error('فرمول ناقص');
  };
  const term = (): number => {
    let v = factor();
    while (peek() === '*' || peek() === '/') v = next() === '*' ? v * factor() : v / factor();
    return v;
  };
  const sum = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') v = next() === '+' ? v + term() : v - term();
    return v;
  };
  const v = sum();
  if (i !== tokens.length) throw new Error('فرمول ناقص');
  return v;
}

/** «از-تا:مقدار؛ …» → مقدار پله‌ای که مقدار سفارش در آن می‌افتد */
export function evalSteps(steps: string, quantity: number): number {
  const parts = steps.split(';').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error('پله‌ای تعریف نشده');
  for (const p of parts) {
    const m = p.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    if (!m) throw new Error(`پله‌ی نامعتبر «${p}»`);
    if (quantity >= +m[1] && quantity <= +m[2]) return +m[3];
  }
  throw new Error('مقدار سفارش در هیچ پله‌ای نیست');
}
