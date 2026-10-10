import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { Pc08Bundle } from './frm-pc-08.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Api = Record<string, any>;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** FRM-PC-08 روی mes.GetPc08Bundle (رسید ماده‌ی بازیابی، موازنه‌ها، استانداردها). */
@Injectable({ providedIn: 'root' })
export class FrmPc08Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Pc08Bundle> {
    return this.http.get<Record<string, Api[]>>(`${API_BASE_URL}/api/pc08/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        receipts: (b['receipts'] ?? []).map((r) => ({
          id: r['ReceiptId'], number: r['ReceiptNumber'], date: r['ReceiptDate'], woId: r['WorkOrderId'], wo: r['WorkOrderNumber'], woType: r['WOTypeCode'],
          opSeq: r['OperationSequence'], opTitle: str(r['OperationTitle']), report: str(r['ReportNumber']), recovered: r['RecoveredTitle'], unit: str(r['UnitTitle']),
          source: str(r['SourceTitle']), sourceInput: r['SourceInput'] ?? 0, qty: r['Recovered'] ?? 0, actual: r['ActualPercent'] ?? 0, standard: r['StandardPercent'] ?? 0,
          standardSource: str(r['StandardSource']), threshold: r['ThresholdPoints'] ?? 0, batch: str(r['NewBatchNumber']), cycle: r['RecoveryCycle'] ?? 0,
          purity: r['PurityPercent'], minPurity: r['MinPurityPercent'], maxCycles: r['MaxCycles'], qc: r['QcStatusCode'], inventory: str(r['InventoryTitle']),
          docPattern: str(r['ReceiptDocumentPatternTitle']), doc: str(r['DocumentNumber']), note: str(r['Description']),
        })),
        balances: (b['balances'] ?? []).map((r) => ({
          id: r['BalanceId'], type: r['BalanceTypeCode'], woId: r['WorkOrderId'], wo: r['WorkOrderNumber'], opSeq: r['OperationSequence'], opTitle: str(r['OperationTitle']),
          report: str(r['ReportNumber']), product: str(r['ProductTitle']), unit: str(r['UnitTitle']), from: r['PeriodFrom'], to: r['PeriodTo'], input: r['InputQuantity'] ?? 0,
          output: r['OutputQuantity'] ?? 0, loss: r['LossQuantity'] ?? 0, inProcess: r['InProcessQuantity'] ?? 0, gap: r['Gap'] ?? 0, gapPct: r['GapPercent'] ?? 0,
          tolerance: r['TolerancePercent'] ?? 0, source: r['SourceCode'], measuredBy: str(r['MeasuredByTitle']), note: str(r['Description']), posted: r['PostedInput'],
        })),
        standards: (b['standards'] ?? []).map((r) => ({
          code: r['RecoveredCode'], recovered: r['RecoveredTitle'], source: str(r['SourceTitle']), grade: str(r['GradeTitle']), standard: r['StandardRecoveryPercent'] ?? 0,
          loss: r['RecoveryLossPercent'] ?? 0, minPurity: r['MinPurityPercent'] ?? 0, maxCycles: r['MaxCycles'] ?? 0, equivalence: r['EquivalenceRatio'] ?? 1,
          requiresQc: !!r['RequiresQcApproval'], routingRate: r['RoutingRecoveryPercent'], routingLoss: r['RoutingLossPercent'], routingOp: str(r['RoutingOperationTitle']),
          inventory: str(r['ReceiptInventoryTitle']),
        })),
      }))
    );
  }
}
