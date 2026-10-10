import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { Me05Bundle } from './frm-me-05.data';

interface ApiBundle {
  recoveries: {
    RecoveryId: number; RoutingCode: string; VersionCode: string | null; RoutingTitle: string; RoutingStatusCode: number | null; Sequence: number; OperationCode: string; OperationTitle: string;
    RecoveredCode: string; ProductCode: string; ProductTitle: string; UnitTitle: string | null; SourceCode: string | null; SourceTitle: string | null;
    StandardRecoveryPercent: number | null; StandardLossPercent: number | null; RequiresQcApproval: boolean | null; MinPurityPercent: number | null;
    RecoveryMethodCode: number; RecoveryPercent: number; LossPercent: number | null; ReceiptInventoryTitle: string | null; ReceiptDocumentPatternTitle: string | null;
    ReturnModeCode: number; ExecutionLocationCode: number; ContractorTitle: string | null; Description: string | null; SourceInputQuantity: number | null; OutputQuantity: number | null;
  }[];
  coverage: { RecoveredCode: string; Product: string; Source: string | null; RecoveryModeCode: number; StandardRecoveryPercent: number | null; IsActive: boolean; OperationCount: number }[];
}

const METHOD: Record<number, string> = { 1: 'تقطیر', 2: 'تغلیظ', 3: 'جداسازی', 4: 'فیلتراسیون' };
const RETURN_MODE: Record<number, string> = { 1: 'بازگشت به همان دستور', 2: 'انبار عمومی بازیابی' };
const LOCATION: Record<number, string> = { 1: 'همان خط', 2: 'واحد بازیابی مرکزی', 3: 'برون‌سپاری' };
const MODE: Record<number, string> = { 1: 'قلم مستقل', 2: 'گرید همان قلم' };

/** FRM-ME-05 روی mes.GetRoutingRecoveries و mes.GetRecoveredMaterialCoverage. */
@Injectable({ providedIn: 'root' })
export class FrmMe05Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<Me05Bundle> {
    return this.http.get<ApiBundle>(`${API_BASE_URL}/api/me05/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        recoveries: b.recoveries.map((r) => ({
          id: r.RecoveryId,
          routing: `${r.RoutingCode} ${r.VersionCode ?? ''} — ${r.RoutingTitle}`,
          routingStatusCode: r.RoutingStatusCode ?? 1,
          sequence: r.Sequence,
          operation: `${r.OperationCode} — ${r.OperationTitle}`,
          recoveredCode: r.RecoveredCode,
          product: `${r.ProductCode} — ${r.ProductTitle}`,
          unit: r.UnitTitle ?? '',
          source: r.SourceCode ? `${r.SourceCode} — ${r.SourceTitle}` : '—',
          standardPercent: r.StandardRecoveryPercent,
          standardLoss: r.StandardLossPercent,
          requiresQc: !!r.RequiresQcApproval,
          minPurity: r.MinPurityPercent,
          method: METHOD[r.RecoveryMethodCode] ?? '—',
          percent: r.RecoveryPercent,
          loss: r.LossPercent,
          receiptInventory: r.ReceiptInventoryTitle ?? '',
          documentPattern: r.ReceiptDocumentPatternTitle ?? '',
          returnModeCode: r.ReturnModeCode,
          returnMode: RETURN_MODE[r.ReturnModeCode] ?? '—',
          locationCode: r.ExecutionLocationCode,
          location: LOCATION[r.ExecutionLocationCode] ?? '—',
          contractor: r.ContractorTitle ?? '',
          description: r.Description ?? '',
          sourceInput: r.SourceInputQuantity,
          output: r.OutputQuantity,
          expectedOutput: r.SourceInputQuantity !== null ? (r.SourceInputQuantity * r.RecoveryPercent) / 100 : null,
        })),
        coverage: b.coverage.map((c) => ({
          code: c.RecoveredCode,
          product: c.Product,
          source: c.Source ?? '—',
          mode: MODE[c.RecoveryModeCode] ?? '—',
          standardPercent: c.StandardRecoveryPercent,
          isActive: c.IsActive,
          operationCount: c.OperationCount,
        })),
      }))
    );
  }
}
