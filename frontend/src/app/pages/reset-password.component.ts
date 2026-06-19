import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StarkeLogoComponent } from '../shared/starke-logo.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink, StarkeLogoComponent],
  template: `
    <section class="mx-auto mt-4 w-full max-w-md sm:mt-10">
      <p class="mb-4 text-center">
        <a routerLink="/login" class="text-xs text-slate-500 transition hover:text-gold-300">← Voltar ao login</a>
      </p>
      <app-starke-logo variant="login" size="xl" [showTitle]="false" containerClass="mb-6 sm:mb-8" />

      <div class="rounded-2xl border border-gold-500/30 bg-obsidian-700/70 p-5 shadow-gold sm:p-8">
        @if (!token) {
          <h1 class="text-xl font-semibold text-gold-300 sm:text-2xl">Link inválido</h1>
          <p class="mt-2 text-sm text-slate-300">
            O link de redefinição está incompleto ou expirou. Solicite um novo link.
          </p>
          <a routerLink="/forgot-password" class="btn-primary mt-6 block w-full text-center">
            Solicitar novo link
          </a>
        } @else if (success()) {
          <h1 class="text-xl font-semibold text-gold-300 sm:text-2xl">Senha redefinida!</h1>
          <p class="mt-2 text-sm text-emerald-300">Sua senha foi alterada com sucesso.</p>
          <a routerLink="/login" class="btn-primary mt-6 block w-full text-center">Ir para o login</a>
        } @else {
          <h1 class="text-xl font-semibold text-gold-300 sm:text-2xl">Nova senha</h1>
          <p class="mt-2 text-sm text-slate-300">Crie uma nova senha para sua conta.</p>

          <form class="mt-6 space-y-4" (ngSubmit)="submit()">
            <input
              type="password"
              [(ngModel)]="password"
              name="password"
              required
              minlength="6"
              class="form-input"
              placeholder="Nova senha (mín. 6 caracteres)"
              autocomplete="new-password"
            />
            <input
              type="password"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              required
              minlength="6"
              class="form-input"
              placeholder="Confirmar nova senha"
              autocomplete="new-password"
            />
            <button type="submit" [disabled]="loading()" class="btn-primary w-full">
              {{ loading() ? 'Salvando...' : 'Redefinir senha' }}
            </button>
          </form>
        }

        @if (error()) {
          <p class="mt-4 text-sm text-red-300">{{ error() }}</p>
        }
      </div>
    </section>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  token = '';
  password = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  async submit(): Promise<void> {
    if (this.password.length < 6) {
      this.error.set('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('As senhas não coincidem.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.resetPassword(this.token, this.password);
      this.success.set(true);
    } catch {
      this.error.set('Não foi possível redefinir a senha. O link pode ter expirado.');
    } finally {
      this.loading.set(false);
    }
  }
}
