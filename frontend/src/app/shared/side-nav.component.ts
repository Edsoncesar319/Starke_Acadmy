import { NgClass } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { PortalDataService } from '../services/portal-data.service';
import { SideNavLayoutService } from '../services/side-nav-layout.service';
import { StarkeLogoComponent } from './starke-logo.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [NgClass, MatIconModule, RouterLink, RouterLinkActive, StarkeLogoComponent],
  template: `
    @if (layout.mobileOpen() && !layout.isDesktop()) {
      <button
        type="button"
        class="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px] lg:hidden"
        aria-label="Fechar menu"
        (click)="layout.closeMobile()"
      ></button>
    }

    <aside
      class="fixed left-0 top-0 z-50 flex h-[100dvh] max-h-screen flex-col border-r border-gold-500/20 bg-obsidian-gradient shadow-2xl transition-transform duration-300 ease-in-out lg:z-40 lg:shadow-none"
      [ngClass]="asideClass()"
      [attr.aria-expanded]="layout.isDesktop() ? !layout.collapsed() : layout.mobileOpen()"
      [attr.aria-hidden]="!layout.isDesktop() && !layout.mobileOpen()"
    >
      <div
        class="mb-4 flex shrink-0 items-center border-b border-gold-500/10 pb-4 lg:mb-6 lg:border-0 lg:pb-0"
        [ngClass]="layout.collapsed() && layout.isDesktop() ? 'justify-center' : 'justify-between gap-2'"
      >
        <app-starke-logo
          size="sm"
          [showTitle]="layout.isDesktop() ? !layout.collapsed() : true"
          [containerClass]="layout.collapsed() && layout.isDesktop() ? '' : 'min-w-0 flex-1'"
        />
        @if (!layout.isDesktop()) {
          <button
            type="button"
            (click)="layout.closeMobile()"
            class="rounded-lg border border-gold-500/25 p-2 text-gold-300 transition hover:bg-gold-500/10"
            aria-label="Fechar menu"
          >
            <mat-icon class="material-symbols-rounded">close</mat-icon>
          </button>
        } @else if (!layout.collapsed()) {
          <button
            type="button"
            (click)="layout.toggle()"
            class="hidden rounded-lg border border-gold-500/25 p-2 text-gold-300 transition hover:bg-gold-500/10 lg:inline-flex"
            title="Recolher menu"
            aria-label="Recolher menu lateral"
          >
            <mat-icon class="material-symbols-rounded">chevron_left</mat-icon>
          </button>
        }
      </div>

      <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        @for (item of navItems(); track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="bg-gold-500/15 text-gold-300"
            [title]="layout.collapsed() && layout.isDesktop() ? item.label : ''"
            (click)="onNavigate()"
            class="group relative flex min-h-[44px] items-center rounded-lg text-sm text-slate-300 transition hover:bg-gold-500/10 hover:text-gold-300"
            [ngClass]="
              layout.collapsed() && layout.isDesktop()
                ? 'justify-center px-2 py-3'
                : 'justify-between px-4 py-3'
            "
          >
            <span class="flex min-w-0 items-center gap-3">
              <span class="nav-item-icon">
                <mat-icon class="material-symbols-rounded">{{ item.icon }}</mat-icon>
              </span>
              @if (!layout.collapsed() || !layout.isDesktop()) {
                <span class="truncate">{{ item.label }}</span>
              }
            </span>
            @if ((!layout.collapsed() || !layout.isDesktop()) && item.path === '/dashboard' && data.unreadMessagesCount() > 0) {
              <span
                class="min-w-5 shrink-0 rounded-full bg-gold-500 px-2 py-0.5 text-center text-xs font-semibold text-obsidian-900"
                [attr.aria-label]="data.unreadMessagesCount() + ' novas mensagens'"
              >
                {{ data.unreadMessagesCount() }}
              </span>
            }
            @if (layout.collapsed() && layout.isDesktop() && item.path === '/dashboard' && data.unreadMessagesCount() > 0) {
              <span
                class="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold-500"
                [attr.aria-label]="data.unreadMessagesCount() + ' novas mensagens'"
              ></span>
            }
          </a>
        }
      </nav>

      @if (layout.isDesktop()) {
        <button
          type="button"
          (click)="layout.toggle()"
          class="mt-4 flex w-full shrink-0 items-center rounded-lg border border-gold-500/25 text-gold-300 transition hover:bg-gold-500/10"
          [ngClass]="layout.collapsed() ? 'justify-center p-2.5' : 'gap-2 px-3 py-2.5 text-xs'"
          [attr.aria-label]="layout.collapsed() ? 'Expandir menu' : 'Recolher menu'"
          [title]="layout.collapsed() ? 'Expandir menu' : 'Recolher menu'"
        >
          <mat-icon
            class="material-symbols-rounded shrink-0 transition-transform duration-300"
            [class.rotate-180]="layout.collapsed()"
          >
            chevron_left
          </mat-icon>
          @if (!layout.collapsed()) {
            <span>Recolher menu</span>
          }
        </button>
      }
    </aside>
  `,
})
export class SideNavComponent implements OnInit, OnDestroy {
  readonly data = inject(PortalDataService);
  readonly layout = inject(SideNavLayoutService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  private readonly studentNav: NavItem[] = [
    { path: '/dashboard', label: 'Painel', icon: 'space_dashboard' },
    { path: '/catalog', label: 'Catálogo de Cursos', icon: 'menu_book' },
    { path: '/pagamentos', label: 'Meus Pagamentos', icon: 'payments' },
    { path: '/lesson-player', label: 'Aulas', icon: 'play_circle' },
    { path: '/support', label: 'Central de Ajuda', icon: 'support_agent' },
    { path: '/profile', label: 'Meu Perfil', icon: 'person' },
  ];

  private readonly instructorNav: NavItem[] = [
    { path: '/lesson-player', label: 'Gerenciar Aulas', icon: 'video_library' },
    { path: '/profile', label: 'Meu Perfil', icon: 'person' },
  ];

  readonly navItems = computed(() => (this.auth.isInstructor() ? this.instructorNav : this.studentNav));

  asideClass(): Record<string, boolean> {
    const mobileOpen = this.layout.mobileOpen() && !this.layout.isDesktop();
    const desktopCollapsed = this.layout.collapsed() && this.layout.isDesktop();
    return {
      'w-[min(85vw,16rem)] p-4': true,
      'lg:w-[4.25rem] lg:px-2 lg:py-4': desktopCollapsed,
      'lg:w-64 lg:p-6': !desktopCollapsed,
      'translate-x-0': mobileOpen,
      '-translate-x-full': !mobileOpen && !this.layout.isDesktop(),
      'lg:translate-x-0': true,
    };
  }

  @HostListener('window:resize')
  onResize(): void {
    this.layout.refreshViewport();
  }

  ngOnInit(): void {
    this.layout.refreshViewport();
    if (!this.auth.isStudent() || !this.auth.isAuthenticated()) {
      return;
    }
    void this.data.refreshMessages();
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.layout.closeMobile();
        if (this.auth.isStudent() && this.auth.isAuthenticated()) {
          void this.data.refreshMessages();
        }
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  onNavigate(): void {
    this.layout.closeMobile();
  }
}
