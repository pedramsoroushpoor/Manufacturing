import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { Pc06Bundle, WoHead, WoMaterialRow, dedupeBatch } from './frm-pc-06.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Api = Record<string, any>;

/** FRM-PC-06 روی /api/pc06/bundle؛ مواد دستور (q.s.) از /api/pc02/bundle — فقط‌خواندنی */
@Injectable({ providedIn: 'root' })
export class FrmPc06Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Pc06Bundle> {
    return this.http.get<Record<string, Api[]>>(`${API_BASE_URL}/api/pc06/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        consumption: (b['consumption'] ?? []).map((c) => ({
          woId: c['WorkOrderId'],
          id: c['ConsumptionId'],
          seq: c['OperationSequence'],
          opTitle: c['OperationTitle'] ?? '',
          productId: c['ProductId'],
          productCode: c['ProductCode'] ?? '',
          product: c['ProductTitle'] ?? '',
          unit: c['UnitTitle'] ?? '',
          group: c['ProductGroupTitle'] ?? '',
          consumed: c['ConsumedQuantity'] ?? 0,
          theoretical: c['TheoreticalQuantity'],
          potency: c['PotencyPercent'],
          batch: dedupeBatch(c['BatchNumber']),
          modeCode: c['ConsumptionModeCode'] ?? 1,
          shortageCode: c['ShortageHandlingCode'] ?? 1,
          shortage: c['ShortageQuantity'],
          isReversal: !!c['IsReversal'],
          reversedId: c['ReversedConsumptionId'],
          recovered: !!c['IsRecoveredMaterial'],
          customer: !!c['IsCustomerMaterial'],
          doc: c['DocumentNumber'] ?? '',
          docPattern: c['DocumentPatternTitle'] ?? '',
          start: c['StartTime'],
          description: c['Description'] ?? '',
          report: c['ReportNumber'] ?? '',
          substitute: c['SubstituteTitle'] ?? '',
        })),
        variance: (b['variance'] ?? []).map((v) => ({
          woId: v['WorkOrderId'],
          materialId: v['MaterialId'],
          seq: v['OperationSequence'],
          product: v['ProductTitle'] ?? '',
          unit: v['UnitTitle'] ?? '',
          plannedKit: v['PlannedKitQuantity'] ?? 0,
          actualKit: v['ActualKitQuantity'],
          toComplete: v['ToCompleteQuantity'] ?? 0,
          produced: v['ProducedAtOperation'] ?? 0,
          standard: v['StandardForProduced'] ?? 0,
          actual: v['Actual'] ?? 0,
          minPct: v['MinConsumptionPercent'],
          maxPct: v['MaxConsumptionPercent'],
          active: !!v['IsActiveIngredient'],
          customer: !!v['IsCustomerMaterial'],
          controlCode: v['ConsumptionControlCode'],
          policyCode: v['ConsumptionPolicyCode'],
        })),
        recovered: (b['recovered'] ?? []).map((r) => ({
          batch: r['BatchNumber'] ?? '',
          product: r['ProductTitle'] ?? '',
          code: r['RecoveredCode'] ?? '',
          source: r['SourceTitle'] ?? '',
          onHand: r['OnHandQuantity'] ?? 0,
          purity: r['PurityPercent'],
          minPurity: r['MinPurityPercent'],
          cycle: r['RecoveryCycle'],
          maxCycles: r['MaxCycles'],
          expire: r['ExpireDate'],
          requiresQc: !!r['RequiresQcApproval'],
          qcCode: r['QcStatusCode'] ?? 1,
          blockReason: r['BlockReason'] ?? '',
          maxMix: r['MaxMixPercent'],
        })),
      }))
    );
  }

  /** سرآیند دستورها و مواد آن‌ها از PC-02 — برای عنوان دستور و کشف ردیف‌های q.s. که مصرفشان ثبت نشده */
  context(companyId = DEMO_COMPANY_ID): Observable<{ orders: WoHead[]; materials: WoMaterialRow[] }> {
    return this.http.get<Record<string, Api[]>>(`${API_BASE_URL}/api/pc02/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        orders: (b['orders'] ?? []).map((o) => ({
          id: o['WorkOrderId'],
          number: o['Number'] ?? '',
          name: o['Name'] ?? '',
          typeCode: o['WOTypeCode'],
          statusCode: o['StatusCode'],
          customer: o['CustomerTitle'] ?? '',
        })),
        materials: (b['materials'] ?? []).map((m) => ({
          woId: m['WorkOrderId'],
          product: `${m['ProductCode'] ?? ''} — ${m['ProductTitle'] ?? ''}`,
          unit: m['UnitTitle'] ?? '',
          quantumSatis: !!m['IsQuantumSatis'],
          consumed: m['ConsumedQuantity'],
          statusCode: m['StatusCode'] ?? 1,
        })),
      }))
    );
  }
}
