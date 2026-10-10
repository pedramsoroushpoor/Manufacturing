import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { mapMaterial, mapWorkOrder } from './frm-pc-02.service';
import { Pc03Bundle } from './frm-pc-03.data';

type Row = Record<string, any>;
const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const nn = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/**
 * FRM-PC-03 روی /api/pc03/bundle (mes.GetReleaseChecks، GetMaterialKits، GetMaterialExcessAndReturns، GetLineSideStock)
 * و اقلام مواد دستور از /api/pc02/bundle (مقدار برنامه‌ای شارژ).
 */
@Injectable({ providedIn: 'root' })
export class FrmPc03Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Pc03Bundle> {
    return forkJoin({
      b: this.http.get<Record<string, Row[]>>(`${API_BASE_URL}/api/pc03/bundle`, { params: { companyId } }),
      p: this.http.get<Record<string, Row[]>>(`${API_BASE_URL}/api/pc02/bundle`, { params: { companyId } }),
    }).pipe(
      map(({ b, p }) => ({
        orders: (b['orders'] ?? []).map(mapWorkOrder),
        materials: (p['materials'] ?? []).map(mapMaterial),
        checks: (b['checks'] ?? []).map((c) => ({ workOrderId: c['WorkOrderId'], code: s(c['CheckCode']), title: s(c['CheckTitle']), statusCode: n(c['StatusCode']), detail: s(c['Detail']) })),
        kits: (b['kits'] ?? []).map((k) => ({
          workOrderId: k['WorkOrderId'],
          materialId: k['MaterialId'],
          operationSeq: n(k['OperationSequence']),
          operationTitle: s(k['OperationTitle']),
          productCode: s(k['ProductCode']),
          productTitle: s(k['ProductTitle']),
          unit: s(k['UnitTitle']),
          transferNo: n(k['TransferNo']),
          kitQuantity: n(k['KitQuantity']),
          activeQuantity: n(k['ActiveKitQuantity']),
          batch: s(k['BatchNumber']),
          potency: nn(k['PotencyPercent']),
          statusCode: n(k['KitStatusCode']),
          effectiveDate: k['EffectiveDate'] ?? null,
          scanCode: s(k['ScanCode']),
          description: s(k['Description']),
          source: s(k['SourceInventory']),
          expireDate: k['ExpireDate'] ?? null,
        })),
        excess: (b['excess'] ?? []).map((e) => ({
          workOrderId: e['WorkOrderId'],
          product: s(e['ProductTitle']),
          unit: s(e['UnitTitle']),
          quantity: n(e['ExcessQuantity']),
          reason: s(e['ExcessReasonTitle']),
          statusCode: n(e['StatusCode']),
          requestDate: e['RequestDate'] ?? null,
          approver: s(e['ApproverTitle']),
          description: s(e['Description']),
          plannedKit: n(e['PlannedKitQuantity']),
          maxPercent: nn(e['MaxConsumptionPercent']),
        })),
        returns: (b['returns'] ?? []).map((r) => ({
          workOrderId: r['WorkOrderId'],
          product: s(r['ProductTitle']),
          unit: s(r['UnitTitle']),
          quantity: n(r['ReturnedQuantity']),
          reason: s(r['ReturnReason']),
          batch: s(r['BatchNumber']),
          document: s(r['DocumentNumber']),
          date: r['EndTime'] ?? null,
          withinTolerance: !!r['IsReturnedTolerance'],
        })),
        lineSide: (b['lineSide'] ?? []).map((l) => ({
          workOrderId: l['WorkOrderId'],
          workOrderNumber: s(l['WorkOrderNumber']),
          productCode: s(l['ProductCode']),
          productTitle: s(l['ProductTitle']),
          group: s(l['ProductGroupTitle']),
          unit: s(l['UnitTitle']),
          delivered: n(l['Delivered']),
          consumed: n(l['Consumed']),
          returned: n(l['Returned']),
          onLine: n(l['OnLine']),
          remainingNeed: n(l['RemainingNeed']),
          reorderPoint: nn(l['ReorderPoint']),
          minStock: nn(l['MinStock']),
          maxStock: nn(l['MaxStock']),
          feedingPolicyCode: nn(l['FeedingPolicyCode']),
        })),
      }))
    );
  }
}
