import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="fixed left-0 top-0 h-screen w-64 border-r border-gold-500/20 bg-obsidian-gradient p-6">
      <h1 class="mb-8 text-xl font-semibold tracking-wide text-gold-400">Starke Elite</h1>
      <nav class="space-y-2">
        @for (item of navItems; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="bg-gold-500/15 text-gold-300"
            class="flex items-center justify-between rounded-lg px-4 py-3 text-sm text-slate-300 transition hover:bg-gold-500/10 hover:text-gold-300"
          >
            <span>{{ item.label }}</span>
            @if (item.path === '/dashboard' && data.unreadMessagesCount() > 0) {
              <span
                class="min-w-5 rounded-full bg-gold-500 px-2 py-0.5 text-center text-xs font-semibold text-obsidian-900"
                [attr.aria-label]="data.unreadMessagesCount() + ' novas mensagens'"
              >
                {{ data.unreadMessagesCount() }}
              </span>
            }
          </a>
        }
      </nav>
    </aside>
  `,
})
export class SideNavComponent implements OnInit, OnDestroy {
  readonly data = inject(PortalDataService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/catalog', label: 'Course Catalog' },
    { path: '/lesson-player', label: 'Lesson Player' },
    { path: '/support', label: 'Support Center' },
    { path: '/profile', label: 'Meu Perfil' },
  ];

  ngOnInit(): void {
    void this.data.refreshMessages();
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => void this.data.refreshMessages());
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
