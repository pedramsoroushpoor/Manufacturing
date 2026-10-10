import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { EvKind, Pc13Bundle } from './frm-pc-13.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const nn = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
/** زمان ISO ← میلی‌ثانیه (زمان محلی سناریو با برچسب Z) */
const ts = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
};
const list = (v: unknown): string[] => s(v).split(/[،,]/).map((x) => x.trim()).filter((x) => !!x);

/**
 * FRM-PC-13 روی mes.GetBi* (یک فراخوانی؛ فقط‌خواندنی). همه‌ی تاریخ‌ها به میلی‌ثانیه تبدیل می‌شوند و
 * رویدادها مرتب‌شده برمی‌گردند تا موتور محاسبه (pc13/pc13-engine.ts) فقط یک‌بار شاخص بسازد.
 */
@Injectable({ providedIn: 'root' })
export class FrmPc13Service {
  constructor(private http: HttpClient) {}

  bundle(from: string, to: string, companyId = DEMO_COMPANY_ID): Observable<Pc13Bundle> {
    return this.http.get<Record<string, any>>(`${API_BASE_URL}/api/pc13/bundle`, { params: { companyId, from, to } }).pipe(
      map((b) => {
        const rows = (k: string): Row[] => (Array.isArray(b[k]) ? (b[k] as Row[]) : []);
        return {
          from: s(b['from']) || from,
          to: s(b['to']) || to,
          facts: rows('facts').map((r) => ({
            id: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), title: s(r['WorkOrderTitle']), type: n(r['WOTypeCode']), status: n(r['WorkOrderStatusCode']),
            priority: n(r['PriorityCode']), lineId: n(r['LineId']), line: s(r['LineTitle']), productCode: s(r['ProductCode']), product: s(r['ProductTitle']),
            unit: s(r['UnitTitle']), qty: n(r['Quantity']), batch: s(r['BatchNumber']), customer: s(r['CustomerTitle']), refId: nn(r['RefWorkOrderId']),
            refWo: s(r['RefWorkOrderNumber']), planRelease: ts(r['PlannedReleaseDate']), planComplete: ts(r['PlannedCompleteDate']), due: ts(r['DueDate']),
            actRelease: ts(r['ActualReleaseDate']), actComplete: ts(r['ActualCompleteDate']), closeDate: ts(r['CloseDate']), version: s(r['VersionCode']),
            opsTotal: n(r['OpsTotal']), opsDone: n(r['OpsDone']), opsRunning: n(r['OpsRunning']), opsPaused: n(r['OpsPaused']), opsOutsourced: n(r['OpsOutsourced']),
            firstStart: ts(r['FirstStart']), lastEnd: ts(r['LastEnd']), stdMin: n(r['StdMinutes']), lastSeq: nn(r['LastSequence']), good: n(r['GoodOutput']),
            wasted: n(r['WastedTotal']), rework: n(r['ReworkTotal']), stopMin: n(r['StopMinutes']), openStops: n(r['OpenStops']), stopCount: n(r['StopCount']),
            received: n(r['Received']), qcPending: n(r['QcPending']), rejected: n(r['Rejected']), ncCost: n(r['NcCost']), ncPending: n(r['NcPending']),
            ncCases: n(r['NcCases']), reports: n(r['Reports']), lastReportAt: ts(r['LastReportAt']), requests: list(r['Requests']), contractor: s(r['ContractorTitle']),
            contractorReady: ts(r['ContractorReadyDate']), forecastEnd: ts(r['ForecastEnd']), forecastDelay: n(r['ForecastDelayMinutes']), deviations: n(r['Deviations']),
          })),
          events: rows('events')
            .map((r, i) => ({
              i, t: ts(r['At']) ?? 0, kind: s(r['Kind']) as EvKind, sev: n(r['Severity']), woId: nn(r['WorkOrderId']), wo: s(r['WorkOrderNumber']),
              lineId: nn(r['LineId']), line: s(r['LineTitle']), seq: nn(r['OperationSequence']), title: s(r['Title']), detail: s(r['Detail']),
              qty: nn(r['Quantity']), min: nn(r['Minutes']), ref: s(r['Ref']),
            }))
            .filter((e) => e.t > 0)
            .sort((a, c) => a.t - c.t || a.i - c.i),
          daily: rows('daily').map((r) => ({
            t: ts(r['Day']) ?? 0, lineId: n(r['LineId']), line: s(r['LineTitle']), reports: n(r['Reports']), orders: n(r['Orders']), completed: n(r['Completed']),
            wasted: n(r['Wasted']), run: n(r['RunMinutes']), stops: n(r['Stops']), stopMin: n(r['StopMinutes']), ncCost: n(r['NcCost']),
          })),
          alerts: rows('alerts').map((r) => ({
            key: s(r['AlertKey']), ruleType: n(r['RuleTypeCode']), ruleCode: s(r['RuleCode']), ruleTitle: s(r['RuleTitle']), severity: n(r['SeverityCode']),
            owner: s(r['OwnerTitle']), escMin: n(r['EscalationMinutes']), escOwner: s(r['EscalationOwnerTitle']), woId: nn(r['WorkOrderId']), wo: s(r['WorkOrderNumber']),
            opSeq: nn(r['OperationSequence']), line: s(r['LineTitle']), raisedAt: ts(r['RaisedAt']) ?? 0, measured: nn(r['Measured']), limit: nn(r['Limit']),
            unit: s(r['ThresholdUnitTitle']), subject: s(r['Subject']), detail: s(r['Detail']), status: n(r['StatusCode']) || 1, ageMin: n(r['AgeMinutes']),
            escalated: !!r['IsEscalated'],
          })),
          deviations: rows('deviations').map((r) => ({
            id: n(r['DeviationId']), woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), opSeq: nn(r['OperationSequence']), causeCode: s(r['CauseCode']),
            cause: s(r['CauseTitle']), causeParent: s(r['CauseParentTitle']), typeCode: n(r['DeviationTypeCode']), planned: s(r['PlannedValue']), actual: s(r['ActualValue']),
            recordedAt: ts(r['RecordedAt']) ?? 0, recordedBy: s(r['RecordedByTitle']), caTitle: s(r['CorrectiveActionTitle']), caOwner: s(r['CorrectiveActionOwnerTitle']),
            caDue: ts(r['CorrectiveActionDueDate']), caStatus: nn(r['CorrectiveActionStatusCode']), caRef: s(r['CorrectiveActionRef']), description: s(r['Description']),
          })),
          copq: rows('copq').map((r) => ({
            line: s(r['LineTitle']), ncType: n(r['NonconformityTypeCode']), reason: s(r['ReasonTitle']), reasonCode: s(r['ReasonCode']), wo: s(r['WorkOrderNumber']),
            decidedAt: ts(r['DecidedDate']), source: n(r['SourceTypeCode']), cases: n(r['Cases']), cost: n(r['Cost']), recovered: n(r['Recovered']), penalty: n(r['Penalty']),
          })),
          variance: rows('variance').map((r) => ({
            woId: n(r['WorkOrderId']), opSeq: n(r['OperationSequence']), product: s(r['ProductTitle']), unit: s(r['UnitTitle']), standard: n(r['StandardForProduced']),
            actual: n(r['Actual']), min: nn(r['MinConsumptionPercent']), max: nn(r['MaxConsumptionPercent']), activeIngredient: !!r['IsActiveIngredient'],
            customerMaterial: !!r['IsCustomerMaterial'],
          })),
          dispositions: rows('dispositions').map((r) => ({
            id: n(r['DispositionId']), number: s(r['Number']), source: n(r['SourceTypeCode']), woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']),
            opSeq: nn(r['OperationSequence']), opTitle: s(r['OperationTitle']), reportedAt: ts(r['ReportedAt']), product: s(r['ProductTitle']), unit: s(r['UnitTitle']),
            qty: n(r['Quantity']), ncType: n(r['NonconformityTypeCode']), reason: s(r['WasteReasonTitle']) || s(r['ReworkReasonTitle']), decision: n(r['DecisionStatusCode']),
            decidedAt: ts(r['DecidedAt']), targetWo: s(r['TargetWorkOrderNumber']), contractor: s(r['ContractorTitle']), penalty: n(r['PenaltyAmount']),
            cost: n(r['CostAmount']), recovered: n(r['RecoveredValue']), description: s(r['Description']), customerOwned: !!r['IsCustomerOwned'],
          })),
          requests: rows('requests').map((r) => ({
            id: n(r['RequestId']), number: s(r['Number']), date: ts(r['RequestDate']), origin: n(r['OriginCode']), priority: n(r['PriorityCode']),
            product: s(r['ProductTitle']), unit: s(r['UnitTitle']), qty: n(r['Quantity']), need: ts(r['NeedDate']), requester: s(r['RequesterTitle']),
            customer: s(r['CustomerTitle']), status: n(r['StatusCode']), description: s(r['Description']), ordered: n(r['OrderedQuantity']),
          })),
          materials: rows('materials').map((r) => ({
            woId: n(r['WorkOrderId']), seq: nn(r['OperationSequence']), productCode: s(r['ProductCode']), product: s(r['ProductTitle']), unit: s(r['UnitTitle']),
            standard: n(r['StandardQuantity']), planKit: n(r['PlannedKitQuantity']), actualKit: nn(r['ActualKitQuantity']), consumed: nn(r['ConsumedQuantity']),
            returned: nn(r['ReturnedQuantity']), excess: nn(r['ExcessQuantity']), shortage: nn(r['ShortageQuantity']), status: n(r['StatusCode']),
            customer: !!r['IsCustomerMaterial'], available: nn(r['StockAvailable']), reserved: nn(r['StockReserved']), inTransit: nn(r['StockInTransit']),
            nextArrival: ts(r['NextArrival']),
          })),
          operations: rows('operations').map((r) => ({
            woId: n(r['WorkOrderId']), seq: n(r['Sequence']), title: s(r['OperationTitle']), status: n(r['StatusCode']), outsourced: !!r['IsOutsourced'],
            resource: s(r['ResourceTitle']), toComplete: n(r['ToCompleteQuantity']), completed: n(r['CompletedQuantity']), wasted: n(r['WastedQuantity']),
            start: ts(r['StartTime']), end: ts(r['EndTime']), planStart: ts(r['PlanStartTime']), planEnd: ts(r['PlanEndTime']), std: n(r['StdMinutes']),
          })),
          reconReports: rows('reconReports').map((r) => ({
            woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), seq: n(r['OperationSequence']), report: s(r['ReportNumber']), reportedAt: ts(r['ReportedAt']),
            product: s(r['ProductTitle']), unit: s(r['UnitTitle']), reported: n(r['Reported']), received: n(r['Received']), pending: n(r['QcPending']),
            difference: n(r['Difference']), ageHours: n(r['AgeHours']), exception: n(r['ExceptionCode']),
          })),
          reconOutputs: rows('reconOutputs').map((r) => ({
            woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), outputType: n(r['OutputTypeCode']), product: s(r['ProductTitle']), unit: s(r['UnitTitle']),
            expected: n(r['Expected']), received: n(r['Received']), exception: n(r['ExceptionCode']),
          })),
          subcontract: rows('subcontract').map((r) => ({
            woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), opSeq: n(r['OperationSequence']), opTitle: s(r['OperationTitle']), toComplete: n(r['ToCompleteQuantity']),
            contractor: s(r['ContractorTitle']), sentAt: ts(r['SentAt']), expectedReturn: ts(r['ExpectedReturnDate']), fee: n(r['FeePerUnit']), feeUnit: s(r['FeeUnitTitle']),
            leadDays: n(r['LeadTimeDays']), stage: n(r['StageCode']), progressAt: ts(r['ProgressAt']), progressCompleted: n(r['ProgressCompleted']),
            progressWasted: n(r['ProgressWasted']), expectedReady: ts(r['ExpectedReadyDate']), receivedGood: n(r['ReceivedGood']), accepted: n(r['Accepted']),
            receivedDefective: n(r['ReceivedDefective']), declaredWaste: n(r['DeclaredWaste']), lastReceipt: ts(r['LastReceipt']), feePayable: n(r['FeePayable']),
            delayDays: n(r['DelayDays']), overdue: !!r['IsOverdue'], nextTitle: s(r['NextOperationTitle']),
          })),
          readiness: rows('readiness').map((r) => ({
            woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), status: n(r['WorkOrderStatusCode']), product: s(r['ProductTitle']),
            completedAt: ts(r['ActualCompleteDate']), closedAt: ts(r['CloseDate']), opsOpen: n(r['OpsOpen']), consumptionMissing: n(r['ConsumptionMissing']),
            excessNotReturned: n(r['ExcessNotReturned']), pendingDispositions: n(r['PendingDispositions']), unexecutedDispositions: n(r['UnexecutedDispositions']),
            outputsNotReceived: n(r['OutputsNotReceived']), qcPending: n(r['QcPending']), canClose: !!r['CanClose'],
          })),
          closeEvents: rows('closeEvents').map((r) => ({
            id: n(r['EventId']), woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), type: n(r['EventTypeCode']), at: ts(r['EventAt']) ?? 0, by: s(r['ByTitle']),
            reason: s(r['Reason']), approval: nn(r['ApprovalStatusCode']), approver: s(r['ApproverTitle']), description: s(r['Description']),
          })),
        };
      })
    );
  }
}
