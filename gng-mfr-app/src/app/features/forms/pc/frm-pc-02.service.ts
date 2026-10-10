import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { Pc02Bundle, WoMaterial, WoOperation, WorkOrder } from './frm-pc-02.data';

/* ردیف‌های خام API (PascalCase) */
type Row = Record<string, any>;

const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const nn = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** نگاشت ردیف دستور کار — همان شکل mes.GetWorkOrders که FRM-PC-03 هم می‌خواند */
export function mapWorkOrder(o: Row): WorkOrder {
  return {
    id: o['WorkOrderId'],
    number: s(o['Number']),
    name: s(o['Name']),
    typeCode: o['WOTypeCode'],
    statusCode: o['StatusCode'],
    priorityCode: o['PriorityCode'] ?? 1,
    basisCode: o['BasisCode'] ?? 1,
    productId: o['ProductId'],
    productCode: s(o['ProductCode']),
    productTitle: s(o['ProductTitle']),
    unit: s(o['UnitTitle']),
    quantity: n(o['Quantity']),
    lineId: nn(o['LineId']),
    line: s(o['LineTitle']),
    versionId: nn(o['VersionId']),
    versionCode: s(o['VersionCode']),
    versionNote: s(o['VersionSelectionNote']),
    versionOverridden: !!o['IsVersionOverridden'],
    overrideReason: s(o['VersionOverrideReason']),
    routingCode: s(o['RoutingCode']),
    structureCode: s(o['StructureCode']),
    batchNumber: s(o['BatchNumber']),
    plannedRelease: o['PlannedReleaseDate'] ?? null,
    actualRelease: o['ActualReleaseDate'] ?? null,
    plannedComplete: o['PlannedCompleteDate'] ?? null,
    actualComplete: o['ActualCompleteDate'] ?? null,
    closeDate: o['CloseDate'] ?? null,
    dueDate: o['DueDate'] ?? null,
    shiftDate: o['ShiftDate'] ?? null,
    shiftTitle: s(o['ShiftTitle']),
    shiftId: nn(o['ShiftId']),
    refId: nn(o['RefWorkOrderId']),
    refNumber: s(o['RefWorkOrderNumber']),
    customer: s(o['CustomerTitle']),
    configuration: s(o['ConfigurationText']),
    referenceObject: s(o['ReferenceObjectNumber']),
    description: s(o['Description']),
    lastOpCompleted: n(o['LastOpCompleted']),
    wastedTotal: n(o['WastedTotal']),
    operationCount: n(o['OperationCount']),
    operationsDone: n(o['OperationsDone']),
    currentOperation: s(o['CurrentOperation']),
    requests: s(o['Requests']),
  };
}

export function mapMaterial(m: Row): WoMaterial {
  return {
    workOrderId: m['WorkOrderId'],
    id: m['MaterialId'],
    operationId: m['WOOperationId'],
    operationSeq: n(m['OperationSequence']),
    productId: m['ProductId'],
    productCode: s(m['ProductCode']),
    productTitle: s(m['ProductTitle']),
    unit: s(m['UnitTitle']),
    group: s(m['ProductGroupTitle']),
    standard: n(m['StandardQuantity']),
    plannedKit: n(m['PlannedKitQuantity']),
    actualKit: nn(m['ActualKitQuantity']),
    consumed: nn(m['ConsumedQuantity']),
    returned: nn(m['ReturnedQuantity']),
    excess: nn(m['ExcessQuantity']),
    shortage: nn(m['ShortageQuantity']),
    statusCode: n(m['StatusCode']),
    batch: s(m['BatchNumber']),
    potency: nn(m['Potency']),
    customer: !!m['IsCustomerMaterial'],
    recovered: !!m['IsRecoveredMaterial'],
    quantumSatis: !!m['IsQuantumSatis'],
    substitutedTitle: s(m['SubstitutedTitle']),
    description: s(m['Description']),
    stockAvailable: n(m['StockAvailable']),
    stockReserved: n(m['StockReserved']),
    stockInTransit: n(m['StockInTransit']),
    nextArrival: m['NextArrival'] ?? null,
  };
}

function mapOperation(x: Row): WoOperation {
  return {
    workOrderId: x['WorkOrderId'],
    id: x['WOOperationId'],
    sequence: n(x['Sequence']),
    code: s(x['OperationCode']),
    title: s(x['OperationTitle']),
    natureCode: n(x['NatureCode']),
    statusCode: n(x['StatusCode']),
    outsourced: !!x['IsOutsourced'],
    resource: s(x['ResourceTitle']),
    toComplete: n(x['ToCompleteQuantity']),
    received: n(x['ReceivedQuantity']),
    inProcess: n(x['InProcessQuantity']),
    completed: n(x['CompletedQuantity']),
    wasted: n(x['WastedQuantity']),
    rework: n(x['ReworkQuantity']),
    transferred: n(x['TransferredQuantity']),
    yieldPct: nn(x['YieldPercent']),
    actualYieldPct: nn(x['ActualYieldPercent']),
    start: x['StartTime'] ?? null,
    end: x['EndTime'] ?? null,
    planStart: x['PlanStartTime'] ?? null,
    planEnd: x['PlanEndTime'] ?? null,
    description: s(x['Description']),
    stdMinutes: n(x['StdMinutes']),
  };
}

/** FRM-PC-02 روی /api/pc02/bundle (mes.GetWorkOrders، …Operations، …Materials، …Products، …History). */
@Injectable({ providedIn: 'root' })
export class FrmPc02Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Pc02Bundle> {
    return this.http.get<Record<string, Row[]>>(`${API_BASE_URL}/api/pc02/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        orders: (b['orders'] ?? []).map(mapWorkOrder),
        operations: (b['operations'] ?? []).map(mapOperation),
        materials: (b['materials'] ?? []).map(mapMaterial),
        products: (b['products'] ?? []).map((p) => ({
          workOrderId: p['WorkOrderId'],
          productCode: s(p['ProductCode']),
          productTitle: s(p['ProductTitle']),
          unit: s(p['UnitTitle']),
          typeCode: n(p['OutputTypeCode']),
          quantity: n(p['Quantity']),
          yieldPct: nn(p['YieldPercent']),
          actualYieldPct: nn(p['ActualYieldPercent']),
          description: s(p['Description']),
        })),
        changes: (b['changes'] ?? []).map((c) => ({
          workOrderId: c['WorkOrderId'],
          date: c['ChangeDate'] ?? null,
          field: s(c['FieldTitle']),
          oldValue: s(c['OldValue']),
          newValue: s(c['NewValue']),
          statusCode: n(c['StatusCode']),
          requestedBy: s(c['RequestedByTitle']),
          approvedBy: s(c['ApprovedByTitle']),
          reason: s(c['Reason']),
          recalculation: s(c['RecalculationNote']),
        })),
        cancellations: (b['cancellations'] ?? []).map((c) => ({
          workOrderId: c['WorkOrderId'],
          date: c['CancelDate'] ?? null,
          reason: s(c['CancelReasonTitle']),
          materialDispositionCode: nn(c['MaterialDispositionCode']),
          workDispositionCode: nn(c['WorkDispositionCode']),
          inventoryDocument: s(c['InventoryDocumentHeaderNumber']),
          permit: s(c['PermitHeaderNumber']),
          description: s(c['Description']),
        })),
      }))
    );
  }
}
