import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-config';

/** مشخصات فرم — alm.Form به‌همراه عنوان کدهای مرجع. */
export interface AlmFormHeader {
  code: string;
  title: string;
  subSystemCode: string | null;
  subSystemTitle: string | null;
  analysisDocumentCode: string | null;
  analysisDocumentTitle: string | null;
  formTypeCode: string | null;
  formTypeTitle: string | null;
  phaseCode: string | null;
  phaseTitle: string | null;
  primaryAccessGroupCode: string | null;
  otherAccessGroupsText: string | null;
  tabsDescription: string | null;
  tabCount: number | null;
  actionCount: number | null;
  featureCount: number | null;
  estimateFromFeatures: number | null;
  overheadEstimate: number | null;
  totalEstimate: number | null;
  designOwner: string | null;
  note: string | null;
}

/** یک فیچرِ نگاشت‌شده به فرم — alm.FormFeatureMapping ⨝ alm.Feature. */
export interface AlmFormFeature {
  mappingCode: string;
  featureCode: string;
  requirement: string | null;
  title: string | null;
  extraInfo: string | null;
  module: string | null;
  artifactTypeCode: string | null;
  artifactTypeTitle: string | null;
  priorityCode: string | null;
  priorityTitle: string | null;
  phaseCode: string | null;
  phaseTitle: string | null;
  complexityCode: string | null;
  complexityTitle: string | null;
  industryTitle: string | null;
  effortDays: number | null;
  /** NULL یعنی توسعه‌ی این فیچر هنوز شروع نشده. */
  devStatusCode: string | null;
  devStatusTitle: string | null;
  devStatusColor: string | null;
  note: string | null;
}

/** یک سطر ماتریس دسترسی — alm.FormAccess. */
export interface AlmFormAccess {
  code: string;
  userGroupCode: string;
  allowRetrieve: boolean;
  allowCreate: boolean;
  allowModify: boolean;
  allowRemove: boolean;
  allowExecute: boolean;
  note: string | null;
}

/** یک عملیات فرم — alm.FormAction. */
export interface AlmFormAction {
  code: string;
  title: string;
  requiredPermission: string | null;
  actionTypeCode: string | null;
  actionTypeTitle: string | null;
  note: string | null;
}

/** خلاصه‌ی پوشش فیچر یک فرم — نشان کنار «کد فرم». */
export interface AlmFormCoverage {
  /** تعداد فیچرهایی که فرم باید پوشش دهد. */
  total: number;
  /** فیچرهایی که در فرم پیاده شده‌اند (در حال کار یا تحویل‌شده). */
  implemented: number;
  delivered: number;
}

export interface AlmFormSpec {
  form: AlmFormHeader;
  features: AlmFormFeature[];
  access: AlmFormAccess[];
  actions: AlmFormAction[];
}

/**
 * شناسنامه‌ی فرم در ALM (اسکیمای alm) — منبع صفحه‌ی «مشخصات فرم» که با کلیک
 * روی کد فرم در تب جدا باز می‌شود. عمداً fallback به mock ندارد: این صفحه
 * سندِ طراحی است و داده‌ی ساختگی در آن گمراه‌کننده می‌شود.
 */
@Injectable({ providedIn: 'root' })
export class AlmFormSpecService {
  constructor(private readonly http: HttpClient) {}

  coverage(formCode: string): Observable<AlmFormCoverage> {
    return this.http.get<AlmFormCoverage>(`${API_BASE_URL}/api/alm/forms/${encodeURIComponent(formCode)}/coverage`);
  }

  load(formCode: string): Observable<AlmFormSpec> {
    return this.http.get<AlmFormSpec>(`${API_BASE_URL}/api/alm/forms/${encodeURIComponent(formCode)}`);
  }
}

/** نشانی صفحه‌ی مشخصات فرم — با احترام به base href برنامه. */
export function almFormSpecUrl(formCode: string): string {
  const base = document.querySelector('base')?.getAttribute('href') ?? '/';
  return `${base.replace(/\/$/, '')}/alm/forms/${encodeURIComponent(formCode)}`;
}

/**
 * باز کردن مشخصات فرم در تب جدا. عمداً window.open (نه لینک target=_blank):
 * لینک‌های _blank در مرورگرهای امروزی noopener هستند و sessionStorage — که
 * نشست اتصال دیتابیس در آن است — به تب جدید کپی نمی‌شود.
 */
export function openAlmFormSpec(formCode: string): void {
  if (formCode) window.open(almFormSpecUrl(formCode), '_blank');
}
