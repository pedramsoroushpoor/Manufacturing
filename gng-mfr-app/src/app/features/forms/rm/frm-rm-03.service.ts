import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import {
  ConcurrencyRow,
  INDEPENDENT_LEVEL,
  MatrixCell,
  PersonnelRow,
  RequirementRow,
  SKILL_LEVEL_LABEL,
  SkillMatrix,
  SkillRow,
  VALIDITY_LABEL,
  ValidityIssueRow,
  ValidityStatus,
  WorkingGroupRow,
} from './frm-rm-03.data';
import { RmSelection, scopeQuery } from './rm-scope';

interface PersonnelApiRow {
  PersonnelId: number;
  Code: string;
  Title: string;
  PostTitle: string | null;
  OrgNodeTitle: string;
  PersonnelGroupTitle: string | null;
  WorkingGroupTitle: string | null;
  StationCount: number;
  StationsText: string | null;
  EngagementTotal: number;
  ValidSkillCount: number;
  IndependentSkillCount: number;
  NextRetrainingDate: string | null;
  MaxConcurrentStations: number;
  IsActive: boolean;
}
interface SkillApiRow {
  SkillId: number;
  Code: string;
  Title: string;
  Category: string | null;
  RetrainingIntervalMonths: number | null;
  HolderCount: number;
  IndependentCount: number;
}
interface PersonnelSkillApiRow {
  PersonnelId: number;
  SkillId: number;
  LevelCode: number;
  ValidToDate: string | null;
  RetrainingDueDate: string | null;
  ValidityStatus: ValidityStatus;
}
interface RequirementApiRow {
  OperationCode: string;
  OperationTitle: string;
  SkillCode: string;
  SkillTitle: string;
  MinLevel: number;
  EnforcementMode: 'block' | 'warn';
  QualifiedCount: number;
}
interface WorkingGroupApiRow {
  Code: string;
  Title: string;
  LineTitle: string | null;
  StationCode: string | null;
  StationTitle: string | null;
  HeadTitle: string | null;
  MemberCount: number;
  MembersText: string | null;
}
interface StationAssignmentApiRow {
  PersonnelId: number;
  Code: string;
  Title: string;
  MaxConcurrentStations: number;
  StationCode: string;
  StationTitle: string;
  LineTitle: string;
  IsHeadMember: boolean;
  EngagementPercent: number;
}
interface BundleApi {
  personnel: PersonnelApiRow[];
  skills: SkillApiRow[];
  personnelSkills: PersonnelSkillApiRow[];
  requirements: RequirementApiRow[];
  workingGroups: WorkingGroupApiRow[];
  stationAssignments: StationAssignmentApiRow[];
}

/** همه‌ی داده‌ی فرم برای یک دامنه‌ی انتخاب، با همان شکل‌هایی که قالب HTML مصرف می‌کند. */
export interface FrmRm03Bundle {
  personnel: PersonnelRow[];
  skills: SkillRow[];
  requirements: RequirementRow[];
  matrix: SkillMatrix;
  validityIssues: ValidityIssueRow[];
  workingGroups: WorkingGroupRow[];
  concurrency: ConcurrencyRow[];
}

const fa = (n: number): string => n.toLocaleString('fa-IR');

const faDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

const levelLabel = (level: number): string => SKILL_LEVEL_LABEL[level] ?? `سطح ${fa(level)}`;

/**
 * داده‌ی واقعی FRM-RM-03 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_rm03_setup.sql نگاه کنید). یک درخواست برای هر انتخاب درخت.
 */
@Injectable({ providedIn: 'root' })
export class FrmRm03Service {
  constructor(private http: HttpClient) {}

  loadScope(selection: RmSelection): Observable<FrmRm03Bundle> {
    return this.http
      .get<BundleApi>(`${API_BASE_URL}/api/rm03/bundle`, { params: scopeQuery(selection) })
      .pipe(map((b) => this.build(b)));
  }

  private build(b: BundleApi): FrmRm03Bundle {
    const personnel = b.personnel.map((p) => this.buildPerson(p));
    const skills: SkillRow[] = b.skills.map((s) => ({
      id: s.SkillId,
      code: s.Code,
      title: s.Title,
      category: s.Category ?? '—',
      retraining: s.RetrainingIntervalMonths ? `هر ${fa(s.RetrainingIntervalMonths)} ماه` : '—',
      holderCount: s.HolderCount,
      independentCount: s.IndependentCount,
    }));

    return {
      personnel,
      skills,
      requirements: b.requirements.map((r) => ({
        operation: `${r.OperationCode} — ${r.OperationTitle}`,
        skill: r.SkillTitle,
        minLevel: r.MinLevel,
        minLevelLabel: levelLabel(r.MinLevel),
        mode: r.EnforcementMode,
        qualifiedCount: r.QualifiedCount,
      })),
      matrix: this.buildMatrix(personnel, skills, b.personnelSkills),
      validityIssues: this.buildIssues(personnel, skills, b.personnelSkills),
      workingGroups: b.workingGroups.map((g) => ({
        code: g.Code,
        title: g.Title,
        assignedTo: g.StationCode
          ? `${g.LineTitle} · ایستگاه ${g.StationCode} — ${g.StationTitle}`
          : (g.LineTitle ?? 'بدون تخصیص'),
        head: g.HeadTitle ?? '—',
        memberCount: g.MemberCount,
        members: g.MembersText ?? '—',
      })),
      concurrency: this.buildConcurrency(b.stationAssignments),
    };
  }

  private buildPerson(p: PersonnelApiRow): PersonnelRow {
    return {
      id: p.PersonnelId,
      code: p.Code,
      name: p.Title,
      post: p.PostTitle ?? '—',
      orgNode: p.OrgNodeTitle,
      personnelGroup: p.PersonnelGroupTitle ?? '—',
      workingGroup: p.WorkingGroupTitle ?? '—',
      stations: p.StationsText ?? '—',
      stationCount: p.StationCount,
      maxStations: p.MaxConcurrentStations,
      engagement: p.EngagementTotal,
      validSkillCount: p.ValidSkillCount,
      independentSkillCount: p.IndependentSkillCount,
      multiSkilled: p.IndependentSkillCount >= 2,
      concurrencyViolation: p.StationCount > p.MaxConcurrentStations || p.EngagementTotal > 100,
      nextRetraining: faDate(p.NextRetrainingDate),
      active: p.IsActive,
    };
  }

  private buildMatrix(personnel: PersonnelRow[], skills: SkillRow[], rows: PersonnelSkillApiRow[]): SkillMatrix {
    const cellOf = new Map<string, MatrixCell>();
    for (const r of rows) {
      const date = r.ValidityStatus === 'expired' ? r.ValidToDate : (r.RetrainingDueDate ?? r.ValidToDate);
      cellOf.set(`${r.PersonnelId}:${r.SkillId}`, {
        level: r.LevelCode,
        levelLabel: levelLabel(r.LevelCode),
        status: r.ValidityStatus,
        hint:
          `سطح ${fa(r.LevelCode)} — ${levelLabel(r.LevelCode)} · ${VALIDITY_LABEL[r.ValidityStatus]}` +
          (date ? ` (${faDate(date)})` : ''),
      });
    }
    const matrixRows = personnel.map((person) => ({
      person,
      cells: skills.map((s) => cellOf.get(`${person.id}:${s.id}`) ?? null),
    }));
    // منقضی‌شده مهارت معتبر نیست و در پوشش شمرده نمی‌شود.
    const coverage = skills.map(
      (_, j) =>
        matrixRows.filter((r) => {
          const c = r.cells[j];
          return c !== null && c.status !== 'expired' && c.level >= INDEPENDENT_LEVEL;
        }).length
    );
    return { skills, rows: matrixRows, coverage };
  }

  private buildIssues(personnel: PersonnelRow[], skills: SkillRow[], rows: PersonnelSkillApiRow[]): ValidityIssueRow[] {
    const personOf = new Map(personnel.map((p) => [p.id, p]));
    const skillOf = new Map(skills.map((s) => [s.id, s]));
    const order: Record<ValidityStatus, number> = { expired: 0, retraining: 1, expiring: 2, valid: 3 };
    return rows
      .filter((r) => r.ValidityStatus !== 'valid')
      .sort((a, b) => order[a.ValidityStatus] - order[b.ValidityStatus])
      .map((r) => ({
        person: personOf.get(r.PersonnelId)?.name ?? '—',
        skill: skillOf.get(r.SkillId)?.title ?? '—',
        level: `${fa(r.LevelCode)} — ${levelLabel(r.LevelCode)}`,
        status: r.ValidityStatus,
        date: faDate(r.ValidityStatus === 'expired' ? r.ValidToDate : (r.RetrainingDueDate ?? r.ValidToDate)),
      }));
  }

  /** تخصیص‌های جاری هر نفر به ایستگاه‌ها، با سنجش سقف هم‌زمانی و مجموع اشتغال. */
  private buildConcurrency(rows: StationAssignmentApiRow[]): ConcurrencyRow[] {
    const byPerson = new Map<number, StationAssignmentApiRow[]>();
    for (const r of rows) {
      if (!byPerson.has(r.PersonnelId)) byPerson.set(r.PersonnelId, []);
      byPerson.get(r.PersonnelId)!.push(r);
    }
    return [...byPerson.values()].map((list) => {
      const engagement = list.reduce((sum, r) => sum + Number(r.EngagementPercent), 0);
      const max = list[0].MaxConcurrentStations;
      const reasons: string[] = [];
      if (list.length > max) reasons.push(`${fa(list.length)} ایستگاه هم‌زمان، سقف ${fa(max)}`);
      if (engagement > 100) reasons.push(`مجموع اشتغال ${fa(engagement)}٪`);
      return {
        person: `${list[0].Title} (${list[0].Code})`,
        stations: list.map((r) => ({
          label: `${r.LineTitle} · ${r.StationCode} — ${r.StationTitle}`,
          percent: Number(r.EngagementPercent),
          head: r.IsHeadMember,
        })),
        stationCount: list.length,
        maxStations: max,
        engagement,
        violation: reasons.length > 0,
        reason: reasons.join(' · '),
      };
    });
  }
}
