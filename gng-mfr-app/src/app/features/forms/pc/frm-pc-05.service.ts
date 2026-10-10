import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { OpWasteRow, Pc05Bundle } from './frm-pc-05.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Api = Record<string, any>;

/** FRM-PC-05 روی /api/pc05/bundle؛ ضایعات سطح عملیات از همان جدول PC-04 (/api/pc04/bundle) — فقط‌خواندنی */
@Injectable({ providedIn: 'root' })
export class FrmPc05Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Pc05Bundle> {
    return this.http.get<Record<string, Api[]>>(`${API_BASE_URL}/api/pc05/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        terminals: (b['terminals'] ?? []).map((t) => ({
          id: t['TerminalId'],
          number: t['Number'] ?? '',
          name: t['Name'] ?? '',
          line: t['LineTitle'] ?? '',
          workCenterId: t['WorkCenterId'],
          resourceGroupId: t['ResourceGroupId'],
          station: t['StationTitle'] ?? '',
          online: !!t['IsOnline'],
          lastSync: t['LastSyncAt'],
          pending: t['PendingRecords'] ?? 0,
          autoAccept: !!t['AutoAcceptDeviceData'],
          threshold: t['DeviationThresholdPercent'],
          description: t['Description'] ?? '',
        })),
        queue: (b['queue'] ?? []).map((q) => ({
          terminalId: q['TerminalId'],
          woId: q['WorkOrderId'],
          woNumber: q['WorkOrderNumber'] ?? '',
          priority: q['PriorityCode'] ?? 1,
          batch: q['BatchNumber'] ?? '',
          productCode: q['ProductCode'] ?? '',
          product: q['ProductTitle'] ?? '',
          unit: q['UnitTitle'] ?? '',
          opId: q['WOOperationId'],
          seq: q['Sequence'],
          opCode: q['OperationCode'] ?? '',
          opTitle: q['OperationTitle'] ?? '',
          operationId: q['OperationId'],
          statusCode: q['StatusCode'],
          toComplete: q['ToCompleteQuantity'] ?? 0,
          received: q['ReceivedQuantity'] ?? 0,
          completed: q['CompletedQuantity'] ?? 0,
          wasted: q['WastedQuantity'] ?? 0,
          start: q['StartTime'],
          planStart: q['PlanStartTime'],
          planEnd: q['PlanEndTime'],
          description: q['Description'] ?? '',
          stdPerUnit: q['StdMinutesPerUnit'],
        })),
        stoppages: (b['stoppages'] ?? []).map((s) => ({
          opId: s['WOOperationId'],
          woId: s['WorkOrderId'],
          code: s['ProblemCode'] ?? '',
          title: s['ProblemTitle'] ?? '',
          group: s['GroupTitle'] ?? '',
          typeCode: s['ProblemTypeCode'] ?? 2,
          oeeLossCode: s['OeeLossCode'],
          oeeLoss: s['OeeLossTitle'] ?? '',
          oeeComponent: s['OeeComponentCode'],
          excluded: !!s['IsExcludedFromOee'],
          start: s['StartTime'],
          end: s['EndTime'],
          minutes: s['Minutes'] ?? 0,
          active: !!s['IsActive'],
          description: s['ProblemDescription'] ?? '',
          by: s['ReportedByTitle'] ?? '',
          sourceCode: s['SourceCode'] ?? 2,
          equipment: s['EquipmentTitle'] ?? '',
        })),
        readings: (b['readings'] ?? []).map((r) => ({
          opId: r['WOOperationId'],
          paramId: r['ParameterId'],
          title: r['ParameterTitle'] ?? '',
          unit: r['UnitTitle'] ?? '',
          target: r['TargetValue'],
          min: r['MinValue'],
          max: r['MaxValue'],
          critical: !!r['IsCritical'],
          actionCode: r['OutOfRangeActionCode'] ?? 1,
          at: r['ReadAt'],
          value: r['Value'],
          sourceCode: r['SourceCode'] ?? 1,
          out: !!r['IsOutOfRange'],
          comment: r['Comment'] ?? '',
        })),
        checklist: (b['checklist'] ?? []).map((c) => ({
          opId: c['WOOperationId'],
          seq: c['Sequence'],
          isControl: !!c['IsControlCheck'],
          description: c['Description'] ?? '',
          done: !!c['IsDone'],
          doneAt: c['DoneAt'],
          doneBy: c['DoneByTitle'] ?? '',
          doc: c['DocumentNumber'] ?? '',
          instruction: c['InstructionTitle'] ?? '',
          rev: c['RevisionNo'],
          mediaCode: c['MediaTypeCode'],
          file: c['FileName'] ?? '',
          instructionText: c['InstructionDescription'] ?? '',
          tools: c['NeededTools'] ?? '',
          uniforms: c['NeededUniforms'] ?? '',
        })),
        device: (b['device'] ?? []).map((d) => ({
          id: d['DataId'],
          plc: d['PlcTitle'] ?? d['PlcCode'] ?? '',
          tag: d['PLCItemTag'] ?? '',
          typeCode: d['PLCItemTypeCode'] ?? 1,
          item: d['ItemTitle'] ?? '',
          equipment: d['EquipmentTitle'] ?? '',
          woId: d['WorkOrderId'],
          woNumber: d['RefMainNumber'] ?? '',
          refNumber: d['RefRelatedNumber'] ?? '',
          result: d['Result'] ?? 0,
          userValue: d['UserValue'],
          from: d['ReadStartDateTime'],
          to: d['ReadEndDateTime'],
          applied: !!d['IsApplied'],
          note: d['DeviationNote'] ?? '',
          deviation: d['DeviationPercent'],
        })),
      }))
    );
  }

  /** ضایعات سطح عملیات با علت درختی و تفکیک راه‌اندازی/فرایند (از PC-04) */
  waste(companyId = DEMO_COMPANY_ID): Observable<OpWasteRow[]> {
    return this.http.get<Record<string, Api[]>>(`${API_BASE_URL}/api/pc04/bundle`, { params: { companyId } }).pipe(
      map((b) =>
        (b['waste'] ?? []).map((w) => ({
          woId: w['WorkOrderId'],
          seq: w['Sequence'],
          qty: w['WastedQuantity'] ?? 0,
          isSetup: !!w['IsSetupWaste'],
          material: w['WasteTypeCode'] === 1,
          reason: `${w['ReasonCode'] ?? ''} ${w['ReasonTitle'] ?? ''}`.trim(),
          parent: w['ReasonParentTitle'] ?? '',
        }))
      )
    );
  }
}
