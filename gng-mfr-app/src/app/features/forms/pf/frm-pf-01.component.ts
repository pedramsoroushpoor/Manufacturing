import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { OperationalFormLayoutComponent } from '../../../shared/operational-form-layout/operational-form-layout.component';
import {
  AUDIT_RANGE,
  BANNER_DANGER,
  CALENDAR_NOTE,
  EFFECTIVE_VALUES,
  ENTITY_NOTE,
  EXTERNAL_NOTE,
  INDUSTRY_PROFILES,
  LANGUAGE_ROWS,
  MASS_BALANCE_NOTE,
  MASS_BALANCE_STAT,
  ORG_LEVELS,
  OVERRIDE_HIERARCHY,
  OVERRIDE_NOTE,
  OVERRIDE_TARGET,
  POTENCY_NOTE,
  PRECEDENCE_NOTE,
  PROFILE_RULES,
  RISK_NOTE,
  ROUNDING_ROWS,
  UNIT_ROWS,
} from './frm-pf-01.data';

@Component({
  selector: 'gng-frm-pf-01',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent],
  templateUrl: './frm-pf-01.component.html',
})
export class FrmPf01Component {
  readonly profiles = INDUSTRY_PROFILES;
  readonly effectiveValues = EFFECTIVE_VALUES;
  readonly overrideHierarchy = OVERRIDE_HIERARCHY;
  readonly overrideTarget = OVERRIDE_TARGET;
  readonly overrideNote = OVERRIDE_NOTE;
  readonly riskNote = RISK_NOTE;
  readonly bannerDanger = BANNER_DANGER;
  readonly profileRules = PROFILE_RULES;
  readonly orgLevels = ORG_LEVELS;
  readonly precedenceNote = PRECEDENCE_NOTE;
  readonly entityNote = ENTITY_NOTE;
  readonly externalNote = EXTERNAL_NOTE;
  readonly unitRows = UNIT_ROWS;
  readonly potencyNote = POTENCY_NOTE;
  readonly roundingRows = ROUNDING_ROWS;
  readonly massBalanceNote = MASS_BALANCE_NOTE;
  readonly massBalanceStat = MASS_BALANCE_STAT;
  readonly calendarNote = CALENDAR_NOTE;
  readonly languageRows = LANGUAGE_ROWS;
  readonly auditRange = AUDIT_RANGE;

  profileCardClass(active?: boolean): string {
    return active ? 'gng-profile-card gng-profile-card--active' : 'gng-profile-card';
  }

  ruleIcon(status: 'ok' | 'warn'): string {
    return status === 'ok' ? 'pi pi-check-circle gng-sym--ok' : 'pi pi-exclamation-circle gng-sym--warn';
  }
}
