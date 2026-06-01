import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PortalDataService } from '../services/portal-data.service';
import { StarkeLogoComponent } from '../shared/starke-logo.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, StarkeLogoComponent],
  template: `
    <section class="mx-auto mt-10 max-w-md">
      <app-starke-logo size="lg" containerClass="mb-8" />

      <nav class="mb-6 flex rounded-xl border border-gold-500/25 bg-obsidian-800/80 p-1">
        <a
          routerLink="/login"
          routerLinkActive="bg-gold-500/15 text-gold-300"
          [routerLinkActiveOptions]="{ exact: true }"
          class="flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium text-slate-400 transition hover:text-gold-300"
        >
          Entrar
        </a>
        <a
          routerLink="/matricula"
          routerLinkActive="bg-gold-500/15 text-gold-300"
          [routerLinkActiveOptions]="{ exact: true }"
          class="flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium text-slate-400 transition hover:text-gold-300"
        >
          Matrícula
        </a>
      </nav>

      <div class="rounded-2xl border border-gold-500/30 bg-obsidian-700/70 p-8 shadow-gold">
      <h1 class="text-2xl font-semibold text-gold-300">Starke Elite Access</h1>
      <p class="mt-2 text-sm text-slate-300">Entre para continuar sua jornada premium.</p>

      <form class="mt-6 space-y-4" (ngSubmit)="submit()">
        <input
          type="email"
          [(ngModel)]="email"
          name="email"
          required
          class="w-full rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 outline-none"
          placeholder="Email"
        />
        <input
          type="password"
          [(ngModel)]="password"
          name="password"
          required
          class="w-full rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 outline-none"
          placeholder="Senha"
        />
        <button
          type="submit"
          [disabled]="loading()"
          class="w-full rounded-lg border border-gold-500/40 px-4 py-2 text-sm font-semibold text-gold-300 transition hover:bg-gold-500/10 disabled:opacity-60"
        >
          {{ loading() ? 'Authenticating...' : 'Enter Portal' }}
        </button>
      </form>

      @if (error()) {
        <p class="mt-4 text-sm text-red-300">{{ error() }}</p>
      }

      <p class="mt-6 text-center text-xs text-slate-400">
        Novo aluno?
        <a routerLink="/matricula" class="text-gold-300 underline-offset-2 hover:underline">Fazer matrícula</a>
      </p>
      </div>
    </section>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly data = inject(PortalDataService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  async submit(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email, this.password);
      if (this.auth.isAdmin()) {
        await this.router.navigateByUrl('/admin/dashboard');
      } else if (this.auth.isInstructor()) {
        await this.router.navigateByUrl('/lesson-player');
      } else {
        await this.data.refreshPortalData();
        await this.router.navigateByUrl('/dashboard');
      }
    } catch {
      this.error.set('Invalid credentials or backend unavailable.');
    } finally {
      this.loading.set(false);
    }
  }
}
