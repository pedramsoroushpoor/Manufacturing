import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { AlmMenuRow, AlmSystemRow, MenuTreeNode } from '../models/menu-item.model';
import { MENU_MOCK_DATA, MENU_SYSTEMS_MOCK_DATA } from './menu.mock-data';
import { API_BASE_URL } from '../api-config';
import { resolveDomainVisual, resolveMenuIcon } from './menu-icon.util';

/**
 * MenuService — منبع فهرست سیستم‌ها و درخت منوی هر سیستم.
 *
 * از gng-mfr-api می‌خواند که خودش alm.Menu را روی GNG_AI_Dev کوئری می‌زند
 * (Angular مستقیم به SQL Server وصل نمی‌شود). یعنی هر تغییری در alm.Menu
 * (سیستم جدید، منوی جدید، تغییر عنوان، جابه‌جایی) بدون تغییر کد، با رفرش
 * صفحه در برنامه دیده می‌شود.
 *
 * اگر API در دسترس نباشد (مثلاً هنوز run-api.bat اجرا نشده)، به‌جای صفحه‌ی
 * خالی، به داده‌ی mock محلی برمی‌گردد تا توسعه/دمو بدون بک‌اند هم ممکن باشد.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  constructor(private readonly http: HttpClient) {}

  /**
   * فهرست سیستم‌های سطح صفر (مدیریت تولید، برنامه‌ریزی تولید، بهای
   * تمام‌شده، ...) — برای پر کردن پیکر انتخاب سیستم در نوار برند سایدبار.
   */
  getSystems(): Observable<AlmSystemRow[]> {
    return this.http.get<AlmSystemRow[]>(`${API_BASE_URL}/api/alm/systems`).pipe(
      catchError((err) => {
        console.warn(
          '[MenuService] اتصال به gng-mfr-api برای فهرست سیستم‌ها ناموفق بود؛ ' +
            'استفاده از داده‌ی mock. برای اتصال واقعی، run-api.bat را اجرا کنید.',
          err
        );
        return of(MENU_SYSTEMS_MOCK_DATA);
      })
    );
  }

  /** درخت منوی یک سیستم مشخص، بر اساس subSystemCode آن (از getSystems()). */
  getMenuTree(subSystemCode: string): Observable<MenuTreeNode[]> {
    return this.http
      .get<AlmMenuRow[]>(`${API_BASE_URL}/api/alm/menu`, { params: { subSystemCode } })
      .pipe(
        map((rows) => this.buildTree(rows)),
        catchError((err) => {
          console.warn(
            '[MenuService] اتصال به gng-mfr-api ناموفق بود؛ استفاده از داده‌ی mock. ' +
              'برای اتصال واقعی، run-api.bat را اجرا کنید.',
            err
          );
          return of(this.buildTree(MENU_MOCK_DATA.filter((row) => row.subSystemCode === subSystemCode)));
        })
      );
  }

  private buildTree(rows: AlmMenuRow[]): MenuTreeNode[] {
    const sorted = [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const nodeByCode = new Map<string, MenuTreeNode>();

    for (const row of sorted) {
      nodeByCode.set(row.code, {
        key: row.code,
        label: row.title,
        data: row,
        children: [],
      });
    }

    const roots: MenuTreeNode[] = [];
    for (const row of sorted) {
      const node = nodeByCode.get(row.code)!;
      if (row.parentCode && nodeByCode.has(row.parentCode)) {
        nodeByCode.get(row.parentCode)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    // رنگ و آیکون هر دامنه از گره‌ی ریشه (سطح ۱) تعیین و به همه‌ی فرزندان
    // آن دامنه ارث‌بری می‌شود — تا هر شاخه از منو رنگ اختصاصی خودش را داشته
    // باشد و آیکون هر فرم بر اساس کلیدواژه‌ی عنوانش انتخاب شود (نه یکسان).
    const applyVisuals = (nodes: MenuTreeNode[], inheritedVisual?: ReturnType<typeof resolveDomainVisual>) => {
      nodes.forEach((n) => {
        const domainVisual = n.data.menuLevel === 1 ? resolveDomainVisual(n.data) : inheritedVisual ?? resolveDomainVisual(n.data);
        n.displayIcon = resolveMenuIcon(n.data, domainVisual);
        n.displayIconColor = domainVisual.colorVar;
        if (n.children && n.children.length > 0) {
          applyVisuals(n.children, domainVisual);
        }
      });
    };
    applyVisuals(roots);

    // حذف children خالی تا PrimeNG Tree فلش انبساط بیخود نمایش ندهد
    const clean = (nodes: MenuTreeNode[]) =>
      nodes.forEach((n) => {
        if (!n.children || n.children.length === 0) {
          delete n.children;
        } else {
          clean(n.children);
        }
      });
    clean(roots);

    return roots;
  }
}
