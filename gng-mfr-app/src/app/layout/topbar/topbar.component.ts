import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ThemeService } from '../../core/services/theme.service';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'gng-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, TooltipModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  @Output() toggleSidebar = new EventEmitter<void>();

  readonly theme = inject(ThemeService);
  readonly session = inject(SessionService);

  constructor(private readonly router: Router) {}

  /** خروج: بستن اتصال فعلی و بازگشت به صفحه‌ی Login (برای دیتابیس دیگر، دوباره وارد شوید). */
  logout(): void {
    this.session.disconnect().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
