import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { faNum } from './me-routing';
import { Me09Bundle } from './frm-me-09.data';

interface ApiBundle {
  routings: { RoutingId: number; RoutingTitle: string; StatusCode: number | null; RateQuantity: number | null; RateTimeBasisCode: number | null; RoutingBatchSize: number; LineTitle: string | null; UnitTitle: string | null; Operations: string | null; Versions: string | null }[];
  templates: {
    TemplateId: number; VersionId: number; VersionTitle: string; OrderBasisCode: number; VersionStatusCode: number; ShiftTitle: string; FromTime: number; ToTime: number; ShiftMinutes: number;
    PlannedQuantity: number; NetRunMinutes: number | null; IsActive: boolean; Description: string | null; ShiftCapacity: number;
  }[];
  handovers: { RoutingId: number; RoutingCode: string; RoutingOperationId: number; Sequence: number; OperationTitle: string; HandoverModeCode: number | null; MaxCarryHours: number | null; RequiresCount: boolean | null; Description: string | null }[];
}

const MODE: Record<number, string> = { 1: 'انتقال به دستور شیفت بعد', 2: 'بستن و رسید در پایان شیفت', 3: 'برگشت به انبار پای کار' };

/** FRM-ME-09 روی mes.GetContinuousRoutings، GetShiftOrderTemplates، GetShiftHandoverRules. */
@Injectable({ providedIn: 'root' })
export class FrmMe09Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<Me09Bundle> {
    return this.http.get<ApiBundle>(`${API_BASE_URL}/api/me09/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        routings: b.routings.map((r) => ({
          id: r.RoutingId,
          routing: r.RoutingTitle,
          statusCode: r.StatusCode ?? 1,
          rate: r.RateQuantity,
          rateBasisCode: r.RateTimeBasisCode,
          rateText: r.RateQuantity !== null ? `${faNum(r.RateQuantity)} ${r.UnitTitle ?? ''} ${r.RateTimeBasisCode === 2 ? 'در شیفت' : 'در ساعت'}` : 'تعیین نشده',
          batch: r.RoutingBatchSize,
          line: r.LineTitle ?? '—',
          unit: r.UnitTitle ?? '',
          operations: r.Operations ?? '',
          versions: r.Versions ?? '',
        })),
        templates: b.templates.map((t) => ({
          id: t.TemplateId,
          versionId: t.VersionId,
          version: t.VersionTitle,
          orderBasisCode: t.OrderBasisCode,
          versionStatusCode: t.VersionStatusCode,
          shift: t.ShiftTitle,
          fromTime: t.FromTime,
          toTime: t.ToTime,
          shiftMinutes: t.ShiftMinutes,
          planned: t.PlannedQuantity,
          netRunMinutes: t.NetRunMinutes,
          active: t.IsActive,
          description: t.Description ?? '',
          capacity: t.ShiftCapacity,
        })),
        handovers: b.handovers.map((h) => ({
          routingId: h.RoutingId,
          routing: h.RoutingCode,
          routingOperationId: h.RoutingOperationId,
          sequence: h.Sequence,
          operation: h.OperationTitle,
          modeCode: h.HandoverModeCode,
          mode: h.HandoverModeCode ? MODE[h.HandoverModeCode] : 'تعیین نشده',
          maxCarryHours: h.MaxCarryHours,
          requiresCount: h.RequiresCount,
          description: h.Description ?? '',
        })),
      }))
    );
  }
}
