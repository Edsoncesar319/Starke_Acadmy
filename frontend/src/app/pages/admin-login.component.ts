import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="mx-auto mt-16 max-w-md rounded-2xl border border-gold-500/30 bg-obsidian-700/70 p-8 shadow-gold">
      <h1 class="text-2xl font-semibold text-gold-300">Super Admin Access</h1>
      <p class="mt-2 text-sm text-slate-300">Gerencie cursos e envie detalhes para alunos.</p>

      <form class="mt-6 space-y-4" (ngSubmit)="submit()">
        <input [(ngModel)]="email" name="email" type="email" required class="w-full rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 outline-none" />
        <input [(ngModel)]="password" name="password" type="password" required class="w-full rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 outline-none" />
        <button type="submit" [disabled]="loading()" class="w-full rounded-lg border border-gold-500/40 px-4 py-2 text-sm font-semibold text-gold-300 hover:bg-gold-500/10 disabled:opacity-60">
          {{ loading() ? 'Autenticando...' : 'Entrar como Admin' }}
        </button>
      </form>

      @if (error()) {
        <p class="mt-4 text-sm text-red-300">{{ error() }}</p>
      }
      <p class="mt-6 text-xs text-slate-400">Seed admin: admin&#64;starke.academy / admin123</p>
    </section>
  `,
})
export class AdminLoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = 'admin@starke.academy';
  password = 'admin123';
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
