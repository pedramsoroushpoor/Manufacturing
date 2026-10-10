import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { NATURE, RoutingApiRow, mapRouting } from './me-routing';
import { Me02Bundle } from './frm-me-02.data';

interface ApiBundle {
  routings: RoutingApiRow[];
  assignments: { RoutingId: number; StructureCode: string; StructureTitle: string; ProductCode: string | null; ProductTitle: string | null; ProductId: number; StructureQuantity: number | null; UnitTitle: string | null }[];
  operations: {
    RoutingOperationId: number; RoutingId: number; Sequence: number; OperationId: number; OperationCode: string; OperationTitle: string; NatureCode: number;
    ResourceTitle: string | null; ResourceSource: 0 | 1 | 2; AllocationPercent: number | null; YieldPercent: number | null; IsOutsourcing: boolean | null; Description: string | null;
  }[];
  links: { RoutingId: number; FromId: number; ToId: number; SharePercent: number | null; OverlapTypeCode: number; OverlapQuantity: number | null; OverlapMinutes: number | null; Description: string | null }[];
  alternatives: {
    RoutingOperationId: number; RoutingId: number; Sequence: number; MainOperation: string; AlternativeOperation: string; AlternativeNatureCode: number;
    ResourceTitle: string | null; SelectionRuleCode: number; FromQuantity: number | null; ToQuantity: number | null; Priority: number | null; Description: string | null;
  }[];
  outputs: { RoutingId: number; RoutingOperationId: number; ProductCode: string; ProductTitle: string; UnitTitle: string | null; ReceiveOutputTypeCode: number; IsMainOutputProduct: boolean; Quantity: number }[];
}

const RULE: Record<number, string> = { 1: 'بازه‌ی مقدار سفارش', 2: 'منبع اصلی در دسترس نیست', 3: 'انتخاب کاربر', 4: 'کمترین هزینه', 5: 'کمترین زمان' };
export const OUTPUT_TYPE: Record<number, string> = { 1: 'اصلی', 2: 'همزاد', 3: 'جانبی', 4: 'ضایعات', 5: 'بازیافتی', 6: 'نیمه‌ساخته' };

/** FRM-ME-02 روی mes.GetRoutings، GetRoutingOperations، GetRoutingLinks، GetRoutingAlternatives، GetRoutingOutputs. */
@Injectable({ providedIn: 'root' })
export class FrmMe02Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<Me02Bundle> {
    return this.http.get<ApiBundle>(`${API_BASE_URL}/api/me02/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        routings: b.routings.map(mapRouting),
        assignments: b.assignments.map((a) => ({
          routingId: a.RoutingId,
          structure: `${a.StructureCode} — ${a.StructureTitle}`,
          product: a.ProductCode ? `${a.ProductCode} — ${a.ProductTitle}` : '—',
          productId: a.ProductId,
          quantity: a.StructureQuantity,
          unit: a.UnitTitle ?? '',
        })),
        operations: b.operations.map((o) => ({
          id: o.RoutingOperationId,
          routingId: o.RoutingId,
          sequence: o.Sequence,
          operationId: o.OperationId,
          code: o.OperationCode,
          title: o.OperationTitle,
          natureCode: o.NatureCode,
          nature: NATURE[o.NatureCode] ?? '—',
          resource: o.ResourceTitle ?? '',
          resourceSource: o.ResourceSource,
          share: o.AllocationPercent,
          yieldPercent: o.YieldPercent,
          outsourced: !!o.IsOutsourcing,
          description: o.Description ?? '',
        })),
        links: b.links.map((k) => ({
          routingId: k.RoutingId,
          fromId: k.FromId,
          toId: k.ToId,
          share: k.SharePercent,
          overlapType: k.OverlapTypeCode,
          overlapQuantity: k.OverlapQuantity,
          overlapMinutes: k.OverlapMinutes,
          description: k.Description ?? '',
        })),
        alternatives: b.alternatives.map((a) => ({
          routingOperationId: a.RoutingOperationId,
          routingId: a.RoutingId,
          sequence: a.Sequence,
          main: a.MainOperation,
          alternative: a.AlternativeOperation,
          alternativeNature: NATURE[a.AlternativeNatureCode] ?? '—',
          resource: a.ResourceTitle ?? '—',
          rule: RULE[a.SelectionRuleCode] ?? '—',
          fromQuantity: a.FromQuantity,
          toQuantity: a.ToQuantity,
          priority: a.Priority,
          description: a.Description ?? '',
        })),
        outputs: b.outputs.map((x) => ({
          routingId: x.RoutingId,
          routingOperationId: x.RoutingOperationId,
          product: `${x.ProductCode} — ${x.ProductTitle}`,
          unit: x.UnitTitle ?? '',
          typeCode: x.ReceiveOutputTypeCode,
          type: OUTPUT_TYPE[x.ReceiveOutputTypeCode] ?? '—',
          isMain: x.IsMainOutputProduct,
          quantity: x.Quantity,
        })),
      }))
    );
  }
}
