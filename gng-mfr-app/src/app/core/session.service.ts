import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api-config';

const BASE = `${API_BASE_URL}/api`;
const STORAGE_KEY = 'gng-mfr.session';

export interface AuthMode {
  code: 'sql' | 'windows';
  title: string;
  needsPassword: boolean;
  needsDomain?: boolean;
}

export interface AuthModes {
  modes: AuthMode[];
  /** فقط وقتی true است که درایور بومیِ احراز هویت یکپارچه‌ی ویندوز (بدون رمز) قابل‌استفاده باشد. */
  integratedAvailable: boolean;
  note: string | null;
}

export interface SessionInfo {
  token: string;
  server: string;
  port: number;
  database: string;
  auth: 'sql' | 'windows';
  user: string;
  openedAt: string;
}

/** اتصالی که بک‌اند از gng-mfr.connections.json به‌خاطر دارد. */
export interface SavedConnection {
  id: string;
  server: string;
  port: number;
  database: string;
  auth: 'sql' | 'windows';
  user: string;
  domain: string;
  lastUsed: string;
}

export interface SavedConnections {
  file: string;
  connections: SavedConnection[];
}

export interface ConnectRequest {
  server: string;
  port?: number;
  database: string;
  auth: 'sql' | 'windows';
  user?: string;
  password?: string;
  domain?: string;
  encrypt?: boolean;
}

/**
 * اتصالی که این تب مرورگر از طریق آن کار می‌کند.
 *
 * gng-mfr-app با ورود (Login) به یک دیتابیس متصل می‌شود، نه با یک فایل
 * تنظیمات ثابت — یعنی همین بیلد می‌تواند دیتابیس تولید و یک کپی تستی را در دو
 * تب جدا باز کند. توکن در sessionStorage نگه‌داری می‌شود: با رفرش صفحه از بین
 * نمی‌رود، و با بستن تب نشست تمام می‌شود. رمز فقط یک بار، هنگام ورود، ارسال
 * می‌شود و هرگز اینجا ذخیره نمی‌شود.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  /** توسط سربرگ برنامه خوانده می‌شود تا کاربر همیشه بداند به کدام دیتابیس وصل است. */
  readonly info = signal<SessionInfo | null>(null);

  constructor(private http: HttpClient) {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.info.set(JSON.parse(saved));
      } catch {
        this.clear();
      }
    }
  }

  get token(): string | null {
    return this.info()?.token ?? null;
  }

  authModes(): Observable<AuthModes> {
    return this.http.get<AuthModes>(`${BASE}/auth-modes`);
  }

  /** فهرست در فایلی کنار خودِ API است، نه در این مرورگر — پس برای هر کسی که
   *  این نصب را باز کند یکسان است. */
  savedConnections(): Observable<SavedConnections> {
    return this.http.get<SavedConnections>(`${BASE}/connections`);
  }

  forgetConnection(id: string): Observable<SavedConnections> {
    return this.http.delete<SavedConnections>(`${BASE}/connections/${encodeURIComponent(id)}`);
  }

  connect(body: ConnectRequest): Observable<SessionInfo> {
    return this.http.post<SessionInfo>(`${BASE}/connect`, body).pipe(
      tap((session) => {
        this.info.set(session);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      })
    );
  }

  /** از سرور بخواه pool را هم ببندد، بعد در هر حال محلی هم فراموشش کن. */
  disconnect(): Observable<unknown> {
    const done = this.http.delete(`${BASE}/session`);
    return done.pipe(tap({ next: () => this.clear(), error: () => this.clear() }));
  }

  clear(): void {
    this.info.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
