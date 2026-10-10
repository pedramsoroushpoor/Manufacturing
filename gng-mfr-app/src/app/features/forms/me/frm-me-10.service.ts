import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { RoutingApiRow, mapRouting } from './me-routing';
import { OUTPUT_TYPE } from './frm-me-02.service';
import { Me10Bundle } from './frm-me-10.data';

interface ApiBundle {
  routings: RoutingApiRow[];
  activities: {
    RoutingId: number; RoutingOperationId: number; OperationSequence: number; OperationTitle: string; NatureCode: number; Sequence: number | null; ActivityId: number | null;
    ActivityTitle: string | null; ActivityPropertyTypeCode: number | null; StandardWorkTime: number | null; IsMandatory: boolean | null; IsValueAdded: boolean | null;
    StandardCost: number | null; Description: string | null; CostDriverId: number | null; CostDriverTitle: string | null; DriverCapacity: string | null;
    CapacityAllowedAsDriver: boolean | null; LibraryActivityCount: number;
  }[];
  shares: { RoutingId: number; RoutingOperationId: number; Sequence: number; OperationTitle: string; ProductTitle: string; ReceiveOutputTypeCode: number; Quantity: number; UnitTitle: string | null; CostSharePercent: number | null }[];
}

/* سطح فعالیت ABC (کد موقت گام ۱۱) */
const LEVEL: Record<number, string> = { 1: 'سطح واحد', 2: 'سطح بچ', 3: 'سطح محصول', 4: 'سطح کارخانه' };

/** FRM-ME-10 روی mes.GetRoutingOperationActivities و mes.GetRoutingOutputCostShares. */
@Injectable({ providedIn: 'root' })
export class FrmMe10Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<Me10Bundle> {
    return this.http.get<ApiBundle>(`${API_BASE_URL}/api/me10/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        routings: b.routings.map(mapRouting),
        activities: b.activities.map((a) => ({
          routingId: a.RoutingId,
          routingOperationId: a.RoutingOperationId,
          operationSequence: a.OperationSequence,
          operation: a.OperationTitle,
          natureCode: a.NatureCode,
          sequence: a.Sequence,
          activityId: a.ActivityId,
          activity: a.ActivityTitle ?? '',
          level: a.ActivityPropertyTypeCode ? LEVEL[a.ActivityPropertyTypeCode] ?? '—' : '—',
          minutes: a.StandardWorkTime,
          mandatory: !!a.IsMandatory,
          valueAdded: a.IsValueAdded,
          standardCost: a.StandardCost,
          description: a.Description ?? '',
          driver: a.CostDriverTitle ?? '',
          driverCapacity: a.DriverCapacity ?? '',
          capacityAllowed: a.CapacityAllowedAsDriver,
          libraryActivityCount: a.LibraryActivityCount,
        })),
        shares: b.shares.map((s) => ({
          routingId: s.RoutingId,
          routingOperationId: s.RoutingOperationId,
          sequence: s.Sequence,
          operation: s.OperationTitle,
          product: s.ProductTitle,
          typeCode: s.ReceiveOutputTypeCode,
          type: OUTPUT_TYPE[s.ReceiveOutputTypeCode] ?? '—',
          quantity: s.Quantity,
          unit: s.UnitTitle ?? '',
          share: s.CostSharePercent,
        })),
      }))
    );
  }
}
