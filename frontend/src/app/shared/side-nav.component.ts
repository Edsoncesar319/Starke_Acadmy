import { NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
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
    <aside
      class="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-gold-500/20 bg-obsidian-gradient transition-all duration-300 ease-in-out"
      [ngClass]="layout.collapsed() ? 'w-[4.25rem] px-2 py-4' : 'w-64 p-6'"
      [attr.aria-expanded]="!layout.collapsed()"
    >
      <div
        class="mb-6 flex shrink-0 items-center"
        [ngClass]="layout.collapsed() ? 'justify-center' : 'justify-between gap-2'"
      >
        <app-starke-logo size="sm" [showTitle]="!layout.collapsed()" [containerClass]="layout.collapsed() ? '' : 'flex-1'" />
        @if (!layout.collapsed()) {
          <button
            type="button"
            (click)="layout.toggle()"
            class="rounded-lg border border-gold-500/25 p-2 text-gold-300 transition hover:bg-gold-500/10"
            title="Recolher menu"
            aria-label="Recolher menu lateral"
          >
            <mat-icon class="material-symbols-rounded">chevron_left</mat-icon>
          </button>
        }
      </div>

      <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden">
        @for (item of navItems(); track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="bg-gold-500/15 text-gold-300"
            [title]="layout.collapsed() ? item.label : ''"
            class="group relative flex items-center rounded-lg text-sm text-slate-300 transition hover:bg-gold-500/10 hover:text-gold-300"
            [ngClass]="layout.collapsed() ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3'"
          >
            <span class="flex items-center gap-3" [class.min-w-0]="!layout.collapsed()">
              <span class="nav-item-icon">
                <mat-icon class="material-symbols-rounded">{{ item.icon }}</mat-icon>
              </span>
              @if (!layout.collapsed()) {
                <span class="truncate">{{ item.label }}</span>
              }
            </span>
            @if (!layout.collapsed() && item.path === '/dashboard' && data.unreadMessagesCount() > 0) {
              <span
                class="min-w-5 rounded-full bg-gold-500 px-2 py-0.5 text-center text-xs font-semibold text-obsidian-900"
                [attr.aria-label]="data.unreadMessagesCount() + ' novas mensagens'"
              >
                {{ data.unreadMessagesCount() }}
              </span>
            }
            @if (layout.collapsed() && item.path === '/dashboard' && data.unreadMessagesCount() > 0) {
              <span
                class="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold-500"
                [attr.aria-label]="data.unreadMessagesCount() + ' novas mensagens'"
              ></span>
            }
          </a>
        }
      </nav>

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

  ngOnInit(): void {
    if (!this.auth.isStudent() || !this.auth.isAuthenticated()) {
      return;
    }
    void this.data.refreshMessages();
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.auth.isStudent() && this.auth.isAuthenticated()) {
          void this.data.refreshMessages();
        }
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
