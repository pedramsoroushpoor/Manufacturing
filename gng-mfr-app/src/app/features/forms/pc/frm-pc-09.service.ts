import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { Pc09Bundle } from './frm-pc-09.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Api = Record<string, any>;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** FRM-PC-09 روی mes.GetPc09Bundle (تعیین تکلیف، دستورهای دوباره‌کاری/بازیافت، زنجیره، COPQ). */
@Injectable({ providedIn: 'root' })
export class FrmPc09Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Pc09Bundle> {
    return this.http.get<Record<string, Api[]>>(`${API_BASE_URL}/api/pc09/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        dispositions: (b['dispositions'] ?? []).map((r) => ({
          id: r['DispositionId'], number: r['Number'], sourceType: r['SourceTypeCode'], woId: r['WorkOrderId'], wo: str(r['WorkOrderNumber']), woType: r['WOTypeCode'],
          line: str(r['LineTitle']), opSeq: r['OperationSequence'], opTitle: str(r['OperationTitle']), report: str(r['ReportNumber']), reportedAt: r['ReportedAt'],
          product: str(r['ProductTitle']), unit: str(r['UnitTitle']), batch: str(r['BatchNumber']), qty: r['Quantity'] ?? 0, ncType: r['NonconformityTypeCode'],
          wasteReason: str(r['WasteReasonTitle']), reworkReason: str(r['ReworkReasonTitle']), decision: r['DecisionStatusCode'], decidedBy: str(r['DecidedByTitle']),
          decidedAt: r['DecidedAt'], targetWo: str(r['TargetWorkOrderNumber']), targetStatus: r['TargetStatusCode'], regradeProduct: str(r['RegradeProductTitle']),
          contractor: str(r['ContractorTitle']), contractorDisposition: r['ContractorDispositionCode'], penalty: r['PenaltyAmount'] ?? 0, unitCost: r['UnitCost'] ?? 0,
          recoveredValue: r['RecoveredValue'] ?? 0, cost: r['CostAmount'] ?? 0, reworkCycle: r['ReworkCycle'], note: str(r['Description']), customer: str(r['CustomerTitle']),
          customerOwned: !!r['IsCustomerOwned'],
        })),
        orders: (b['orders'] ?? []).map((r) => ({
          woId: r['WorkOrderId'], number: r['Number'], woType: r['WOTypeCode'], status: r['WorkOrderStatusCode'], qty: r['Quantity'] ?? 0, batch: str(r['BatchNumber']),
          product: str(r['ProductTitle']), unit: str(r['UnitTitle']), sourceWoId: r['SourceWorkOrderId'], sourceWo: str(r['SourceNumber']), sourceBatch: str(r['SourceBatchNumber']),
          sourceStatus: r['SourceStatusCode'], note: str(r['Description']), recoveredCode: str(r['RecoveredCode']), minPurity: r['MinPurityPercent'], maxCycles: r['MaxCycles'],
          requiresQc: r['RequiresQcApproval'], maxMix: r['MaxMixPercent'],
        })),
        operations: (b['operations'] ?? []).map((r) => ({
          woId: r['WorkOrderId'], seq: r['Sequence'], title: r['OperationTitle'], kept: !!r['IsKept'], status: r['StatusCode'], sourceMaterials: r['SourceMaterialCount'] ?? 0,
          keptMaterials: r['KeptMaterialCount'] ?? 0,
        })),
        reports: (b['reports'] ?? []).map((r) => ({
          woId: r['WorkOrderId'], seq: r['Sequence'], number: r['ReportNumber'], start: r['StartTime'], end: r['EndTime'], reprocess: !!r['IsReprocess'],
          reworkQty: r['ReworkQuantity'] ?? 0, reworkOk: r['ReworkCompletedQuantity'] ?? 0, reworkWaste: r['ReworkWastedQuantity'] ?? 0, completed: r['CompletedQuantity'] ?? 0,
          wasted: r['WastedQuantity'] ?? 0, by: str(r['ReportedByTitle']), note: str(r['Description']),
        })),
        chains: (b['chains'] ?? []).map((r) => ({
          batch: r['BatchNumber'], product: str(r['ProductTitle']), cycle: r['ReworkCycle'] ?? 0, disposition: r['DispositionNumber'], qty: r['Quantity'] ?? 0,
          decision: r['DecisionStatusCode'], sourceWo: str(r['SourceWorkOrderNumber']), targetWo: str(r['TargetWorkOrderNumber']), decidedAt: r['DecidedAt'],
          maxCycles: r['MaxCycles'] ?? 0, limit: r['LimitStatus'] ?? 0, note: str(r['Description']),
        })),
        copq: (b['copq'] ?? []).map((r) => ({
          line: str(r['LineTitle']), ncType: r['NonconformityTypeCode'], reason: str(r['ReasonTitle']), reasonCode: str(r['ReasonCode']), wo: str(r['WorkOrderNumber']),
          date: r['DecidedDate'], sourceType: r['SourceTypeCode'], cases: r['Cases'] ?? 0, cost: r['Cost'] ?? 0, recovered: r['Recovered'] ?? 0, penalty: r['Penalty'] ?? 0,
        })),
        recovered: (b['recovered'] ?? []).map((r) => ({
          batch: r['BatchNumber'], product: str(r['ProductTitle']), code: str(r['RecoveredCode']), source: str(r['SourceTitle']), onHand: r['OnHandQuantity'] ?? 0,
          purity: r['PurityPercent'], minPurity: r['MinPurityPercent'], cycle: r['RecoveryCycle'], maxCycles: r['MaxCycles'], expire: r['ExpireDate'],
          requiresQc: !!r['RequiresQcApproval'], qc: r['QcStatusCode'], block: str(r['BlockReason']), maxMix: r['MaxMixPercent'],
        })),
      }))
    );
  }
}
