import { DbColumn, DbTable } from './db-compare.service';

export type ColumnStatus = 'same' | 'different' | 'left-only' | 'right-only';
export type PairStatus = 'same' | 'different' | 'left-only' | 'right-only';

export interface ColumnDiff {
  name: string;
  left: DbColumn | null;
  right: DbColumn | null;
  status: ColumnStatus;
  /** وقتی هر دو طرف هست ولی فرق دارد: چه چیزی فرق دارد. */
  reason: string;
}

export interface TablePair {
  key: string;
  name: string;
  left: DbTable | null;
  right: DbTable | null;
  status: PairStatus;
  columns: ColumnDiff[];
  sameCount: number;
  differentCount: number;
  leftOnlyCount: number;
  rightOnlyCount: number;
}

/** ستون‌های استاندارد پایان همه‌ی جدول‌ها — با «نادیده گرفتن» از مقایسه کنار می‌روند. */
export const STANDARD_COLUMNS = new Set(
  ['CompanyId', 'BranchId', 'RecGuid', 'OwnerId', 'CreatedBy', 'CreatedOn', 'ModifiedBy', 'ModifiedOn', 'StateCode', 'IsDeleted', 'RowVersion'].map(
    (c) => c.toLowerCase()
  )
);

export function columnText(c: DbColumn): string {
  return `${c.type}${c.identity ? ' identity' : ''}${c.computed ? ' computed' : ''} ${c.nullable ? 'NULL' : 'NOT NULL'}`;
}

function diffColumns(left: DbTable | null, right: DbTable | null, ignoreStandard: boolean): ColumnDiff[] {
  const keep = (c: DbColumn) => !ignoreStandard || !STANDARD_COLUMNS.has(c.name.toLowerCase());
  const leftCols = (left?.columns ?? []).filter(keep);
  const rightCols = (right?.columns ?? []).filter(keep);
  const rightByName = new Map(rightCols.map((c) => [c.name.toLowerCase(), c]));
  const seen = new Set<string>();
  const out: ColumnDiff[] = [];

  // ترتیب: ستون‌های چپ به ترتیب خودشان، بعد ستون‌هایی که فقط راست دارد.
  for (const l of leftCols) {
    const key = l.name.toLowerCase();
    seen.add(key);
    const r = rightByName.get(key) ?? null;
    if (!r) {
      out.push({ name: l.name, left: l, right: null, status: 'left-only', reason: '' });
      continue;
    }
    const reasons: string[] = [];
    if (l.type !== r.type) reasons.push('نوع');
    if (l.nullable !== r.nullable) reasons.push('NULL');
    if (l.identity !== r.identity) reasons.push('identity');
    out.push({ name: l.name, left: l, right: r, status: reasons.length ? 'different' : 'same', reason: reasons.join('، ') });
  }
  for (const r of rightCols) {
    if (!seen.has(r.name.toLowerCase())) out.push({ name: r.name, left: null, right: r, status: 'right-only', reason: '' });
  }
  return out;
}

function makePair(left: DbTable | null, right: DbTable | null, ignoreStandard: boolean): TablePair {
  const columns = diffColumns(left, right, ignoreStandard);
  const count = (s: ColumnStatus) => columns.filter((c) => c.status === s).length;
  const differentCount = count('different');
  const leftOnlyCount = count('left-only');
  const rightOnlyCount = count('right-only');
  const status: PairStatus = !right
    ? 'left-only'
    : !left
      ? 'right-only'
      : differentCount + leftOnlyCount + rightOnlyCount === 0
        ? 'same'
        : 'different';
  return {
    key: `${left ? left.schema + '.' + left.table : '-'}|${right ? right.schema + '.' + right.table : '-'}`,
    name: (left ?? right)!.table,
    left,
    right,
    status,
    columns,
    sameCount: count('same'),
    differentCount,
    leftOnlyCount,
    rightOnlyCount,
  };
}

/**
 * جدول‌های هم‌نام را روبه‌روی هم می‌گذارد (بدون حساسیت به بزرگی/کوچکی حروف).
 * اگر یک نام در چند اسکیمای همان طرف باشد، هر ترکیب یک ردیف می‌گیرد.
 */
export function pairTables(left: DbTable[], right: DbTable[], ignoreStandard: boolean): TablePair[] {
  const group = (tables: DbTable[]) => {
    const m = new Map<string, DbTable[]>();
    for (const t of tables) {
      const key = t.table.toLowerCase();
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    return m;
  };
  const l = group(left);
  const r = group(right);
  const names = [...new Set([...l.keys(), ...r.keys()])].sort((a, b) => a.localeCompare(b));

  const pairs: TablePair[] = [];
  for (const name of names) {
    const ls = l.get(name) ?? [];
    const rs = r.get(name) ?? [];
    if (ls.length && rs.length) {
      for (const a of ls) for (const b of rs) pairs.push(makePair(a, b, ignoreStandard));
    } else if (ls.length) {
      for (const a of ls) pairs.push(makePair(a, null, ignoreStandard));
    } else {
      for (const b of rs) pairs.push(makePair(null, b, ignoreStandard));
    }
  }
  return pairs;
}
