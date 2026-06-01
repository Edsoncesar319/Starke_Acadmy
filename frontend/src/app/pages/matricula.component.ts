import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PortalDataService } from '../services/portal-data.service';
import { StarkeLogoComponent } from '../shared/starke-logo.component';

@Component({
  selector: 'app-matricula',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, StarkeLogoComponent],
  template: `
    <section class="mx-auto mt-10 max-w-lg">
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
        <h1 class="text-2xl font-semibold text-gold-300">Matrícula Starke Elite</h1>
        <p class="mt-2 text-sm text-slate-300">
          Crie sua conta de aluno e comece sua jornada na Starke Academy.
        </p>

        <form class="mt-6 space-y-4" (ngSubmit)="submit()">
          <input
            type="text"
            [(ngModel)]="name"
            name="name"
            required
            minlength="2"
            class="w-full rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 text-sm outline-none focus:border-gold-500/50"
            placeholder="Nome completo"
          />
          <input
            type="email"
            [(ngModel)]="email"
            name="email"
            required
            class="w-full rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 text-sm outline-none focus:border-gold-500/50"
            placeholder="Email"
          />
          <input
            type="password"
            [(ngModel)]="password"
            name="password"
            required
            minlength="6"
            class="w-full rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 text-sm outline-none focus:border-gold-500/50"
            placeholder="Senha (mín. 6 caracteres)"
          />
          <input
            type="password"
            [(ngModel)]="confirmPassword"
            name="confirmPassword"
            required
            class="w-full rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 text-sm outline-none focus:border-gold-500/50"
            placeholder="Confirmar senha"
          />

          <label class="flex items-start gap-2 text-xs text-slate-400">
            <input type="checkbox" [(ngModel)]="acceptedTerms" name="terms" class="mt-0.5" required />
            <span>Concordo com os termos de uso e política da Starke Academy.</span>
          </label>

          <button
            type="submit"
            [disabled]="loading() || !acceptedTerms"
            class="w-full rounded-lg border border-gold-500/40 bg-gold-500/15 px-4 py-2 text-sm font-semibold text-gold-300 transition hover:bg-gold-500/25 disabled:opacity-60"
          >
            {{ loading() ? 'Criando conta...' : 'Concluir matrícula' }}
          </button>
        </form>

        @if (error()) {
          <p class="mt-4 rounded-lg border border-red-400/30 bg-red-900/20 px-3 py-2 text-sm text-red-300">
            {{ error() }}
          </p>
        }
        @if (success()) {
          <p class="mt-4 rounded-lg border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-sm text-gold-300">
            {{ success() }}
          </p>
        }

        <p class="mt-6 text-center text-xs text-slate-400">
          Já tem conta?
          <a routerLink="/login" class="text-gold-300 underline-offset-2 hover:underline">Entrar no portal</a>
        </p>
      </div>
    </section>
  `,
})
export class MatriculaComponent {
  private readonly auth = inject(AuthService);
  private readonly data = inject(PortalDataService);
  private readonly router = inject(Router);

  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  acceptedTerms = false;
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  async submit(): Promise<void> {
    this.error.set(null);
    this.success.set(null);

    if (this.password !== this.confirmPassword) {
      this.error.set('As senhas não coincidem.');
      return;
    }
    if (this.password.length < 6) {
      this.error.set('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.register({
        name: this.name.trim(),
        email: this.email.trim(),
        password: this.password,
      });
      await this.auth.login(this.email.trim(), this.password);
      await this.data.refreshPortalData();
      this.success.set('Matrícula concluída! Redirecionando...');
      await this.router.navigateByUrl('/dashboard');
    } catch (err) {
      const detail =
        err instanceof HttpErrorResponse
          ? typeof err.error?.detail === 'string'
            ? err.error.detail
            : null
          : null;
      this.error.set(
        detail === 'Email already registered'
          ? 'Este email já está cadastrado. Faça login ou use outro email.'
          : 'Não foi possível concluir a matrícula. Verifique os dados e tente novamente.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
