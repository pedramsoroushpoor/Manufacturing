import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { OperationalFormLayoutComponent } from '../../../shared/operational-form-layout/operational-form-layout.component';
import {
  ATTACHMENT_NOTE,
  AUDIT_RANGE,
  BANNER_SUCCESS,
  BUSINESS_RULE_NOTE,
  CUSTOM_ENTITY_NOTE,
  CUSTOM_FIELD_BADGE,
  DEFINED_FIELDS,
  EXCEL_NOTE,
  OTHER_TOOLS,
  PREVIEW_BASE_FIELDS,
  PREVIEW_CUSTOM_FIELDS,
  PREVIEW_FORM_TARGET,
  PRINT_TEMPLATE_NOTE,
  RULE_NOTE,
  WHY_NOTE,
} from './frm-pf-04.data';

@Component({
  selector: 'gng-frm-pf-04',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent],
  templateUrl: './frm-pf-04.component.html',
})
export class FrmPf04Component {
  readonly previewFormTarget = PREVIEW_FORM_TARGET;
  readonly previewBaseFields = PREVIEW_BASE_FIELDS;
  readonly previewCustomFields = PREVIEW_CUSTOM_FIELDS;
  readonly customFieldBadge = CUSTOM_FIELD_BADGE;
  readonly otherTools = OTHER_TOOLS;
  readonly whyNote = WHY_NOTE;
  readonly definedFields = DEFINED_FIELDS;
  readonly ruleNote = RULE_NOTE;
  readonly bannerSuccess = BANNER_SUCCESS;
  readonly customEntityNote = CUSTOM_ENTITY_NOTE;
  readonly businessRuleNote = BUSINESS_RULE_NOTE;
  readonly printTemplateNote = PRINT_TEMPLATE_NOTE;
  readonly attachmentNote = ATTACHMENT_NOTE;
  readonly excelNote = EXCEL_NOTE;
  readonly auditRange = AUDIT_RANGE;

  requiredSeverity(v: string): 'danger' | 'success' | 'warning' {
    if (v === 'بله') return 'danger';
    if (v === 'شرطی') return 'warning';
    return 'success';
  }
}
