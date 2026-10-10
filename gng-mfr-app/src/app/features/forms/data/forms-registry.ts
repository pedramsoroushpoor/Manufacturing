import { Type } from '@angular/core';
import { FormShellConfig } from '../../../core/models/form-shell.model';
import { RM_FORMS } from './rm-forms.data';
import { PE_FORMS } from './pe-forms.data';
import { ME_FORMS } from './me-forms.data';
import { PC_FORMS } from './pc-forms.data';
import { PF_FORMS } from './pf-forms.data';
import { FrmRm01Component } from '../rm/frm-rm-01.component';
import { FrmRm02Component } from '../rm/frm-rm-02.component';
import { FrmRm03Component } from '../rm/frm-rm-03.component';
import { FrmRm04Component } from '../rm/frm-rm-04.component';
import { FrmRm05Component } from '../rm/frm-rm-05.component';
import { FrmRm06Component } from '../rm/frm-rm-06.component';
import { FrmRm07Component } from '../rm/frm-rm-07.component';
import { FrmRm08Component } from '../rm/frm-rm-08.component';
import { FrmRm09Component } from '../rm/frm-rm-09.component';
import { FrmPe01Component } from '../pe/frm-pe-01.component';
import { FrmPe02Component } from '../pe/frm-pe-02.component';
import { FrmPe03Component } from '../pe/frm-pe-03.component';
import { FrmPe04Component } from '../pe/frm-pe-04.component';
import { FrmPe05Component } from '../pe/frm-pe-05.component';
import { FrmPe06Component } from '../pe/frm-pe-06.component';
import { FrmPe07Component } from '../pe/frm-pe-07.component';
import { FrmPe08Component } from '../pe/frm-pe-08.component';
import { FrmPe09Component } from '../pe/frm-pe-09.component';
import { FrmPe10Component } from '../pe/frm-pe-10.component';
import { FrmMe01Component } from '../me/frm-me-01.component';
import { FrmMe02Component } from '../me/frm-me-02.component';
import { FrmMe03Component } from '../me/frm-me-03.component';
import { FrmMe04Component } from '../me/frm-me-04.component';
import { FrmMe05Component } from '../me/frm-me-05.component';
import { FrmMe06Component } from '../me/frm-me-06.component';
import { FrmMe07Component } from '../me/frm-me-07.component';
import { FrmMe08Component } from '../me/frm-me-08.component';
import { FrmMe09Component } from '../me/frm-me-09.component';
import { FrmMe10Component } from '../me/frm-me-10.component';
import { FrmMe11Component } from '../me/frm-me-11.component';
import { FrmPc01Component } from '../pc/frm-pc-01.component';
import { FrmPc02Component } from '../pc/frm-pc-02.component';
import { FrmPc03Component } from '../pc/frm-pc-03.component';
import { FrmPc04Component } from '../pc/frm-pc-04.component';
import { FrmPc05Component } from '../pc/frm-pc-05.component';
import { FrmPc06Component } from '../pc/frm-pc-06.component';
import { FrmPc07Component } from '../pc/frm-pc-07.component';
import { FrmPc08Component } from '../pc/frm-pc-08.component';
import { FrmPc09Component } from '../pc/frm-pc-09.component';
import { FrmPc10Component } from '../pc/frm-pc-10.component';
import { FrmPc11Component } from '../pc/frm-pc-11.component';
import { FrmPc12Component } from '../pc/frm-pc-12.component';
import { FrmPc13Component } from '../pc/frm-pc-13.component';
import { FrmPf01Component } from '../pf/frm-pf-01.component';
import { FrmPf02Component } from '../pf/frm-pf-02.component';
import { FrmPf03Component } from '../pf/frm-pf-03.component';
import { FrmPf04Component } from '../pf/frm-pf-04.component';
import { FrmPf05Component } from '../pf/frm-pf-05.component';
import { FrmPf06Component } from '../pf/frm-pf-06.component';
import { FrmPf07Component } from '../pf/frm-pf-07.component';

/**
 * رجیستری مرکزی همه‌ی فرم‌های پروتوتایپ، بر اساس FormCode (کلید یکتا در
 * alm.Form). هر حوزه (RM/PE/ME/PC/PF) فایل داده‌ی خودش را دارد و اینجا فقط
 * merge می‌شود — افزودن حوزه‌ی بعدی یعنی صرفاً یک import و یک ...spread
 * جدید، بدون تغییر در FormPageComponent یا روت‌ها.
 */
const ALL_FORMS: FormShellConfig[] = [...RM_FORMS, ...PE_FORMS, ...ME_FORMS, ...PC_FORMS, ...PF_FORMS];

export const FORMS_BY_CODE = new Map<string, FormShellConfig>(ALL_FORMS.map((f) => [f.code, f]));

export function getFormConfig(formCode: string | null | undefined): FormShellConfig | undefined {
  if (!formCode) return undefined;
  return FORMS_BY_CODE.get(formCode);
}

/**
 * فرم‌هایی که از پوسته‌ی عمومی (FormShellComponent) فراتر رفته و به یک
 * کامپوننت اختصاصیِ «عملیاتی و کامل» تبدیل شده‌اند — نتیجه‌ی مرحله‌ی
 * چکش‌کاری با کاربر. الگوی این کامپوننت‌ها روی بقیه‌ی فرم‌های هم‌نوع تکرار
 * می‌شود؛ اضافه‌شدن هر کدام فقط یک entry اینجا لازم دارد.
 */
const DETAILED_FORM_COMPONENTS: Record<string, Type<unknown>> = {
  'FRM-RM-01': FrmRm01Component,
  'FRM-RM-02': FrmRm02Component,
  'FRM-RM-03': FrmRm03Component,
  'FRM-RM-04': FrmRm04Component,
  'FRM-RM-05': FrmRm05Component,
  'FRM-RM-06': FrmRm06Component,
  'FRM-RM-07': FrmRm07Component,
  'FRM-RM-08': FrmRm08Component,
  'FRM-RM-09': FrmRm09Component,
  'FRM-PE-01': FrmPe01Component,
  'FRM-PE-02': FrmPe02Component,
  'FRM-PE-03': FrmPe03Component,
  'FRM-PE-04': FrmPe04Component,
  'FRM-PE-05': FrmPe05Component,
  'FRM-PE-06': FrmPe06Component,
  'FRM-PE-07': FrmPe07Component,
  'FRM-PE-08': FrmPe08Component,
  'FRM-PE-09': FrmPe09Component,
  'FRM-PE-10': FrmPe10Component,
  'FRM-ME-01': FrmMe01Component,
  'FRM-ME-02': FrmMe02Component,
  'FRM-ME-03': FrmMe03Component,
  'FRM-ME-04': FrmMe04Component,
  'FRM-ME-05': FrmMe05Component,
  'FRM-ME-06': FrmMe06Component,
  'FRM-ME-07': FrmMe07Component,
  'FRM-ME-08': FrmMe08Component,
  'FRM-ME-09': FrmMe09Component,
  'FRM-ME-10': FrmMe10Component,
  'FRM-ME-11': FrmMe11Component,
  'FRM-PC-01': FrmPc01Component,
  'FRM-PC-02': FrmPc02Component,
  'FRM-PC-03': FrmPc03Component,
  'FRM-PC-04': FrmPc04Component,
  'FRM-PC-05': FrmPc05Component,
  'FRM-PC-06': FrmPc06Component,
  'FRM-PC-07': FrmPc07Component,
  'FRM-PC-08': FrmPc08Component,
  'FRM-PC-09': FrmPc09Component,
  'FRM-PC-10': FrmPc10Component,
  'FRM-PC-11': FrmPc11Component,
  'FRM-PC-12': FrmPc12Component,
  'FRM-PC-13': FrmPc13Component,
  'FRM-PF-01': FrmPf01Component,
  'FRM-PF-02': FrmPf02Component,
  'FRM-PF-03': FrmPf03Component,
  'FRM-PF-04': FrmPf04Component,
  'FRM-PF-05': FrmPf05Component,
  'FRM-PF-06': FrmPf06Component,
  'FRM-PF-07': FrmPf07Component,
};

export function getDetailedFormComponent(formCode: string | null | undefined): Type<unknown> | undefined {
  if (!formCode) return undefined;
  return DETAILED_FORM_COMPONENTS[formCode];
}
