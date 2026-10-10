import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SessionService, AuthMode, AuthModes, SavedConnection } from '../../core/session.service';

/**
 * صفحه‌ی اتصال. همان چیزی را می‌پرسد که SQL Server Management Studio
 * می‌پرسد — سرور، دیتابیس، نوع احراز هویت، اطلاعات ورود — چون کاربران این
 * سیستم فنی هستند و از قبل با همین مفاهیم آشنا هستند.
 *
 * نکته‌ی اصلی صفحه این است که چند سرور وجود دارد، پس سرورهای قبلی فهرست
 * می‌شوند: با یک کلیک فرم پر می‌شود، یا می‌توان سروری تازه تایپ کرد. آن فهرست
 * در فایلی کنار خودِ gng-mfr-api ذخیره می‌شود (نه این مرورگر و نه یک
 * دیتابیس)، پس برای هر کسی که این نصب را باز کند یکسان است و با پاک‌شدن کش هم
 * از بین نمی‌رود. فقط آدرس و نام کاربری در آن ذخیره می‌شود؛ رمز هرگز.
 *
 * دو حالت احراز هویت به‌صورت ثابت در کد هستند نه فقط از سرور خوانده‌شده، تا
 * وقتی بک‌اند در دسترس نیست فهرست خالی نباشد — آن حالت خودش پیام روشن‌تری
 * دارد.
 */
@Component({
  selector: 'gng-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CheckboxModule,
    MessageModule,
    RadioButtonModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  /**
   * مقدار واقعی، نه فقط placeholder. در نسخه‌ی اول این مقادیر فقط راهنمای
   * خاکستری روی فیلد خالی بودند — چون دقیقاً شبیه یک مقدار واقعی به‌نظر
   * می‌رسیدند (نه متن راهنمای عمومی)، کاربر فکر می‌کرد از قبل پر شده و
   * نمی‌فهمید چرا «نام سرور و دیتابیس لازم است» می‌گیرد. حالا واقعاً از قبل
   * پر است تا این ابهام از بین برود؛ اگر اتصال‌های قبلی هم موجود باشند،
   * ngOnInit با آخرین‌شان جایگزین می‌کند.
   */
  // از این پس دیتابیس کاری پیش‌فرض این پروژه MNG_System روی 172.31.1.200
  // است (طبق تصمیم صریح کاربر برای ادامه‌ی توسعه‌ی پله‌به‌پله)؛ اگر
  // اتصالی قبلاً استفاده شده باشد، ngOnInit همان را (که معمولاً همین است)
  // جایگزین می‌کند، ولی این مقادیر همان چیزی هستند که حتی در اولین اجرا
  // روی یک نصب تازه هم باید دیده شوند.
  server = '172.31.1.200';
  port: number | null = 1433;
  database = 'MNG_System';
  auth: 'sql' | 'windows' = 'windows';
  user = 'Soroushpour.pedram';
  password = '';
  domain = 'GIG';
  encrypt = false;

  /** ثابت در کد، تا انتخاب حتی با خاموش‌بودن بک‌اند هم خالی نباشد. */
  modes: AuthMode[] = [
    { code: 'sql', title: 'SQL Server Authentication', needsPassword: true },
    { code: 'windows', title: 'Windows Authentication', needsPassword: true, needsDomain: true },
  ];
  integratedAvailable = false;
  note: string | null = null;
  recents: SavedConnection[] = [];
  connectionsFile = '';
  error = '';
  busy = false;

  constructor(
    private session: SessionService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  get knownServers(): string[] {
    return [...new Set(this.recents.map((r) => r.server))];
  }

  get knownDatabases(): string[] {
    return [...new Set(this.recents.map((r) => r.database))];
  }

  describe(m: AuthMode): string {
    if (m.code === 'sql') return 'لاگین تعریف‌شده در خود SQL Server';
    return this.integratedAvailable ? 'با حساب ویندوز' : 'با حساب ویندوز — دامنه، نام کاربری و رمز لازم است';
  }

  ngOnInit(): void {
    this.session.savedConnections().subscribe({
      next: (v) => {
        this.recents = v.connections ?? [];
        this.connectionsFile = v.file;
        // اتصال آخر واقعاً استفاده‌شده، اگر موجود باشد، بر مقدار پیش‌فرض هاردکد بالا اولویت دارد.
        if (this.recents.length) this.use(this.recents[0]);
      },
      error: () => {
        /* درخواست auth-modes خودش پیام خاموش‌بودن بک‌اند را نشان می‌دهد */
      },
    });

    this.session.authModes().subscribe({
      next: (m: AuthModes) => {
        if (m.modes?.length) this.modes = m.modes;
        this.integratedAvailable = m.integratedAvailable;
        this.note = m.note;
      },
      error: () => {
        this.error =
          'بک‌اند روی پورت ۴۳۱۱ پاسخ نمی‌دهد یا نسخه‌ی قدیمی است. ' +
          'پنجره‌ی «gng-mfr-api» را ببندید و RUN-API.ps1 را دوباره اجرا کنید.';
      },
    });
  }

  isCurrent(r: SavedConnection): boolean {
    return r.server === this.server && r.database === this.database;
  }

  use(r: SavedConnection): void {
    this.server = r.server;
    this.port = r.port;
    this.database = r.database;
    this.auth = r.auth;
    this.user = r.user;
    // باگ پیدا‌شده: اتصال‌های SQL Auth حافظه‌شده مقدار دامنه‌شان همیشه ''
    // است؛ اگر این‌جا این مقدار خالی مستقیم روی this.domain بنشیند، کاربری
    // که بعداً به کارت Windows Authentication سوییچ می‌کند فیلد دامنه‌اش
    // واقعاً خالی می‌ماند ولی چون placeholder هم «GIG» است ظاهراً پر به‌نظر
    // می‌رسد — و submit() با خطای «نام دامنه لازم است» رد می‌شود بدون
    // این‌که کاربر بفهمد چرا (خودِ همین باگ در فیلد اجرا شد). پس مقدار خالی
    // را نادیده می‌گیریم و پیش‌فرض GIG را نگه می‌داریم.
    this.domain = r.domain || 'GIG';
    this.password = '';
  }

  forget(r: SavedConnection, ev: Event): void {
    ev.stopPropagation();
    this.session.forgetConnection(r.id).subscribe({
      next: (v) => (this.recents = v.connections ?? []),
      error: () => (this.recents = this.recents.filter((x) => x.id !== r.id)),
    });
  }

  submit(): void {
    this.error = '';
    if (!this.server.trim() || !this.database.trim()) {
      this.error = 'نام سرور و نام دیتابیس لازم است.';
      return;
    }
    if (!this.user.trim()) {
      this.error = 'نام کاربری لازم است.';
      return;
    }
    if (this.auth === 'windows' && !this.domain.trim() && !this.integratedAvailable) {
      this.error = 'برای احراز هویت ویندوزی، نام دامنه لازم است.';
      return;
    }

    this.busy = true;
    this.session
      .connect({
        server: this.server.trim(),
        port: Number(this.port) || 1433,
        database: this.database.trim(),
        auth: this.auth,
        user: this.user.trim(),
        password: this.password,
        domain: this.domain.trim(),
        encrypt: this.encrypt,
      })
      .subscribe({
        next: () => {
          this.busy = false;
          const next = this.route.snapshot.queryParamMap.get('next');
          this.router.navigateByUrl(next && next !== '/login' ? next : '/');
        },
        error: (e) => {
          this.busy = false;
          // پیام دقیق‌تر برای عیب‌یابی: اگر status صفر باشد یعنی درخواست
          // اصلاً به بک‌اند نرسیده (شبکه/CORS)، نه این‌که بک‌اند رد کرده
          // باشد — این تفاوت مهمی است که پیام قبلی نشان نمی‌داد.
          const detail = e?.error?.error || e?.message || e?.statusText || '(بدون جزئیات)';
          const status = e?.status ?? '?';
          this.error = `اتصال برقرار نشد — HTTP ${status} — ${detail}`;
        },
      });
  }
}
