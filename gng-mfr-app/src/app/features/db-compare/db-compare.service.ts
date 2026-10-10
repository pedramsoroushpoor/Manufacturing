import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api-config';

export interface DbSchema {
  name: string;
  tableCount: number;
}

export interface DbColumn {
  name: string;
  type: string;
  nullable: boolean;
  identity: boolean;
  computed: boolean;
}

export interface DbTable {
  schema: string;
  table: string;
  columns: DbColumn[];
}

/** فقط فراداده‌ی ساختار (sys.*) را می‌خواند؛ هیچ داده‌ای از جدول‌ها نمی‌آید. */
@Injectable({ providedIn: 'root' })
export class DbCompareService {
  constructor(private readonly http: HttpClient) {}

  schemas(): Observable<DbSchema[]> {
    return this.http.get<DbSchema[]>(`${API_BASE_URL}/api/db-compare/schemas`);
  }

  tables(schemas: string[]): Observable<DbTable[]> {
    return this.http.get<DbTable[]>(`${API_BASE_URL}/api/db-compare/tables`, { params: { schemas: schemas.join(',') } });
  }
}
