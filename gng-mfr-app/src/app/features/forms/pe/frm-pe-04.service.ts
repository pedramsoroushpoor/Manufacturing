import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { fa } from '../rm/rm-time';
import { OUTPUT_PROCESS, OUTPUT_TYPE, OutputRow, StructureSummary, VALUATION } from './frm-pe-04.data';

interface OutputApiRow {
  StructureId: number;
  StructureCode: string;
  StructureTitle: string;
  TypeCode: number;
  ProductCode: string;
  ProductTitle: string;
  UnitTitle: string;
  Quantity: number;
  CostAllocationPercentage: number | null;
  OutputProcessCode: number | null;
  ByProductValuationCode: number | null;
  YieldPercent: number | null;
  MinYieldPercent: number | null;
  MaxYieldPercent: number | null;
  IsRecyclable: boolean | null;
  Description: string | null;
  StructureYieldTotal: number | null;
  StructureYieldRows: number;
  StructureCostShareTotal: number | null;
  StructureCoProducts: number;
}

export interface FrmPe04Bundle {
  structures: StructureSummary[];
  outputs: OutputRow[];
}

/**
 * داده‌ی واقعی FRM-PE-04 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_pe04_setup.sql نگاه کنید).
 */
@Injectable({ providedIn: 'root' })
export class FrmPe04Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<FrmPe04Bundle> {
    return this.http.get<{ outputs: OutputApiRow[] }>(`${API_BASE_URL}/api/pe04/bundle`, { params: { companyId } }).pipe(
      map((b) => {
        const structures = new Map<number, StructureSummary>();
        for (const o of b.outputs) {
          if (structures.has(o.StructureId)) continue;
          const hasYield = o.StructureYieldRows > 0;
          structures.set(o.StructureId, {
            id: o.StructureId,
            code: o.StructureCode,
            title: o.StructureTitle,
            yieldTotal: o.StructureYieldTotal,
            hasYieldTable: hasYield,
            massOk: !hasYield || Math.abs((o.StructureYieldTotal ?? 0) - 100) < 0.01,
            costTotal: o.StructureCostShareTotal,
            coProducts: o.StructureCoProducts,
            costOk: o.StructureCostShareTotal === null || Math.abs(o.StructureCostShareTotal - 100) < 0.01,
          });
        }
        return {
          structures: [...structures.values()],
          outputs: b.outputs.map((o) => ({
            structureId: o.StructureId,
            typeCode: o.TypeCode,
            type: OUTPUT_TYPE[o.TypeCode] ?? '—',
            product: `${o.ProductCode} — ${o.ProductTitle}`,
            quantity: `${fa(o.Quantity)} ${o.UnitTitle}`,
            costShare: o.CostAllocationPercentage,
            process: OUTPUT_PROCESS[o.OutputProcessCode ?? 0] ?? '—',
            valuation: VALUATION[o.ByProductValuationCode ?? 0] ?? '—',
            yieldPercent: o.YieldPercent,
            yieldRange:
              o.MinYieldPercent !== null || o.MaxYieldPercent !== null
                ? `${o.MinYieldPercent !== null ? fa(o.MinYieldPercent) : '۰'}٪ تا ${o.MaxYieldPercent !== null ? fa(o.MaxYieldPercent) : '—'}٪`
                : '—',
            recyclable: o.IsRecyclable,
            description: o.Description ?? '',
          })),
        };
      })
    );
  }
}
