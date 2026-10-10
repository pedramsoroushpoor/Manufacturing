import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { Me11Bundle } from './frm-me-11.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v));
const nn = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const ts = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
};
const kind = (v: unknown): 'S' | 'G' | null => (v === 'S' || v === 'G' ? v : null);

/**
 * FRM-ME-11 روی /api/me11/bundle (یک فراخوانی؛ فقط‌خواندنی): رویه‌های mes.GetBi* گام ME-11 به‌اضافه‌ی
 * mes.GetRoutingLinks، GetRoutingSubcontracts، GetContractors و GetSubcontractOrders.
 */
@Injectable({ providedIn: 'root' })
export class FrmMe11Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Me11Bundle> {
    return this.http.get<Record<string, any>>(`${API_BASE_URL}/api/me11/bundle`, { params: { companyId } }).pipe(
      map((b) => {
        const rows = (k: string): Row[] => (Array.isArray(b[k]) ? (b[k] as Row[]) : []);
        return {
          routings: rows('routings').map((r) => ({
            id: n(r['RoutingId']), code: s(r['Code']), version: s(r['VersionCode']), title: s(r['Title']), status: n(r['StatusCode']) || 1,
            ptype: n(r['ProductionTypeCode']) || 1, method: n(r['RoutingMethodCode']), batch: n(r['RoutingBatchSize']), lineId: nn(r['LineId']), line: s(r['LineTitle']),
            isTemplate: !!r['IsTemplate'], isToll: !!r['IsTollManufacturing'], customer: s(r['CustomerTitle']), rate: nn(r['RateQuantity']), rateBasis: nn(r['RateTimeBasisCode']),
            processWaste: nn(r['ProcessWastePercent']), productId: nn(r['ProductId']), productCode: s(r['ProductCode']), product: s(r['ProductTitle']), unit: s(r['UnitTitle']),
            structures: s(r['StructureCodes']), opCount: n(r['OperationCount']), activeVersions: n(r['ActiveVersions']), versions: s(r['Versions']),
            openWos: n(r['OpenWorkOrders']), wos: n(r['WorkOrders']), reports: n(r['Reports']),
          })),
          ops: rows('operations').map((r) => ({
            id: n(r['RoutingOperationId']), routingId: n(r['RoutingId']), seq: n(r['Sequence']), opId: n(r['OperationId']), opCode: s(r['OperationCode']),
            title: s(r['OperationTitle']), nature: n(r['NatureCode']), outsourced: !!r['IsOutsourcing'] || n(r['NatureCode']) === 5, alloc: nn(r['AllocationPercent']),
            yield: nn(r['YieldPercent']), resKind: kind(r['ResKind']), resId: nn(r['ResId']), resTitle: s(r['ResTitle']), resSource: n(r['ResSource']),
            resLineId: nn(r['ResLineId']), hasTiming: !!r['HasTiming'], timingBatch: nn(r['TimingBatch']), setup: n(r['SetupTimePerBatch']),
            eqRun: n(r['EquipmentRunTimePerPart']), labRun: n(r['LaborRunTimePerPart']), outRun: n(r['OutsourceTimePerPart']), teardown: n(r['TeardownTimePerBatch']),
            wait: n(r['WaitTimePerBatch']), waitOccupies: !!r['IsWaitOccupyingResource'], timingYield: nn(r['TimingYield']), transferBatch: nn(r['TransferBatchSize']),
            capCount: n(r['CapacityCount']), matCount: n(r['MaterialCount']), outCount: n(r['OutputCount']), attrCount: n(r['BatchAttributeCount']),
            actCount: n(r['ActivityCount']), actMin: n(r['ActivityMinutes']), vaMin: n(r['ValueAddedMinutes']), subCount: n(r['SubcontractCount']),
            qualifiedSubs: n(r['QualifiedContractors']), recCount: n(r['RecoveryCount']), altCount: n(r['AlternativeCount']),
          })),
          alts: rows('alternatives').map((r) => ({
            roId: n(r['RoutingOperationId']), routingId: n(r['RoutingId']), title: s(r['AlternativeTitle']), resKind: kind(r['ResKind']), resId: nn(r['ResId']),
            resTitle: s(r['ResTitle']), rule: n(r['SelectionRuleCode']), from: nn(r['FromQuantity']), to: nn(r['ToQuantity']), priority: n(r['Priority']),
          })),
          links: rows('links').map((r) => ({ routingId: n(r['RoutingId']), from: n(r['FromId']), to: n(r['ToId']), share: nn(r['SharePercent']), overlap: n(r['OverlapTypeCode']) })),
          defects: rows('defects').map((r, i) => ({
            key: `${s(r['RuleCode'])}-${i}`, rule: s(r['RuleCode']), cat: s(r['CategoryCode']), sev: n(r['Severity']), form: s(r['FormCode']),
            routingId: nn(r['RoutingId']), roId: nn(r['RoutingOperationId']), libOpId: nn(r['OperationId']), ref: s(r['EntityRef']), title: s(r['Title']), detail: s(r['Detail']),
          })),
          reports: rows('reports').map((r) => ({
            id: n(r['ReportId']), number: s(r['ReportNumber']), woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), woType: n(r['WOTypeCode']),
            woStatus: n(r['WorkOrderStatusCode']), wooId: n(r['WOOperationId']), roId: nn(r['RoutingOperationId']), routingId: nn(r['RoutingId']), seq: n(r['Sequence']),
            title: s(r['OperationTitle']), lineId: nn(r['LineId']), resource: s(r['ResourceTitle']), start: ts(r['StartTime']) ?? 0, end: ts(r['EndTime']) ?? 0,
            minutes: n(r['Minutes']), good: n(r['CompletedQuantity']), waste: n(r['WastedQuantity']), reprocess: !!r['IsReprocess'], source: n(r['SourceCode']),
            toComplete: n(r['ToCompleteQuantity']), first: !!r['IsFirstReport'], reportsInOp: n(r['ReportsInOperation']),
          })),
          usage: rows('usage').map((r) => ({
            wooId: n(r['WOOperationId']), roId: nn(r['RoutingOperationId']), capId: n(r['CapacityTypeId']), capCode: s(r['CapacityCode']), capTitle: s(r['CapacityTitle']),
            unit: s(r['UnitTitle']), produced: n(r['Produced']), actual: nn(r['Actual']), basis: nn(r['CalculationBasisCode']), fixed: nn(r['FixedQuantity']),
            variable: nn(r['VariableQuantity']), per: nn(r['PerQuantity']), steps: s(r['StepsText']),
          })),
          elig: rows('eligibility').map((r) => ({
            productId: n(r['ProductId']), lineId: n(r['LineId']), orderType: n(r['OrderTypeCode']), versionId: n(r['VersionId']), code: s(r['VersionCode']),
            title: s(r['VersionTitle']), priority: n(r['Priority']), min: nn(r['MinBatchSize']), max: nn(r['MaxBatchSize']), status: n(r['StatusCode']),
            eff: n(r['EffectivityTypeCode']), routingId: n(r['RoutingId']), routingCode: s(r['RoutingCode']), reject: s(r['RejectReason']),
          })),
          products: rows('products').map((r) => ({
            id: n(r['ProductId']), code: s(r['ProductCode']), title: s(r['ProductTitle']), unit: s(r['UnitTitle']), versions: n(r['VersionCount']),
            openReq: n(r['OpenRequestQuantity']), openWos: n(r['OpenWorkOrders']), hasStructure: !!r['HasStructure'],
          })),
          lines: rows('lines').map((r) => ({ id: n(r['LineId']), code: s(r['LineCode']), title: s(r['LineTitle']) })),
          resources: rows('resources').map((r) => {
            const k = kind(r['ResKind']) ?? 'S';
            return {
              key: `${k}${n(r['ResId'])}`, kind: k, id: n(r['ResId']), title: s(r['Title']), lineId: nn(r['LineId']), lineTitle: s(r['LineTitle']), active: !!r['IsActive'],
              bottleneckFlag: !!r['IsBottleneck'], dayMin: n(r['DayMinutes']), weekDays: n(r['WeekDays']), calendar: s(r['CalendarTitle']), groupId: nn(r['GroupId']),
              machines: nn(r['MachineCount']), avail: nn(r['EquipmentAvailPercent']), prod: nn(r['ProductivityPercent']), downtime: nn(r['StandardDowntime']),
              labor: nn(r['LaborCount']), capSource: n(r['CapacitySource']),
            };
          }),
          demand: rows('demand').map((r) => ({
            source: s(r['SourceCode']) === 'WO' ? ('WO' as const) : ('REQ' as const), number: s(r['Number']), productId: n(r['ProductId']), remaining: n(r['Remaining']),
            need: ts(r['NeedDate']), lineId: nn(r['LineId']), routingId: nn(r['RoutingId']), versionId: nn(r['VersionId']), priority: n(r['PriorityCode']),
            orderType: n(r['OrderTypeCode']) || 1,
          })),
          subcontracts: rows('subcontracts').map((r) => ({
            roId: n(r['RoutingOperationId']), contractorId: n(r['ContractorId']), contractor: s(r['ContractorTitle']), contractorActive: !!r['ContractorIsActive'],
            qual: n(r['QualificationStatusCode']), contractTo: ts(r['ContractToDate']), capOp: s(r['CapabilityOperation']), priority: n(r['Priority']),
            rule: n(r['SelectionRuleCode']), fee: nn(r['FeePerUnit']), feeUnit: s(r['FeeUnitTitle']), lead: nn(r['LeadTimeDays']), wastePct: nn(r['AllowedWastePercent']),
            service: s(r['ServiceItemTitle']), isActive: !!r['IsActive'], hasCap: !!r['HasCapability'], regFee: nn(r['RegisteredFee']),
          })),
          contractors: rows('contractors').map((r) => ({
            id: n(r['ContractorId']), code: s(r['Code']), title: s(r['Title']), daysLeft: nn(r['ContractDaysLeft']), qual: n(r['QualificationStatusCode']),
            active: !!r['IsActive'], caps: n(r['CapabilityCount']), expiredQual: n(r['ExpiredQualificationCount']),
          })),
          subOrders: rows('subOrders').map((r) => ({
            woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), product: s(r['ProductTitle']), opTitle: s(r['OperationTitle']), contractorId: nn(r['ContractorId']),
            contractor: s(r['ContractorTitle']), toComplete: n(r['ToCompleteQuantity']), sentAt: ts(r['SentAt']), expectedReturn: ts(r['ExpectedReturnDate']),
            expectedReady: ts(r['ExpectedReadyDate']), delayDays: n(r['DelayDays']), overdue: !!r['IsOverdue'], progressCompleted: n(r['ProgressCompleted']),
            progressWasted: n(r['ProgressWasted']), receivedGood: n(r['ReceivedGood']), defective: n(r['ReceivedDefective']), declaredWaste: n(r['DeclaredWaste']),
            fee: nn(r['FeePerUnit']), lead: nn(r['LeadTimeDays']),
          })),
        };
      })
    );
  }
}
