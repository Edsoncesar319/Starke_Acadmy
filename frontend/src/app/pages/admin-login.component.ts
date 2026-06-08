import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StarkeLogoComponent } from '../shared/starke-logo.component';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule, StarkeLogoComponent],
  template: `
    <section class="mx-auto mt-6 w-full max-w-md sm:mt-10">
      <app-starke-logo variant="login" size="xl" title="Starke Academy — Admin" [showTitle]="false" containerClass="mb-8" />

      <div class="rounded-2xl border border-gold-500/30 bg-obsidian-700/70 p-5 shadow-gold sm:p-8">
      <h1 class="text-2xl font-semibold text-gold-300">Acesso de administrador</h1>
      <p class="mt-2 text-sm text-slate-300">Gerencie cursos e envie detalhes para alunos.</p>

      <form class="mt-6 space-y-4" (ngSubmit)="submit()">
        <input
          [(ngModel)]="email"
          name="email"
          type="email"
          required
          placeholder="E-mail"
          class="w-full rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 outline-none"
        />
        <input
          [(ngModel)]="password"
          name="password"
          type="password"
          required
          placeholder="Senha"
          class="w-full rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 outline-none"
        />
        <button type="submit" [disabled]="loading()" class="w-full rounded-lg border border-gold-500/40 px-4 py-2 text-sm font-semibold text-gold-300 hover:bg-gold-500/10 disabled:opacity-60">
          {{ loading() ? 'Autenticando...' : 'Entrar como Admin' }}
        </button>
      </form>

      @if (error()) {
        <p class="mt-4 text-sm text-red-300">{{ error() }}</p>
      }
      </div>
    </section>
  `,
})
export class AdminLoginComponent {
  private readonly auth = inject(AuthService);
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
      if (!this.auth.isAdmin()) {
        this.error.set('Usuário autenticado, mas sem permissão de administrador.');
        this.auth.logout();
        return;
      }
      await this.router.navigateByUrl('/admin/dashboard');
    } catch {
      this.error.set('Falha no login admin.');
    } finally {
      this.loading.set(false);
    }
  }
}
