import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-top-app-bar',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <header
      class="mb-4 flex flex-col gap-3 rounded-xl border border-gold-500/20 bg-obsidian-700/70 px-3 py-3 shadow-gold sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-4 md:px-6"
    >
      <div class="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          (click)="toggleNav.emit()"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold-500/30 text-gold-300 transition hover:bg-gold-500/10 lg:hidden"
          [attr.aria-label]="navCollapsed ? 'Abrir menu' : 'Fechar menu'"
        >
          <mat-icon class="material-symbols-rounded">menu</mat-icon>
        </button>
        <button
          type="button"
          (click)="toggleNav.emit()"
          class="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold-500/30 text-gold-300 transition hover:bg-gold-500/10 lg:inline-flex"
          [attr.aria-label]="navCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'"
          [title]="navCollapsed ? 'Expandir menu' : 'Recolher menu'"
        >
          <mat-icon
            class="material-symbols-rounded transition-transform duration-300"
            [class.rotate-180]="navCollapsed"
          >
            chevron_left
          </mat-icon>
        </button>
        <div class="min-w-0 flex-1">
          <p class="text-[10px] uppercase tracking-[0.15em] text-gold-400 sm:text-xs sm:tracking-[0.2em]">
            Portal Starke
          </p>
          <h2 class="truncate text-base font-semibold text-slate-100 sm:text-lg">{{ title }}</h2>
        </div>
      </div>
      <div class="flex items-center justify-between gap-2 sm:justify-end sm:gap-3">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold-500/40 bg-gold-500/10 text-xs font-semibold text-gold-300 sm:h-10 sm:w-10 sm:text-sm"
        >
          @if (avatarUrl) {
            <img [src]="avatarUrl" alt="" class="h-full w-full object-cover" />
          } @else {
            {{ initials() }}
          }
        </div>
        <div class="min-w-0 text-left sm:text-right">
          <p class="truncate text-sm text-slate-300">{{ studentName }}</p>
          <p class="truncate text-xs text-gold-300">{{ studentLevel }}</p>
        </div>
      </div>
    </header>
  `,
})
export class TopAppBarComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) studentName = '';
  @Input({ required: true }) studentLevel = '';
  @Input() avatarUrl: string | null = null;
  @Input() navCollapsed = false;
  @Output() readonly toggleNav = new EventEmitter<void>();

  initials(): string {
    return this.studentName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
