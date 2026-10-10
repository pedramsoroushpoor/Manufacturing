import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { RoutingApiRow, mapRouting } from './me-routing';
import { Me04Bundle } from './frm-me-04.data';
import { OUTPUT_TYPE } from './frm-me-02.service';

interface ApiBundle {
  routings: RoutingApiRow[];
  links: { RoutingId: number; FromId: number; ToId: number }[];
  stages: {
    RoutingId: number; RoutingOperationId: number; Sequence: number; OperationCode: string; OperationTitle: string; YieldPercent: number | null; AllocationPercent: number | null;
    IntermediateStorageCode: number | null; LineSideTitle: string | null; ProcessWastePercent: number | null; WastePriorityCode: number | null;
  }[];
  materials: {
    RoutingId: number; StructureCode: string; StructureItemId: number; ItemSequence: number; ProductCode: string; ProductTitle: string; UnitTitle: string | null;
    StructureQuantity: number | null; IsActiveIngredient: boolean | null; RowWastePercent: number | null; IsWastePriorityOverOperation: boolean | null;
    RoutingOperationId: number | null; OperationSequence: number | null; OperationTitle: string | null; ConsumptionPointCode: number | null;
    AllocationPercent: number | null; IsBackflushed: boolean | null; AllocatedQuantity: number | null; Description: string | null;
  }[];
  outputs: { RoutingId: number; RoutingOperationId: number; FromOperationSequence: number; ProductCode: string; ProductTitle: string; UnitTitle: string | null; ReceiveOutputTypeCode: number; IsMainOutputProduct: boolean; IsDeliverableProduct: boolean | null; Quantity: number; Description: string | null }[];
  coverage: { RoutingId: number; StructureCode: string; ProductCode: string; ProductTitle: string; MasterProductTypeCode: number; Quantity: number; UnitTitle: string | null; OperationSequences: string | null }[];
  attributes: { RoutingId: number; RoutingOperationId: number; Sequence: number; OperationTitle: string; AttributeId: number; AttributeCode: string; AttributeTitle: string; UnitTitle: string | null; ActionCode: number; IsQcGate: boolean; Description: string | null }[];
}

export const POINT: Record<number, string> = { 1: 'ابتدای عملیات', 2: 'حین عملیات', 3: 'پایان عملیات' };
export const STORAGE: Record<number, string> = { 1: 'مستقیم به عملیات بعد', 2: 'انبار میانی', 3: 'انبار پای کار' };
export const WASTE_PRIORITY: Record<number, string> = { 1: 'ضایعات ردیف ساختار', 2: 'ضایعات عملیات', 3: 'ضایعات فرایند' };
const ACTION: Record<number, string> = { 1: 'تعیین', 2: 'به‌روزرسانی', 3: 'تأیید' };
/* MasterProductTypeCode ساختار (گام ۱۳) به نوع خروجی روش */
const MASTER_TYPE: Record<number, string> = { 1: 'اصلی', 2: 'همزاد', 3: 'جانبی', 4: 'ضایعات', 5: 'بازیافتی' };

/** FRM-ME-04 روی mes.GetRoutingMaterials، GetRoutingOutputs، GetRoutingOutputCoverage، GetRoutingStages، GetRoutingBatchAttributes. */
@Injectable({ providedIn: 'root' })
export class FrmMe04Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<Me04Bundle> {
    return this.http.get<ApiBundle>(`${API_BASE_URL}/api/me04/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        routings: b.routings.map(mapRouting),
        links: b.links.map((k) => ({ routingId: k.RoutingId, fromId: k.FromId, toId: k.ToId })),
        stages: b.stages.map((s) => ({
          routingId: s.RoutingId,
          routingOperationId: s.RoutingOperationId,
          sequence: s.Sequence,
          operation: `${s.OperationCode} — ${s.OperationTitle}`,
          yieldPercent: s.YieldPercent,
          share: s.AllocationPercent,
          storageCode: s.IntermediateStorageCode,
          storage: s.IntermediateStorageCode ? STORAGE[s.IntermediateStorageCode] : '—',
          lineSide: s.LineSideTitle ?? '',
          processWaste: s.ProcessWastePercent,
          wastePriorityCode: s.WastePriorityCode,
        })),
        materials: b.materials.map((m) => ({
          routingId: m.RoutingId,
          structure: m.StructureCode,
          itemId: m.StructureItemId,
          itemSequence: m.ItemSequence,
          product: `${m.ProductCode} — ${m.ProductTitle}`,
          unit: m.UnitTitle ?? '',
          structureQuantity: m.StructureQuantity,
          isActiveIngredient: !!m.IsActiveIngredient,
          rowWaste: m.RowWastePercent,
          rowWasteWins: !!m.IsWastePriorityOverOperation,
          routingOperationId: m.RoutingOperationId,
          operationSequence: m.OperationSequence,
          operation: m.OperationTitle ?? '',
          pointCode: m.ConsumptionPointCode,
          point: m.ConsumptionPointCode ? POINT[m.ConsumptionPointCode] : '',
          allocation: m.AllocationPercent,
          backflushed: !!m.IsBackflushed,
          allocatedQuantity: m.AllocatedQuantity,
          description: m.Description ?? '',
        })),
        outputs: b.outputs.map((x) => ({
          routingId: x.RoutingId,
          routingOperationId: x.RoutingOperationId,
          sequence: x.FromOperationSequence,
          product: `${x.ProductCode} — ${x.ProductTitle}`,
          unit: x.UnitTitle ?? '',
          typeCode: x.ReceiveOutputTypeCode,
          type: OUTPUT_TYPE[x.ReceiveOutputTypeCode] ?? '—',
          isMain: x.IsMainOutputProduct,
          stored: !!x.IsDeliverableProduct,
          quantity: x.Quantity,
          description: x.Description ?? '',
        })),
        coverage: b.coverage.map((c) => ({
          routingId: c.RoutingId,
          structure: c.StructureCode,
          product: `${c.ProductCode} — ${c.ProductTitle}`,
          typeCode: c.MasterProductTypeCode,
          type: MASTER_TYPE[c.MasterProductTypeCode] ?? '—',
          quantity: c.Quantity,
          unit: c.UnitTitle ?? '',
          operations: c.OperationSequences ?? '',
        })),
        attributes: b.attributes.map((a) => ({
          routingId: a.RoutingId,
          routingOperationId: a.RoutingOperationId,
          sequence: a.Sequence,
          operation: a.OperationTitle,
          attributeId: a.AttributeId,
          attribute: `${a.AttributeCode} — ${a.AttributeTitle}`,
          unit: a.UnitTitle ?? '',
          actionCode: a.ActionCode,
          action: ACTION[a.ActionCode] ?? '—',
          qcGate: a.IsQcGate,
          description: a.Description ?? '',
        })),
      }))
    );
  }
}
