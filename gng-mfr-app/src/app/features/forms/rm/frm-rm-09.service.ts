import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import {
  ACTIVITY_LEVEL,
  ActivityRow,
  AllocationGroup,
  COLLECTION_EVENT,
  COLLECTION_METHOD,
  CapacityTypeRow,
  CostChainRow,
  DriverRow,
  RESOURCE_KIND,
} from './frm-rm-09.data';
import { DEMO_COMPANY_ID } from './rm-scope';

interface ActivityApiRow {
  Code: string;
  Title: string;
  ActivityPropertyTypeCode: number | null;
  IsActive: boolean;
  Description: string | null;
  Operations: string | null;
  Resources: string | null;
  CostCenters: string | null;
  DriverCount: number;
}
interface DriverApiRow {
  Code: string;
  Title: string;
  ActivityCode: string;
  ActivityTitle: string;
  TypeCode: string;
  TypeTitle: string;
  UnitTitle: string;
  CollectionMethodCode: number;
  TypeAllowed: boolean;
  CollectionEventCode: number;
  CostSystemEventName: string | null;
  IsEventActive: boolean;
  Description: string | null;
}
interface TypeApiRow {
  Code: string;
  Title: string;
  UnitTitle: string;
  MeasureBasisCode: number;
  CollectionMethodCode: number;
  IsCostDriver: boolean;
  IsActive: boolean;
  Drivers: string | null;
}
interface AllocationApiRow {
  SharedResourceKindCode: number;
  ResourceKey: string;
  ResourceTitle: string;
  CostCenterTitle: string;
  AllocationMethodCode: number;
  SharePercent: number | null;
  DriverCode: string | null;
  DriverTitle: string | null;
  ResourceShareTotal: number | null;
  Description: string | null;
}
interface BundleApi {
  activities: ActivityApiRow[];
  drivers: DriverApiRow[];
  capacityTypes: TypeApiRow[];
  allocations: AllocationApiRow[];
}

export interface FrmRm09Bundle {
  activities: ActivityRow[];
  drivers: DriverRow[];
  capacityTypes: CapacityTypeRow[];
  chain: CostChainRow[];
  allocations: AllocationGroup[];
}

/**
 * داده‌ی واقعی FRM-RM-09 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_rm09_setup.sql نگاه کنید).
 */
@Injectable({ providedIn: 'root' })
export class FrmRm09Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<FrmRm09Bundle> {
    return this.http.get<BundleApi>(`${API_BASE_URL}/api/rm09/bundle`, { params: { companyId } }).pipe(map((b) => this.build(b)));
  }

  private build(b: BundleApi): FrmRm09Bundle {
    const fa = (n: number) => n.toLocaleString('fa-IR');
    const groups = new Map<string, AllocationGroup>();
    for (const a of b.allocations) {
      if (!groups.has(a.ResourceKey)) {
        groups.set(a.ResourceKey, {
          resource: a.ResourceTitle,
          kind: RESOURCE_KIND[a.SharedResourceKindCode] ?? '—',
          method: a.AllocationMethodCode === 1 ? 'fixed' : 'actual',
          lines: [],
          total: a.ResourceShareTotal,
          ok: a.ResourceShareTotal === null || Math.abs(a.ResourceShareTotal - 100) < 0.001,
        });
      }
      const g = groups.get(a.ResourceKey)!;
      if ((a.AllocationMethodCode === 1 ? 'fixed' : 'actual') !== g.method) g.method = 'mixed';
      g.lines.push({
        costCenter: a.CostCenterTitle,
        basis: a.AllocationMethodCode === 1 ? `ضریب ثابت ${fa(a.SharePercent ?? 0)}٪` : `مقدار واقعی محرک ${a.DriverCode} — ${a.DriverTitle}`,
        share: a.SharePercent,
        description: a.Description ?? '',
      });
    }

    return {
      activities: b.activities.map((a) => ({
        code: a.Code,
        title: a.Title,
        level: ACTIVITY_LEVEL[a.ActivityPropertyTypeCode ?? 0] ?? '—',
        operations: a.Operations ?? '—',
        resources: a.Resources ?? '—',
        costCenters: a.CostCenters ?? '—',
        driverCount: a.DriverCount,
        active: a.IsActive,
        description: a.Description ?? '',
      })),
      drivers: b.drivers.map((d) => ({
        code: d.Code,
        title: d.Title,
        activity: `${d.ActivityCode} — ${d.ActivityTitle}`,
        type: `${d.TypeCode} — ${d.TypeTitle}`,
        unit: d.UnitTitle,
        collection: COLLECTION_METHOD[d.CollectionMethodCode] ?? '—',
        event: COLLECTION_EVENT[d.CollectionEventCode] ?? '—',
        eventName: d.CostSystemEventName ?? '—',
        eventActive: d.IsEventActive,
        typeAllowed: d.TypeAllowed,
        description: d.Description ?? '',
      })),
      capacityTypes: b.capacityTypes.map((t) => ({
        code: t.Code,
        title: t.Title,
        unit: t.UnitTitle,
        collection: COLLECTION_METHOD[t.CollectionMethodCode] ?? '—',
        isCostDriver: t.IsCostDriver,
        fixedBasis: t.MeasureBasisCode === 3,
        drivers: t.Drivers ?? '',
        active: t.IsActive,
        misused: !t.IsCostDriver && !!t.Drivers,
      })),
      chain: b.activities
        .filter((a) => a.DriverCount > 0)
        .map((a) => ({
          costCenters: a.CostCenters ?? 'مرکز هزینه‌ی کارخانه',
          activity: a.Title,
          drivers: b.drivers.filter((d) => d.ActivityCode === a.Code).map((d) => `${d.TypeTitle} (${d.UnitTitle})`).join(' + '),
        })),
      allocations: [...groups.values()],
    };
  }
}
