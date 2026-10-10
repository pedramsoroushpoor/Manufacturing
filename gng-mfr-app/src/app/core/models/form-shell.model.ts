/**
 * مدل عمومی «پوسته‌ی فرم» (Form Shell) — برای فاز پروتوتایپ (گزینه‌ی ۱).
 *
 * هدف: به‌جای ساخت یک کامپوننت مجزا برای هر یک از ۴۷ فرم alm.Form، یک
 * رندرر عمومی (FormShellComponent) داریم که پیکربندی هر فرم را از این مدل
 * می‌خواند. تب‌ها عیناً از alm.Form.TabsDescription می‌آیند و چک‌لیست
 * فیچرها عیناً از alm.FormFeatureMapping + alm.Feature — یعنی هیچ داده‌ای
 * در این مدل حدسی نیست، هرچند طراحی دقیق فیلدهای داخل هر تب هنوز انجام
 * نشده (دقیقاً هدف مرحله‌ی «چکش‌کاری پروتوتایپ»).
 */

export type FeatureArtifactType =
  | 'BasicForm'
  | 'SpecializedUI'
  | 'ReportDashboard'
  | 'CalcEngine'
  | 'ServiceIntegration'
  | 'PlatformInfra';

export type FeaturePriority = 'M' | 'S' | 'C';
export type FeatureComplexity = 'Simple' | 'Medium' | 'Complex' | 'VeryComplex';

/** یک ردیف از alm.FormFeatureMapping ⨝ alm.Feature */
export interface FormFeatureRow {
  code: string; // alm.Feature.Code, مثل F-RM-006
  requirement: string; // alm.Feature.Requirement, مثل RM-STR-006
  title: string; // alm.Feature.Title
  artifactType: FeatureArtifactType;
  priority: FeaturePriority;
  complexity: FeatureComplexity;
}

/** پیکربندی کامل یک فرم برای رندر توسط FormShellComponent */
export interface FormShellConfig {
  code: string; // alm.Form.Code, مثل FRM-RM-01
  title: string; // alm.Form.Title
  formTypeCode: string; // alm.Form.FormTypeCode
  domainCode: string; // پیشوند alm.AnalysisDocument.DocumentPrefix, مثل RM
  domainTitle: string; // عنوان حوزه، مثل «مدیریت منابع»
  /** برچسب‌های تب، عیناً از alm.Form.TabsDescription (جداشده با «·») */
  tabLabels: string[];
  /** چک‌لیست فیچرهای این فرم، از alm.FormFeatureMapping */
  features: FormFeatureRow[];
}
