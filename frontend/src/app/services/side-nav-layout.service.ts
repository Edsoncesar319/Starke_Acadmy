import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'starke_nav_collapsed';

@Injectable({ providedIn: 'root' })
export class SideNavLayoutService {
  readonly collapsed = signal(
    typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1',
  );

  readonly sidebarWidthClass = computed(() =>
    this.collapsed() ? 'w-[4.25rem]' : 'w-64',
  );

  readonly mainOffsetClass = computed(() =>
    this.collapsed() ? 'ml-[4.25rem]' : 'ml-64',
  );

  toggle(): void {
    this.collapsed.update((value) => {
      const next = !value;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  expand(): void {
    if (!this.collapsed()) return;
    this.collapsed.set(false);
    localStorage.setItem(STORAGE_KEY, '0');
  }
}
