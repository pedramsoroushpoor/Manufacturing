import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { LabelTemplate, PatternRow, Pc07Bundle, SerialInfo, TraceRow } from './frm-pc-07.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Api = Record<string, any>;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** FRM-PC-07 روی mes.GetPc07Bundle، mes.TraceBatch و mes.GetSerial (فقط‌خواندنی). */
@Injectable({ providedIn: 'root' })
export class FrmPc07Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Pc07Bundle> {
    return this.http.get<Record<string, Api[]>>(`${API_BASE_URL}/api/pc07/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        receipts: (b['receipts'] ?? []).map((r) => ({
          id: r['ReceiptId'], number: r['ReceiptNumber'], date: r['ReceiptDate'], woId: r['WorkOrderId'], wo: r['WorkOrderNumber'], opSeq: r['OperationSequence'],
          report: str(r['ReportNumber']), reportedQty: r['ReportedQuantity'] ?? 0, productCode: r['ProductCode'], product: r['ProductTitle'], unit: str(r['UnitTitle']),
          outputType: r['OutputTypeCode'], completed: r['CompletedQuantity'] ?? 0, received: r['ReceivedToInvQuantity'] ?? 0, remained: r['RemainedToInvQuantity'] ?? 0,
          policy: r['ReceiptPolicyCode'], inventory: str(r['InventoryTitle']), batch: str(r['BatchNumber']), qc: r['QcStatusCode'], qcApproved: r['QcApprovedQuantity'],
          qcRejected: r['QcRejectedQuantity'], rejectedRoute: r['RejectedRouteCode'], costShare: r['CostSharePercent'], valuationRate: r['ValuationRate'],
          customerOwned: !!r['IsCustomerOwned'], doc: str(r['DocumentNumber']), note: str(r['Description']),
        })),
        reconReports: (b['reconReports'] ?? []).map((r) => ({
          woId: r['WorkOrderId'], wo: r['WorkOrderNumber'], opSeq: r['OperationSequence'], report: r['ReportNumber'], reportedAt: r['ReportedAt'], product: r['ProductTitle'],
          unit: str(r['UnitTitle']), reported: r['Reported'] ?? 0, received: r['Received'] ?? 0, approved: r['QcApproved'] ?? 0, rejected: r['QcRejected'] ?? 0,
          pending: r['QcPending'], difference: r['Difference'] ?? 0, ageHours: r['AgeHours'] ?? 0, exception: r['ExceptionCode'] ?? 0,
        })),
        reconOutputs: (b['reconOutputs'] ?? []).map((r) => ({
          woId: r['WorkOrderId'], wo: r['WorkOrderNumber'], outputType: r['OutputTypeCode'], product: r['ProductTitle'], unit: str(r['UnitTitle']),
          expected: r['Expected'] ?? 0, received: r['Received'] ?? 0, lastReceipt: r['LastReceipt'], exception: r['ExceptionCode'] ?? 0,
        })),
        batches: (b['batches'] ?? []).map((r) => ({
          id: r['BatchId'], number: r['BatchNumber'], productCode: r['ProductCode'], product: r['ProductTitle'], unit: str(r['UnitTitle']), woId: r['WorkOrderId'],
          wo: str(r['WorkOrderNumber']), woStatus: r['WorkOrderStatusCode'], woType: r['WOTypeCode'], line: str(r['LineTitle']), mfg: r['ManufactureDate'], exp: r['ExpireDate'],
          planned: r['PlannedQuantity'] ?? 0, released: r['ReleasedQuantity'], status: r['StatusCode'], customerOwned: !!r['IsCustomerOwned'], owner: str(r['OwnerTitle']),
          note: str(r['Description']), patternId: r['PatternId'], serialCount: r['SerialCount'] ?? 0, received: r['ReceivedQuantity'] ?? 0,
        })),
        patterns: this.patterns(b['patterns'] ?? []),
        attributes: (b['attributes'] ?? []).map((r) => ({
          batchId: r['BatchId'], batch: r['BatchNumber'], opSeq: r['OperationSequence'], opTitle: r['OperationTitle'], opStatus: r['OperationStatusCode'],
          code: r['AttributeCode'], title: r['AttributeTitle'], unit: str(r['UnitTitle']), action: r['ActionCode'], qcGate: !!r['IsQcGate'], valueNumber: r['ValueNumber'],
          valueText: r['ValueText'], recordedAt: r['RecordedAt'], recordedBy: str(r['RecordedByTitle']), rule: str(r['RuleNote']),
        })),
        serials: (b['serials'] ?? []).map((r) => ({
          woId: r['WorkOrderId'], wo: r['WorkOrderNumber'], batch: r['BatchNumber'], level: r['LevelCode'], status: r['StatusCode'], count: r['SerialCount'] ?? 0,
          first: r['FirstSerial'], last: r['LastSerial'], lastAssigned: r['LastAssignedAt'], patternId: r['PatternId'], opSeq: r['OperationSequence'],
        })),
        serialPatterns: (b['serialPatterns'] ?? []).map((r) => ({
          id: r['PatternId'], number: r['Number'], name: r['Name'], text: r['PatternText'], level: r['LevelCode'], counterLength: r['CounterLength'] ?? 0,
          childrenPerParent: r['ChildrenPerParent'], note: str(r['Description']),
        })),
        links: (b['links'] ?? []).map((r) => ({
          id: r['LinkId'], parentBatch: r['ParentBatchNumber'], parentProduct: `${r['ParentProductCode']} — ${r['ParentProductTitle']}`, parentWo: str(r['ParentWorkOrderNumber']),
          childBatch: r['ChildBatchNumber'], childProduct: `${r['ChildProductCode']} — ${r['ChildProductTitle']}`, childUnit: str(r['ChildUnitTitle']),
          childWo: str(r['ChildWorkOrderNumber']), quantity: r['Quantity'] ?? 0, estimated: !!r['IsQuantityEstimated'], relation: r['RelationTypeCode'], note: str(r['Description']),
        })),
        gaps: (b['gaps'] ?? []).map((r) => ({
          wo: r['WorkOrderNumber'], batch: str(r['BatchNumber']), opSeq: r['OperationSequence'], product: r['ProductTitle'], rows: r['Rows'] ?? 0, quantity: r['Quantity'] ?? 0,
          unit: str(r['UnitTitle']),
        })),
        templates: this.templates(b['templates'] ?? [], b['labelParts'] ?? []),
      }))
    );
  }

  /** ردیف‌های الگو × جزء → یک الگو با فهرست اجزا */
  private patterns(rows: Api[]): PatternRow[] {
    const out = new Map<number, PatternRow>();
    for (const r of rows) {
      let p = out.get(r['PatternId']);
      if (!p) {
        p = {
          id: r['PatternId'], lineId: r['ProductionLineId'], line: r['LineTitle'], group: str(r['ProductGroupTitle']), validFrom: r['ValidFromDate'], validTo: r['ValidToDate'],
          first: str(r['FirstNumber']), last: str(r['LastNumber']), lastUsed: str(r['LastUsedNumber']), totalLength: r['TotalLength'] ?? 0, note: str(r['Description']), items: [],
        };
        out.set(p.id, p);
      }
      if (r['SettingId']) p.items.push({ order: r['OrderNumber'], type: r['ItemTypeCode'], renewal: !!r['IsRenewalFactor'], length: r['NumberItemLength'] ?? 0, value: str(r['NumberItemValue']) });
    }
    for (const p of out.values()) p.items.sort((a, b) => a.order - b.order);
    return [...out.values()];
  }

  private templates(rows: Api[], parts: Api[]): LabelTemplate[] {
    return rows.map((t) => ({
      id: t['TemplateId'], number: t['Number'], name: t['Name'], level: t['LevelCode'], width: t['WidthMm'], height: t['HeightMm'], group: str(t['ProductGroupTitle']),
      note: str(t['Description']),
      parts: parts
        .filter((d) => d['TemplateId'] === t['TemplateId'])
        .map((d) => ({
          templateId: d['TemplateId'], code: d['ParameterCode'], title: d['ParameterTitle'], field: d['SourceField'], caption: str(d['ValueDescription']), element: d['ElementTypeCode'],
          x: d['PosXMm'], y: d['PosYMm'], w: d['WidthMm'], h: d['HeightMm'], fontPt: d['FontSizePt'], bold: !!d['IsBold'], sort: d['SortOrder'],
        }))
        .sort((a, b) => a.sort - b.sort),
    }));
  }

  /** ردیابی: direction 1 = رو به عقب (چه موادی مصرف شد)، 2 = رو به جلو (کجا مصرف شد) */
  trace(batch: string, direction: 1 | 2, companyId = DEMO_COMPANY_ID): Observable<TraceRow[]> {
    return this.http.get<Api[]>(`${API_BASE_URL}/api/pc07/trace`, { params: { companyId, batch, direction } }).pipe(
      map((rows) =>
        rows.map((r) => ({
          level: r['Lvl'], linkId: r['LinkId'], parentBatch: r['ParentBatchNumber'], parentProduct: r['ParentProductTitle'], parentWo: str(r['ParentWorkOrderNumber']),
          childBatch: r['ChildBatchNumber'], childProduct: r['ChildProductTitle'], childWo: str(r['ChildWorkOrderNumber']), childUnit: str(r['ChildUnitTitle']),
          quantity: r['Quantity'] ?? 0, estimated: !!r['IsQuantityEstimated'], relation: r['RelationTypeCode'], opSeq: r['OperationSequence'], inventory: str(r['CurrentInventory']),
        }))
      )
    );
  }

  serial(serial: string, companyId = DEMO_COMPANY_ID): Observable<SerialInfo | null> {
    return this.http.get<{ serial: Api | null; children: Api[] }>(`${API_BASE_URL}/api/pc07/serial`, { params: { companyId, serial } }).pipe(
      map((b) =>
        b.serial
          ? {
              serial: b.serial['Serial'], level: b.serial['LevelCode'], status: b.serial['StatusCode'], batch: b.serial['BatchNumber'], assignedAt: b.serial['AssignedAt'],
              note: str(b.serial['Description']), product: b.serial['ProductTitle'], wo: str(b.serial['WorkOrderNumber']), opSeq: b.serial['OperationSequence'],
              parent: b.serial['ParentSerial'], parentStatus: b.serial['ParentStatusCode'], childCount: b.serial['ChildCount'] ?? 0,
              children: (b.children ?? []).map((c) => ({ serial: c['Serial'], level: c['LevelCode'], status: c['StatusCode'] })),
            }
          : null
      )
    );
  }
}
