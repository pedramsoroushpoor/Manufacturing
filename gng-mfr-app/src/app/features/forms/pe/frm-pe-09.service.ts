import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { Pe09Bundle } from './frm-pe-09.data';

interface EcoApiRow {
  EcoId: number;
  Number: string;
  Title: string;
  OriginCode: number;
  PriorityCode: number;
  StatusCode: number;
  RequestedByTitle: string | null;
  RequestDate: string;
  EffectiveDate: string | null;
  InventoryPolicyCode: number | null;
  InventoryPolicyCondition: string | null;
  Reason: string | null;
  Description: string | null;
  ItemCount: number;
  ApproverCount: number;
  SignedCount: number;
  LinkedRevisions: string | null;
}
interface ApiBundle {
  ecoId: number | null;
  ecos: EcoApiRow[];
  items: { EntityTypeCode: number; ChangeTypeCode: number; EntityTitle: string | null; BeforeText: string | null; AfterText: string | null; Description: string | null }[];
  approvals: { Sequence: number; RoleTitle: string; ApproverTitle: string | null; DecisionCode: number | null; SignedOn: string | null; SignatureMethod: string | null; Comment: string | null }[];
  notifications: { UnitTitle: string; StatusCode: number; SentOn: string | null; Message: string | null }[];
  impact: { ImpactKind: 'direct' | 'upstream'; Level: number; ProductCode: string | null; ProductTitle: string | null; StructureCode: string | null; StructureTitle: string | null; InCurrent: boolean | null }[];
}

/* کدهای موقت؛ معنای هر کد در scripts/mes_frm_pe09_setup.sql آمده است. */
const ORIGIN: Record<number, string> = { 1: 'کیفیت', 2: 'تأمین', 3: 'بهبود', 4: 'الزام قانونی', 5: 'مشتری' };
const PRIORITY: Record<number, string> = { 1: 'عادی', 2: 'فوری' };
const STATUS: Record<number, string> = { 1: 'پیش‌نویس', 2: 'تحلیل اثر', 3: 'در انتظار تأیید', 4: 'تأییدشده', 5: 'اجراشده', 6: 'ردشده' };
const POLICY: Record<number, string> = { 1: 'مصرف تا اتمام', 2: 'کنارگذاری', 3: 'اختلاط با شرط' };
const ENTITY: Record<number, string> = { 1: 'ساختار محصول', 2: 'کالا', 3: 'گروه جایگزین', 4: 'الگو' };
const CHANGE: Record<number, string> = { 1: 'افزودن', 2: 'حذف', 3: 'تغییر مقدار/ویژگی', 4: 'جایگزینی' };

const day = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
const stamp = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('fa-IR-u-ca-persian', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

/** FRM-PE-09 روی mes.GetEcos، mes.GetEcoDetail و mes.GetEcoImpact (scripts/mes_frm_pe09_setup.sql). */
@Injectable({ providedIn: 'root' })
export class FrmPe09Service {
  constructor(private http: HttpClient) {}

  bundle(ecoId: number | null, companyId = DEMO_COMPANY_ID): Observable<Pe09Bundle> {
    const params: Record<string, number> = { companyId };
    if (ecoId) params['ecoId'] = ecoId;
    return this.http.get<ApiBundle>(`${API_BASE_URL}/api/pe09/bundle`, { params }).pipe(
      map((b) => ({
        ecoId: b.ecoId,
        ecos: b.ecos.map((e) => ({
          id: e.EcoId,
          number: e.Number,
          title: e.Title,
          origin: ORIGIN[e.OriginCode] ?? '—',
          priority: PRIORITY[e.PriorityCode] ?? '—',
          statusCode: e.StatusCode,
          status: STATUS[e.StatusCode] ?? '—',
          requestedBy: e.RequestedByTitle ?? '—',
          requestDate: day(e.RequestDate),
          effectiveDate: day(e.EffectiveDate),
          inventoryPolicyCode: e.InventoryPolicyCode,
          inventoryPolicy: e.InventoryPolicyCode ? POLICY[e.InventoryPolicyCode] : 'تعیین نشده',
          inventoryCondition: e.InventoryPolicyCondition ?? '',
          reason: e.Reason ?? '',
          description: e.Description ?? '',
          itemCount: e.ItemCount,
          approverCount: e.ApproverCount,
          signedCount: e.SignedCount,
          linkedRevisions: e.LinkedRevisions ?? '',
        })),
        items: b.items.map((i) => ({
          entityType: ENTITY[i.EntityTypeCode] ?? '—',
          changeType: CHANGE[i.ChangeTypeCode] ?? '—',
          entity: i.EntityTitle ?? '—',
          before: i.BeforeText ?? '—',
          after: i.AfterText ?? '—',
          description: i.Description ?? '',
        })),
        approvals: b.approvals.map((a) => ({
          sequence: a.Sequence,
          role: a.RoleTitle,
          approver: a.ApproverTitle ?? '—',
          decisionCode: a.DecisionCode,
          signedOn: stamp(a.SignedOn),
          method: a.SignatureMethod ?? '',
          comment: a.Comment ?? '',
        })),
        notifications: b.notifications.map((n) => ({ unit: n.UnitTitle, statusCode: n.StatusCode, sentOn: stamp(n.SentOn), message: n.Message ?? '' })),
        impact: b.impact.map((r) => ({
          kind: r.ImpactKind,
          level: r.Level,
          product: r.ProductCode ? `${r.ProductCode} — ${r.ProductTitle}` : '—',
          structure: r.StructureCode ? `${r.StructureCode} — ${r.StructureTitle}` : '',
          inCurrent: r.InCurrent,
        })),
      }))
    );
  }
}
