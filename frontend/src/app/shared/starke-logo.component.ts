import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-starke-logo',
  standalone: true,
  template: `
    <div class="flex flex-col items-center gap-2" [class]="containerClass">
      <img
        [src]="logoSrc"
        alt="Starke Academy"
        [class]="imageClass"
        class="w-auto object-contain drop-shadow-[0_4px_12px_rgba(212,175,55,0.25)]"
      />
      @if (showTitle) {
        <p class="text-center font-semibold tracking-wide text-gold-400" [class]="titleClass">
          {{ title }}
        </p>
      }
    </div>
  `,
})
export class StarkeLogoComponent {
  @Input() showTitle = true;
  @Input() title = 'Starke Academy';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() variant: 'default' | 'login' = 'default';
  @Input() containerClass = '';

  get logoSrc(): string {
    return this.variant === 'login' ? 'assets/logo-login.png' : 'assets/logo-academy.png';
  }

  get imageClass(): string {
    switch (this.size) {
      case 'sm':
        return 'h-12';
      case 'lg':
        return 'h-28';
      case 'xl':
        return 'h-32 w-32 sm:h-40 sm:w-40';
      default:
        return 'h-20';
    }
  }

  get titleClass(): string {
    switch (this.size) {
      case 'sm':
        return 'text-xs';
      case 'lg':
        return 'text-base';
      default:
        return 'text-sm';
    }
  }
}
