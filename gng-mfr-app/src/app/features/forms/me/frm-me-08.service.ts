import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { faDay } from './me-routing';
import { SelectionRow, VersionRow } from './frm-me-08.data';

interface ApiVersion {
  VersionId: number; Code: string; Title: string; ProductId: number; ProductTitle: string; UnitTitle: string | null; StructureTitle: string; StructureStatusCode: number | null;
  RoutingId: number; RoutingTitle: string; RoutingStatusCode: number | null; RoutingValidTo: string | null; RoutingMinBatch: number | null; RoutingMaxBatch: number | null;
  RoutingProductionTypeCode: number; OrgNodeTitle: string | null; LineId: number | null; LineTitle: string | null; MinBatchSize: number | null; MaxBatchSize: number | null;
  EffectivityTypeCode: number; ValidFromDate: string | null; ValidToDate: string | null; FromBatchNumber: string | null; ToBatchNumber: string | null; WorkOrderNumber: string | null;
  Priority: number; StatusCode: number; ProductionTypeCode: number; OrderBasisCode: number; AllowsStandardOrder: boolean; AllowsReworkOrder: boolean; AllowsSampleOrder: boolean;
  AllowsTollOrder: boolean; BaseCost: number | null; BaseLeadTimeHours: number | null; ApproverTitle: string | null; Description: string | null; RoutingAssigned: boolean;
  ProductMatches: boolean; LinesInScope: string | null;
}
interface ApiSelection {
  VersionId: number; Code: string; Title: string; Priority: number; MinBatchSize: number | null; MaxBatchSize: number | null; RejectReason: string | null; Rank: number | null;
  IsSelected: boolean; EligibleCount: number;
}

export const VERSION_STATUS: Record<number, string> = { 1: 'پیش‌نویس', 2: 'در تأیید', 3: 'فعال', 4: 'معلق', 5: 'منسوخ' };
const EFFECTIVITY: Record<number, string> = { 1: 'تاریخی', 2: 'بچ‌محور', 3: 'سفارش‌محور' };

/** FRM-ME-08 روی mes.GetManufacturingVersions و mes.SelectManufacturingVersion. */
@Injectable({ providedIn: 'root' })
export class FrmMe08Service {
  constructor(private http: HttpClient) {}

  versions(companyId = DEMO_COMPANY_ID): Observable<VersionRow[]> {
    return this.http.get<{ versions: ApiVersion[] }>(`${API_BASE_URL}/api/me08/bundle`, { params: { companyId } }).pipe(
      map((b) =>
        b.versions.map((v) => ({
          id: v.VersionId,
          code: v.Code,
          title: v.Title,
          productId: v.ProductId,
          product: v.ProductTitle,
          unit: v.UnitTitle ?? '',
          structure: v.StructureTitle,
          structureStatusCode: v.StructureStatusCode ?? 1,
          routingId: v.RoutingId,
          routing: v.RoutingTitle,
          routingStatusCode: v.RoutingStatusCode ?? 1,
          routingValidTo: v.RoutingValidTo,
          routingMinBatch: v.RoutingMinBatch,
          routingMaxBatch: v.RoutingMaxBatch,
          routingTypeCode: v.RoutingProductionTypeCode,
          orgNode: v.OrgNodeTitle ?? '',
          lineId: v.LineId,
          line: v.LineTitle ?? '',
          linesInScope: v.LinesInScope ?? '',
          minBatch: v.MinBatchSize,
          maxBatch: v.MaxBatchSize,
          effectivityCode: v.EffectivityTypeCode,
          effectivity: EFFECTIVITY[v.EffectivityTypeCode] ?? '—',
          validFrom: faDay(v.ValidFromDate),
          validTo: faDay(v.ValidToDate),
          validFromIso: v.ValidFromDate,
          validToIso: v.ValidToDate,
          fromBatch: v.FromBatchNumber ?? '',
          toBatch: v.ToBatchNumber ?? '',
          workOrder: v.WorkOrderNumber ?? '',
          priority: v.Priority,
          statusCode: v.StatusCode,
          status: VERSION_STATUS[v.StatusCode] ?? '—',
          productionTypeCode: v.ProductionTypeCode,
          orderBasisCode: v.OrderBasisCode,
          allowsStandard: v.AllowsStandardOrder,
          allowsRework: v.AllowsReworkOrder,
          allowsSample: v.AllowsSampleOrder,
          allowsToll: v.AllowsTollOrder,
          baseCost: v.BaseCost,
          baseLeadHours: v.BaseLeadTimeHours,
          approver: v.ApproverTitle ?? '',
          description: v.Description ?? '',
          routingAssigned: v.RoutingAssigned,
          productMatches: v.ProductMatches,
        }))
      )
    );
  }

  select(productId: number, lineId: number, quantity: number, date: string, orderType: number, companyId = DEMO_COMPANY_ID): Observable<SelectionRow[]> {
    return this.http
      .get<ApiSelection[]>(`${API_BASE_URL}/api/me08/select`, { params: { companyId, productId, lineId, quantity, date, orderType } })
      .pipe(
        map((rows) =>
          rows.map((r) => ({
            versionId: r.VersionId,
            code: r.Code,
            title: r.Title,
            priority: r.Priority,
            minBatch: r.MinBatchSize,
            maxBatch: r.MaxBatchSize,
            rejectReason: r.RejectReason,
            rank: r.Rank,
            selected: r.IsSelected,
            eligibleCount: r.EligibleCount,
          }))
        )
      );
  }
}
