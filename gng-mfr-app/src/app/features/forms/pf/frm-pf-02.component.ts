import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { OperationalFormLayoutComponent } from '../../../shared/operational-form-layout/operational-form-layout.component';
import {
  ATOMIC_NOTE,
  AUDIT_RANGE,
  BANNER_SUCCESS,
  DIFF_ROWS,
  ECO_INDEPENDENT_NOTE,
  EFFECTIVITY_TYPES,
  IMPACT_ANALYSIS_NOTE,
  LIFECYCLE_RULES,
  LIFECYCLE_STAGES,
  STAT_ACTIVE_VERSIONS,
  STAT_OPEN_ECO,
  TIMELINE_BLOCKS,
  TIMELINE_MONTHS,
  TIMELINE_NOTE,
  TIMELINE_TODAY_PCT,
  WIP_POLICIES,
} from './frm-pf-02.data';

@Component({
  selector: 'gng-frm-pf-02',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent],
  templateUrl: './frm-pf-02.component.html',
})
export class FrmPf02Component {
  readonly timelineBlocks = TIMELINE_BLOCKS;
  readonly timelineMonths = TIMELINE_MONTHS;
  readonly timelineTodayPct = TIMELINE_TODAY_PCT;
  readonly timelineNote = TIMELINE_NOTE;
  readonly bannerSuccess = BANNER_SUCCESS;
  readonly lifecycleStages = LIFECYCLE_STAGES;
  readonly lifecycleRules = LIFECYCLE_RULES;
  readonly wipPolicies = WIP_POLICIES;
  readonly statOpenEco = STAT_OPEN_ECO;
  readonly statActiveVersions = STAT_ACTIVE_VERSIONS;
  readonly effectivityTypes = EFFECTIVITY_TYPES;
  readonly diffRows = DIFF_ROWS;
  readonly ecoIndependentNote = ECO_INDEPENDENT_NOTE;
  readonly impactAnalysisNote = IMPACT_ANALYSIS_NOTE;
  readonly atomicNote = ATOMIC_NOTE;
  readonly auditRange = AUDIT_RANGE;

  readonly rows = [0, 1, 2, 3];

  blocksInRow(row: number) {
    return this.timelineBlocks.filter((b) => b.row === row);
  }

  blockStyle(b: { startPct: number; widthPct: number }): string {
    return `margin-right: ${b.startPct}%; width: ${b.widthPct}%;`;
  }

  changeSeverity(change: string): 'secondary' | 'success' | 'danger' {
    if (change === 'افزوده') return 'success';
    if (change === 'حذف‌شده') return 'danger';
    return 'secondary';
  }
}
