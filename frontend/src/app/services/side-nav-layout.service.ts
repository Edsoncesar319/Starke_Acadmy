import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'starke_nav_collapsed';
const DESKTOP_BREAKPOINT_PX = 1024;

@Injectable({ providedIn: 'root' })
export class SideNavLayoutService {
  readonly collapsed = signal(
    typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1',
  );

  /** Drawer aberto em telas menores que lg. */
  readonly mobileOpen = signal(false);

  readonly isDesktop = signal(
    typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_BREAKPOINT_PX : true,
  );

  readonly mainOffsetClass = computed(() =>
    this.collapsed() ? 'ml-0 lg:ml-[4.25rem]' : 'ml-0 lg:ml-64',
  );

  readonly sidebarWidthClass = computed(() =>
    this.collapsed() ? 'w-[min(85vw,16rem)] lg:w-[4.25rem]' : 'w-[min(85vw,16rem)] lg:w-64',
  );

  refreshViewport(): void {
    if (typeof window === 'undefined') return;
    const desktop = window.innerWidth >= DESKTOP_BREAKPOINT_PX;
    this.isDesktop.set(desktop);
    if (desktop) {
      this.mobileOpen.set(false);
    }
  }

  toggle(): void {
    this.refreshViewport();
    if (!this.isDesktop()) {
      this.mobileOpen.update((open) => !open);
      return;
    }
    this.collapsed.update((value) => {
      const next = !value;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  expand(): void {
    if (!this.isDesktop()) {
      this.mobileOpen.set(true);
      return;
    }
    if (!this.collapsed()) return;
    this.collapsed.set(false);
    localStorage.setItem(STORAGE_KEY, '0');
  }
}
