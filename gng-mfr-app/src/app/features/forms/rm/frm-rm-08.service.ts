import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import {
  CONTRACT_WARN_DAYS,
  CapabilityRow,
  ContractorIssue,
  ContractorRow,
  INVENTORY_TYPE_LABEL,
  InventoryRow,
  PERIOD_LABEL,
  QUALIFICATION,
  QUALIFICATION_WARN_DAYS,
  RateRow,
  Tone,
} from './frm-rm-08.data';
import { DEMO_COMPANY_ID } from './rm-scope';
import { fa, faFullDate, faTime, isoDay, workDaysText } from './rm-time';

interface ContractorApiRow {
  ContractorId: number;
  Code: string;
  Title: string;
  CityTitle: string | null;
  ContactTitle: string | null;
  ContractNumber: string | null;
  ContractFromDate: string | null;
  ContractToDate: string | null;
  ContractDaysLeft: number | null;
  QualificationStatusCode: number;
  IsCustomerMaterial: boolean;
  WorkDaysMask: number;
  FromTime: number;
  ToTime: number;
  Is24x7: boolean;
  IsActive: boolean;
  Description: string | null;
  CapabilityCount: number;
  ExpiredQualificationCount: number;
  InventoryCount: number;
}
interface CapabilityApiRow {
  ContractorTitle: string;
  OperationCode: string;
  OperationTitle: string;
  ProductTitle: string;
  IsProductGroup: boolean;
  CapacityQuantity: number;
  CapacityUnitTitle: string;
  CapacityPeriodCode: number;
  QualifiedUntilDate: string | null;
  QualificationDaysLeft: number | null;
  VersionStatus: 'current' | 'future';
}
interface RateApiRow {
  ContractorTitle: string;
  OperationCode: string;
  OperationTitle: string;
  ProductTitle: string;
  IsProductGroup: boolean;
  FeePerUnit: number;
  FeeUnitTitle: string;
  CurrencyTitle: string;
  LeadTimeDays: number;
  MinOrderQuantity: number | null;
  ValidFromDate: string;
  ValidToDate: string | null;
  VersionStatus: 'current' | 'future' | 'past';
  PreviousFee: number | null;
  ChangeReason: string | null;
  HasCapability: boolean;
}
interface InventoryApiRow {
  ContractorTitle: string;
  Code: string;
  Title: string;
  InventoryId: number | null;
  ReferenceInventoryNumber: string | null;
  InventoryTypeCode: number;
  Description: string | null;
}
interface BundleApi {
  today: string;
  contractors: ContractorApiRow[];
  capabilities: CapabilityApiRow[];
  rates: RateApiRow[];
  inventories: InventoryApiRow[];
}

/** همه‌ی داده‌ی فرم برای یک پیمانکار (یا همه). */
export interface FrmRm08Bundle {
  contractors: ContractorRow[];
  capabilities: CapabilityRow[];
  rates: RateRow[];
  inventories: InventoryRow[];
  issues: ContractorIssue[];
}

const period = (from: string | null, to: string | null): string =>
  from && to ? `${faFullDate(isoDay(from))} تا ${faFullDate(isoDay(to))}` : from ? `از ${faFullDate(isoDay(from))}` : '—';

/**
 * داده‌ی واقعی FRM-RM-08 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_rm08_setup.sql نگاه کنید).
 */
@Injectable({ providedIn: 'root' })
export class FrmRm08Service {
  constructor(private http: HttpClient) {}

  load(contractorId: number | null, companyId = DEMO_COMPANY_ID): Observable<FrmRm08Bundle> {
    const params: Record<string, number> = { companyId };
    if (contractorId !== null) params['contractorId'] = contractorId;
    return this.http.get<BundleApi>(`${API_BASE_URL}/api/rm08/bundle`, { params }).pipe(map((b) => this.build(b, contractorId)));
  }

  private build(b: BundleApi, contractorId: number | null): FrmRm08Bundle {
    const issues: ContractorIssue[] = [];
    const inScope = b.contractors.filter((c) => c.IsActive && (contractorId === null || c.ContractorId === contractorId));

    for (const c of inScope) {
      if (c.QualificationStatusCode === 3) issues.push({ tone: 'danger', text: `${c.Title} در تعلیق است` });
      if (c.ContractDaysLeft !== null && c.ContractDaysLeft < 0) issues.push({ tone: 'danger', text: `قرارداد ${c.Title} تمام شده` });
      else if (c.ContractDaysLeft !== null && c.ContractDaysLeft <= CONTRACT_WARN_DAYS) {
        issues.push({ tone: 'warning', text: `قرارداد ${c.Title} ${fa(c.ContractDaysLeft)} روز دیگر تمام می‌شود` });
      }
      if (c.ExpiredQualificationCount) {
        issues.push({ tone: 'danger', text: `تأیید صلاحیت ${fa(c.ExpiredQualificationCount)} قابلیتِ ${c.Title} گذشته است` });
      }
      if (c.IsCustomerMaterial && c.CapabilityCount && !c.InventoryCount) {
        issues.push({ tone: 'warning', text: `${c.Title} کارمزدی است ولی انبار امانی ندارد` });
      }
    }
    for (const r of b.rates.filter((x) => x.VersionStatus !== 'past' && !x.HasCapability)) {
      issues.push({ tone: 'warning', text: `${r.ContractorTitle} برای «${r.OperationTitle} — ${r.ProductTitle}» نرخ دارد ولی قابلیتش ثبت نشده` });
    }

    return {
      contractors: b.contractors.map((c): ContractorRow => {
        let contractState = 'بدون قرارداد';
        let contractTone: Tone = 'secondary';
        if (c.ContractDaysLeft !== null) {
          if (c.ContractDaysLeft < 0) [contractState, contractTone] = ['تمام‌شده', 'danger'];
          else if (c.ContractDaysLeft <= CONTRACT_WARN_DAYS) [contractState, contractTone] = [`${fa(c.ContractDaysLeft)} روز مانده`, 'warning'];
          else [contractState, contractTone] = ['معتبر', 'success'];
        }
        const q = QUALIFICATION[c.QualificationStatusCode] ?? { label: '—', tone: 'secondary' as Tone };
        return {
          id: c.ContractorId,
          code: c.Code,
          title: c.Title,
          city: c.CityTitle ?? '—',
          contact: c.ContactTitle ?? '—',
          contract: c.ContractNumber ? `${c.ContractNumber} · ${period(c.ContractFromDate, c.ContractToDate)}` : '—',
          contractState,
          contractTone,
          qualification: q.label,
          qualificationTone: q.tone,
          materialMode: c.IsCustomerMaterial ? 'کارمزدی (مواد از ما)' : 'خرید کامل',
          calendar: c.Is24x7 ? 'پیوسته ۲۴/۷' : `${workDaysText(c.WorkDaysMask)}، ${faTime(c.FromTime)} تا ${faTime(c.ToTime)}`,
          active: c.IsActive,
          capabilityCount: c.CapabilityCount,
          inventoryCount: c.InventoryCount,
          description: c.Description ?? '',
        };
      }),
      capabilities: b.capabilities.map((x): CapabilityRow => {
        let state = 'بدون تاریخ';
        let tone: Tone = 'secondary';
        if (x.QualificationDaysLeft !== null) {
          if (x.QualificationDaysLeft < 0) [state, tone] = ['منقضی', 'danger'];
          else if (x.QualificationDaysLeft <= QUALIFICATION_WARN_DAYS) [state, tone] = [`${fa(x.QualificationDaysLeft)} روز مانده`, 'warning'];
          else [state, tone] = ['معتبر', 'success'];
        }
        return {
          contractor: x.ContractorTitle,
          operation: `${x.OperationCode} — ${x.OperationTitle}`,
          product: x.ProductTitle,
          isProductGroup: x.IsProductGroup,
          capacity: `${fa(x.CapacityQuantity)} ${x.CapacityUnitTitle} در ${PERIOD_LABEL[x.CapacityPeriodCode] ?? '—'}`,
          qualifiedUntil: x.QualifiedUntilDate ? faFullDate(isoDay(x.QualifiedUntilDate)) : '—',
          qualificationState: state,
          qualificationTone: tone,
          isFuture: x.VersionStatus === 'future',
        };
      }),
      rates: b.rates.map((r): RateRow => {
        const change = r.PreviousFee ? ((r.FeePerUnit - r.PreviousFee) / r.PreviousFee) * 100 : null;
        return {
          contractor: r.ContractorTitle,
          operation: `${r.OperationCode} — ${r.OperationTitle}`,
          product: r.ProductTitle,
          isProductGroup: r.IsProductGroup,
          fee: `${fa(r.FeePerUnit)} ${r.CurrencyTitle} ${r.FeeUnitTitle}`,
          change: change === null ? '' : `${change > 0 ? '+' : ''}${fa(Math.round(change * 10) / 10)}٪ نسبت به نرخ قبل`,
          leadTime: `${fa(r.LeadTimeDays)} روز`,
          minOrder: r.MinOrderQuantity === null ? '—' : fa(r.MinOrderQuantity),
          validity: period(r.ValidFromDate, r.ValidToDate),
          status: r.VersionStatus,
          hasCapability: r.HasCapability,
          reason: r.ChangeReason ?? '—',
        };
      }),
      inventories: b.inventories.map((i) => ({
        contractor: i.ContractorTitle,
        code: i.Code,
        title: i.Title,
        type: INVENTORY_TYPE_LABEL[i.InventoryTypeCode] ?? '—',
        reference: i.ReferenceInventoryNumber ?? '—',
        linked: i.InventoryId !== null,
        description: i.Description ?? '',
      })),
      issues,
    };
  }
}
