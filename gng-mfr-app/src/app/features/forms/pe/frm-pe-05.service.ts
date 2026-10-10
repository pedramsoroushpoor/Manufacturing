import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { fa } from '../rm/rm-time';
import { CONSUMPTION_PRIORITY, FormulaRow, RECOVERY_MODE, RecoveredRow, RecoveryOutputRow } from './frm-pe-05.data';

interface MaterialApiRow {
  Code: string;
  ProductCode: string;
  ProductTitle: string;
  UnitTitle: string;
  SourceCode: string;
  SourceTitle: string;
  RecoveryModeCode: number;
  GradeTitle: string | null;
  StandardRecoveryPercent: number | null;
  RecoveryLossPercent: number | null;
  EquivalenceRatio: number;
  MinPurityPercent: number | null;
  RequiresQcApproval: boolean;
  MaxCycles: number | null;
  ConsumptionPriorityCode: number;
  NetRecoveryPercent: number | null;
  Description: string | null;
}
interface FormulaApiRow {
  StructureCode: string;
  Sequence: number;
  ProductCode: string;
  ProductTitle: string;
  UnitTitle: string;
  QuantityTypeCode: number;
  Quantity: number;
  IsRecovery: boolean | null;
  RecoveryPercentage: number | null;
  MaxRecoveredUsePercent: number | null;
  HasRecoveredMaterial: boolean;
}
interface OutputApiRow {
  StructureCode: string;
  StructureTitle: string;
  ProductCode: string;
  ProductTitle: string;
  UnitTitle: string;
  Quantity: number;
  Description: string | null;
}
interface BundleApi {
  policy: { DefaultRecoveryModeCode: number; Description: string | null } | null;
  materials: MaterialApiRow[];
  formulaRows: FormulaApiRow[];
  outputs: OutputApiRow[];
}

export interface FrmPe05Bundle {
  policy: string;
  policyNote: string;
  materials: RecoveredRow[];
  formulaRows: FormulaRow[];
  outputs: RecoveryOutputRow[];
}

const pct = (n: number | null) => (n === null ? '—' : `${fa(n)}٪`);

/**
 * داده‌ی واقعی FRM-PE-05 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_pe05_setup.sql نگاه کنید).
 */
@Injectable({ providedIn: 'root' })
export class FrmPe05Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<FrmPe05Bundle> {
    return this.http.get<BundleApi>(`${API_BASE_URL}/api/pe05/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        policy: b.policy ? RECOVERY_MODE[b.policy.DefaultRecoveryModeCode] ?? '—' : 'تعریف نشده',
        policyNote: b.policy?.Description ?? '',
        materials: b.materials.map((m) => ({
          code: m.Code,
          product: `${m.ProductCode} — ${m.ProductTitle}`,
          source: `${m.SourceCode} — ${m.SourceTitle}`,
          mode: RECOVERY_MODE[m.RecoveryModeCode] ?? '—',
          grade: m.GradeTitle ?? '—',
          rate: pct(m.StandardRecoveryPercent),
          loss: pct(m.RecoveryLossPercent),
          net: pct(m.NetRecoveryPercent),
          ratio: fa(m.EquivalenceRatio),
          ratioText: `${fa(m.EquivalenceRatio)} ${m.UnitTitle} بازیابی‌شده = ۱ ${m.UnitTitle} نو`,
          purity: m.MinPurityPercent === null ? '—' : `حداقل ${fa(m.MinPurityPercent)}٪`,
          qc: m.RequiresQcApproval,
          cycles: m.MaxCycles === null ? 'بدون سقف' : `حداکثر ${fa(m.MaxCycles)} بار`,
          priority: CONSUMPTION_PRIORITY[m.ConsumptionPriorityCode] ?? '—',
          unit: m.UnitTitle,
          description: m.Description ?? '',
        })),
        formulaRows: b.formulaRows.map((f) => ({
          structure: f.StructureCode,
          item: `ردیف ${fa(f.Sequence)}: ${f.ProductCode} — ${f.ProductTitle}`,
          quantity: f.QuantityTypeCode === 4 ? `${fa(f.Quantity)}٪` : `${fa(f.Quantity)} ${f.UnitTitle}`,
          recovery: f.IsRecovery ? `بازیابی ${pct(f.RecoveryPercentage)}` : '—',
          maxUse: f.MaxRecoveredUsePercent,
          hasMaterial: f.HasRecoveredMaterial,
        })),
        outputs: b.outputs.map((o) => ({
          structure: `${o.StructureCode} — ${o.StructureTitle}`,
          product: `${o.ProductCode} — ${o.ProductTitle}`,
          quantity: `${fa(o.Quantity)} ${o.UnitTitle}`,
          description: o.Description ?? '',
        })),
      }))
    );
  }
}
