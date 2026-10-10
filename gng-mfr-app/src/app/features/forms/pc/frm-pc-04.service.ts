import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { Pc04Bundle } from './frm-pc-04.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Api = Record<string, any>;

/** FRM-PC-04 روی mes.GetProductionReports* (/api/pc04/bundle) — فقط‌خواندنی */
@Injectable({ providedIn: 'root' })
export class FrmPc04Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Pc04Bundle> {
    return this.http.get<Record<string, Api[]>>(`${API_BASE_URL}/api/pc04/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        orders: (b['orders'] ?? []).map((o) => ({
          id: o['WorkOrderId'],
          number: o['Number'],
          name: o['Name'] ?? '',
          typeCode: o['WOTypeCode'],
          statusCode: o['StatusCode'],
          product: o['ProductTitle'] ?? '',
          unit: o['UnitTitle'] ?? '',
          quantity: o['Quantity'] ?? 0,
          line: o['LineTitle'] ?? '',
          shift: o['ShiftTitle'] ?? '',
          plannedComplete: o['PlannedCompleteDate'],
          due: o['DueDate'],
          refNumber: o['RefWorkOrderNumber'] ?? '',
          customer: o['CustomerTitle'] ?? '',
          currentOp: o['CurrentOperation'] ?? '',
          wastedTotal: o['WastedTotal'] ?? 0,
          opCount: o['OperationCount'] ?? 0,
          opsDone: o['OperationsDone'] ?? 0,
        })),
        operations: (b['operations'] ?? []).map((o) => ({
          woId: o['WorkOrderId'],
          id: o['WOOperationId'],
          seq: o['Sequence'],
          title: o['OperationTitle'] ?? '',
          statusCode: o['StatusCode'],
          resource: o['ResourceTitle'] ?? '',
          toComplete: o['ToCompleteQuantity'] ?? 0,
          received: o['ReceivedQuantity'] ?? 0,
          completed: o['CompletedQuantity'] ?? 0,
          wasted: o['WastedQuantity'] ?? 0,
          rework: o['ReworkQuantity'] ?? 0,
          start: o['StartTime'],
          end: o['EndTime'],
          planStart: o['PlanStartTime'],
          planEnd: o['PlanEndTime'],
          stdMinutes: o['StdMinutes'],
        })),
        reports: (b['reports'] ?? []).map((r) => ({
          woId: r['WorkOrderId'],
          woNumber: r['WorkOrderNumber'],
          opId: r['WOOperationId'],
          seq: r['Sequence'],
          opTitle: r['OperationTitle'] ?? '',
          outputId: r['OutputId'],
          number: r['ReportNumber'] ?? '',
          start: r['StartTime'],
          end: r['EndTime'],
          duration: r['Duration'] ?? 0,
          persons: r['TotalPersonnelQuantity'] ?? 0,
          completed: r['CompletedQuantity'] ?? 0,
          wasted: r['WastedQuantity'] ?? 0,
          rework: r['ReworkQuantity'] ?? 0,
          transferred: r['TransferredQuantity'] ?? 0,
          yieldPct: r['ActualYieldPercent'],
          sourceCode: r['SourceCode'] ?? 1,
          by: r['ReportedByTitle'] ?? '',
          description: r['Description'] ?? '',
          shiftCode: r['ShiftCode'] ?? '',
          unit: r['UnitTitle'] ?? '',
        })),
        labor: (b['labor'] ?? []).map((l) => ({
          outputId: l['OutputId'],
          woId: l['WorkOrderId'],
          code: l['PersonnelCode'] ?? '',
          name: l['PersonnelTitle'] ?? '',
          duration: l['TotalDuration'] ?? 0,
          completed: l['TotalCompleted'] ?? 0,
          wasted: l['TotalWasted'] ?? 0,
          share: l['SharePercent'] ?? 100,
          activity: l['ActivityDescription'] ?? '',
        })),
        waste: (b['waste'] ?? []).map((w) => ({
          outputId: w['OutputId'],
          woId: w['WorkOrderId'],
          seq: w['Sequence'],
          qty: w['WastedQuantity'] ?? 0,
          typeCode: w['WasteTypeCode'] ?? 2,
          isSetup: !!w['IsSetupWaste'],
          reasonCode: w['ReasonCode'] ?? '',
          reason: w['ReasonTitle'] ?? 'بدون علت',
          parent: w['ReasonParentTitle'] ?? '',
          description: w['Description'] ?? '',
        })),
        rework: (b['rework'] ?? []).map((r) => ({
          outputId: r['OutputId'],
          woId: r['WorkOrderId'],
          seq: r['Sequence'],
          toRepair: r['ToRepairQuantity'] ?? 0,
          repaired: r['RepairedQuantity'] ?? 0,
          remained: r['RemainedQuantity'] ?? 0,
          reason: r['ReasonTitle'] ?? '',
          description: r['Description'] ?? '',
        })),
        capacity: (b['capacity'] ?? []).map((c) => ({
          outputId: c['OutputId'],
          woId: c['WorkOrderId'],
          seq: c['Sequence'],
          title: c['CapacityTitle'] ?? '',
          unit: c['UnitTitle'] ?? '',
          qty: c['Quantity'] ?? 0,
          std: c['StdQuantity'],
          sourceCode: c['SourceCode'] ?? 1,
          description: c['Description'] ?? '',
        })),
        shifts: (b['shifts'] ?? []).map((s) => ({
          id: s['ShiftReportId'],
          date: s['ShiftDate'],
          title: s['ShiftTitle'] ?? '',
          from: s['FromTime'] ?? 0,
          to: s['ToTime'] ?? 0,
          line: s['LineTitle'] ?? '',
          supervisor: s['SupervisorTitle'] ?? '',
          next: s['NextSupervisorTitle'] ?? '',
          handover: s['HandoverTime'],
          statusCode: s['StatusCode'],
          summary: s['Summary'] ?? '',
          equipment: s['EquipmentNotes'] ?? '',
          issues: s['OpenIssues'] ?? '',
        })),
        wip: (b['wip'] ?? []).map((w) => ({
          shiftId: w['ShiftReportId'],
          woNumber: w['WorkOrderNumber'],
          opTitle: w['OperationTitle'] ?? '',
          qty: w['WipQuantity'] ?? 0,
          unit: w['UnitTitle'] ?? '',
          description: w['Description'] ?? '',
        })),
      }))
    );
  }
}
