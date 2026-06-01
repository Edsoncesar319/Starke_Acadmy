import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-top-app-bar',
  standalone: true,
  template: `
    <header class="mb-6 flex items-center justify-between rounded-xl border border-gold-500/20 bg-obsidian-700/70 px-6 py-4 shadow-gold">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-gold-400">Elite Portal</p>
        <h2 class="text-lg font-semibold text-slate-100">{{ title }}</h2>
      </div>
      <div class="text-right">
        <p class="text-sm text-slate-300">{{ studentName }}</p>
        <p class="text-xs text-gold-300">{{ studentLevel }}</p>
      </div>
    </header>
  `,
})
export class TopAppBarComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) studentName = '';
  @Input({ required: true }) studentLevel = '';
}
