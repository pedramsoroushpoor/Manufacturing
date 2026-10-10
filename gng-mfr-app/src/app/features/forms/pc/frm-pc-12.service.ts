import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { CostingEvent, Pc12Bundle } from './frm-pc-12.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const nn = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** FRM-PC-12 روی mes.GetProductionConsole* و mes.GetWorkOrderCostingEvent (فقط‌خواندنی). */
@Injectable({ providedIn: 'root' })
export class FrmPc12Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Pc12Bundle> {
    return this.http.get<Record<string, Row[]>>(`${API_BASE_URL}/api/pc12/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        lines: (b['lines'] ?? []).map((r) => ({
          id: r['LineId'], code: s(r['LineCode']), title: s(r['LineTitle']), running: n(r['RunningOps']), paused: n(r['PausedOps']), openStops: n(r['OpenStops']),
          a: n(r['Availability']), p: n(r['Performance']), q: n(r['Quality']), oee: n(r['Oee']), planMin: n(r['PlanMinutes']), stopMin: n(r['StopMinutes']),
          shiftStart: r['ShiftStart'], asOf: r['AsOf'],
        })),
        stations: (b['stations'] ?? []).map((r) => ({
          key: s(r['StationKey']), lineId: n(r['LineId']), title: s(r['StationTitle']), code: s(r['StationCode']), seqNo: n(r['SequenceNo']), andon: n(r['AndonCode']) || 1,
          isGroup: s(r['StationKey']).startsWith('RG'), woId: nn(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), opSeq: nn(r['OperationSequence']), opTitle: s(r['OperationTitle']),
          toComplete: nn(r['ToCompleteQuantity']), completed: nn(r['CompletedQuantity']), wasted: nn(r['WastedQuantity']), start: r['StartTime'],
          stopTitle: s(r['OpenStopTitle']), stopSince: r['OpenStopSince'], runningCount: n(r['RunningCount']),
          runningOrders: s(r['RunningOrders']).split('،').map((x) => x.trim()).filter((x) => !!x), oee: nn(r['Oee']),
        })),
        orders: (b['orders'] ?? []).map((r) => ({
          id: r['WorkOrderId'], wo: s(r['WorkOrderNumber']), typeCode: n(r['WOTypeCode']), statusCode: n(r['WorkOrderStatusCode']), line: s(r['LineTitle']),
          product: s(r['ProductTitle']), unit: s(r['UnitTitle']), qty: n(r['Quantity']), planned: r['PlannedCompleteDate'], due: r['DueDate'], customer: s(r['CustomerTitle']),
          lastSeq: nn(r['LastSequence']), lastCompleted: nn(r['LastCompleted']), lastToComplete: nn(r['LastToComplete']), progress: nn(r['ProgressPercent']),
          opsDone: n(r['OpsDone']), opsTotal: n(r['OpsTotal']), forecastEnd: r['ForecastEnd'], delayMin: n(r['ForecastDelayMinutes']),
        })),
        stops: (b['stops'] ?? []).map((r) => ({
          id: r['ProblemId'], wo: s(r['WorkOrderNumber']), opSeq: n(r['OperationSequence']), opTitle: s(r['OperationTitle']), description: s(r['ProblemDescription']),
          start: r['StartTime'], openMin: n(r['OpenMinutes']), by: s(r['ReportedByTitle']), line: s(r['LineTitle']),
        })),
        alerts: (b['alerts'] ?? []).map((r) => ({
          key: s(r['AlertKey']), ruleType: n(r['RuleTypeCode']), ruleId: n(r['RuleId']), ruleCode: s(r['RuleCode']), ruleTitle: s(r['RuleTitle']), severity: n(r['SeverityCode']),
          channel: n(r['ChannelCode']), owner: s(r['OwnerTitle']), escMin: n(r['EscalationMinutes']), escOwner: s(r['EscalationOwnerTitle']), woId: nn(r['WorkOrderId']),
          wo: s(r['WorkOrderNumber']), opSeq: nn(r['OperationSequence']), line: s(r['LineTitle']), raisedAt: r['RaisedAt'], measured: nn(r['Measured']), limit: nn(r['Limit']),
          unit: s(r['ThresholdUnitTitle']), subject: s(r['Subject']), detail: s(r['Detail']), status: n(r['StatusCode']) || 1, ackAt: r['AcknowledgedAt'],
          ackBy: s(r['AcknowledgedByTitle']), assignedTo: s(r['AssignedToTitle']), note: s(r['Note']), ageMin: n(r['AgeMinutes']), escalated: !!r['IsEscalated'],
        })),
        rules: (b['rules'] ?? []).map((r) => ({
          id: r['RuleId'], number: s(r['Number']), name: s(r['Name']), type: n(r['RuleTypeCode']), threshold: nn(r['ThresholdValue']), unit: s(r['ThresholdUnitTitle']),
          severity: n(r['SeverityCode']), channel: n(r['ChannelCode']), owner: s(r['OwnerTitle']), escMin: n(r['EscalationMinutes']), escOwner: s(r['EscalationOwnerTitle']),
          active: !!r['IsActive'], description: s(r['Description']),
        })),
        deviations: (b['deviations'] ?? []).map((r) => ({
          id: r['DeviationId'], woId: r['WorkOrderId'], wo: s(r['WorkOrderNumber']), opSeq: nn(r['OperationSequence']), causeId: n(r['CauseId']), causeCode: s(r['CauseCode']),
          cause: s(r['CauseTitle']), causeParent: s(r['CauseParentTitle']), typeCode: n(r['DeviationTypeCode']), planned: s(r['PlannedValue']), actual: s(r['ActualValue']),
          recordedAt: r['RecordedAt'], recordedBy: s(r['RecordedByTitle']), caTitle: s(r['CorrectiveActionTitle']), caOwner: s(r['CorrectiveActionOwnerTitle']),
          caDue: r['CorrectiveActionDueDate'], caStatus: nn(r['CorrectiveActionStatusCode']), caRef: s(r['CorrectiveActionRef']), description: s(r['Description']),
        })),
        causes: (b['causes'] ?? []).map((r) => ({
          id: r['CauseId'], number: s(r['Number']), name: s(r['Name']), parentId: nn(r['ParentId']), typeCode: n(r['DeviationTypeCode']), sort: n(r['SortOrder']), usage: n(r['UsageCount']),
        })),
        wip: (b['wip'] ?? []).map((r) => ({
          woId: r['WorkOrderId'], wo: s(r['WorkOrderNumber']), typeCode: n(r['WOTypeCode']), line: s(r['LineTitle']), lineId: n(r['LineId']), seq: n(r['Sequence']),
          opTitle: s(r['OperationTitle']), statusCode: n(r['StatusCode']), outsourced: !!r['IsOutsourced'], unit: s(r['UnitTitle']), toComplete: n(r['ToCompleteQuantity']),
          received: n(r['Received']), completed: n(r['CompletedQuantity']), wasted: n(r['WastedQuantity']), rework: n(r['ReworkQuantity']), inProcess: n(r['InProcess']),
          inProcessPct: n(r['InProcessPercent']), stageFraction: n(r['StageFraction']),
        })),
        readiness: (b['readiness'] ?? []).map((r) => ({
          woId: r['WorkOrderId'], wo: s(r['WorkOrderNumber']), typeCode: n(r['WOTypeCode']), statusCode: n(r['WorkOrderStatusCode']), product: s(r['ProductTitle']),
          batch: s(r['BatchNumber']), completedAt: r['ActualCompleteDate'], closedAt: r['CloseDate'], opsOpen: n(r['OpsOpen']), consumptionMissing: n(r['ConsumptionMissing']),
          excessNotReturned: n(r['ExcessNotReturned']), pendingDispositions: n(r['PendingDispositions']), unexecutedDispositions: n(r['UnexecutedDispositions']),
          outputsNotReceived: n(r['OutputsNotReceived']), qcPending: n(r['QcPending']), suspendedDays: nn(r['SuspendedDays']), autoCloseDays: nn(r['AutoCloseDays']),
          canClose: !!r['CanClose'], autoCloseCandidate: !!r['IsAutoCloseCandidate'],
        })),
        events: (b['events'] ?? []).map((r) => ({
          id: r['EventId'], woId: r['WorkOrderId'], wo: s(r['WorkOrderNumber']), typeCode: n(r['EventTypeCode']), at: r['EventAt'], by: s(r['ByTitle']), reason: s(r['Reason']),
          approvalCode: nn(r['ApprovalStatusCode']), approver: s(r['ApproverTitle']), costingNumber: s(r['CostingEventNumber']), costingStatus: nn(r['CostingStatusCode']),
          description: s(r['Description']),
        })).sort((x, y) => s(y.at).localeCompare(s(x.at))),
      }))
    );
  }

  costing(workOrderId: number, companyId = DEMO_COMPANY_ID): Observable<CostingEvent> {
    return this.http.get<Record<string, any>>(`${API_BASE_URL}/api/pc12/costing`, { params: { companyId, workOrderId } }).pipe(
      map((b) => {
        const h: Row | null = b['header'] ?? null;
        return {
          raw: b,
          header: h
            ? {
                woId: h['WorkOrderId'], wo: s(h['WorkOrderNumber']), typeCode: n(h['WOTypeCode']), statusCode: n(h['WorkOrderStatusCode']), productCode: s(h['ProductCode']),
                product: s(h['ProductTitle']), unit: s(h['UnitTitle']), plannedQty: n(h['PlannedQuantity']), batch: s(h['BatchNumber']), version: s(h['ManufacturingVersion']),
                lineCode: s(h['LineCode']), releasedAt: h['ActualReleaseDate'], completedAt: h['ActualCompleteDate'], closedAt: h['CloseDate'], customer: s(h['CustomerTitle']),
                refWoId: nn(h['RefWorkOrderId']), wastedTotal: n(h['WastedTotal']), ncCost: n(h['NonconformanceCost']),
              }
            : null,
          materials: ((b['materials'] ?? []) as Row[]).map((r) => ({
            code: s(r['ProductCode']), title: s(r['ProductTitle']), unit: s(r['UnitTitle']), customer: !!r['IsCustomerMaterial'], standard: n(r['StandardQuantity']),
            actual: n(r['ActualQuantity']), returned: n(r['ReturnedQuantity']),
          })),
          resources: ((b['resources'] ?? []) as Row[]).map((r) => ({ code: s(r['CapacityCode']), title: s(r['CapacityTitle']), unit: s(r['UnitTitle']), quantity: n(r['Quantity']) })),
          outputs: ((b['outputs'] ?? []) as Row[]).map((r) => ({
            typeCode: n(r['OutputTypeCode']), code: s(r['ProductCode']), title: s(r['ProductTitle']), unit: s(r['UnitTitle']), batch: s(r['BatchNumber']),
            received: n(r['Received']), rejected: n(r['Rejected']), share: nn(r['CostSharePercent']), rate: nn(r['ValuationRate']),
          })),
        };
      })
    );
  }
}
