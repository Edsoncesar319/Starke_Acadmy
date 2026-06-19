import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StarkeLogoComponent } from '../shared/starke-logo.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink, StarkeLogoComponent],
  template: `
    <section class="mx-auto mt-4 w-full max-w-md sm:mt-10">
      <p class="mb-4 text-center">
        <a routerLink="/login" class="text-xs text-slate-500 transition hover:text-gold-300">← Voltar ao login</a>
      </p>
      <app-starke-logo variant="login" size="xl" [showTitle]="false" containerClass="mb-6 sm:mb-8" />

      <div class="rounded-2xl border border-gold-500/30 bg-obsidian-700/70 p-5 shadow-gold sm:p-8">
        <h1 class="text-xl font-semibold text-gold-300 sm:text-2xl">Esqueceu a senha?</h1>
        <p class="mt-2 text-sm text-slate-300">
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
        </p>

        @if (!sent()) {
          <form class="mt-6 space-y-4" (ngSubmit)="submit()">
            <input
              type="email"
              [(ngModel)]="email"
              name="email"
              required
              class="form-input"
              placeholder="E-mail cadastrado"
              autocomplete="email"
            />
            <button type="submit" [disabled]="loading()" class="btn-primary w-full">
              {{ loading() ? 'Enviando...' : 'Enviar link de recuperação' }}
            </button>
          </form>
        } @else {
          <p class="mt-6 text-sm text-emerald-300">
            Se o e-mail estiver cadastrado, você receberá as instruções em breve. Verifique também a caixa de spam.
          </p>
          <a routerLink="/login" class="btn-primary mt-6 block w-full text-center">Voltar ao login</a>
        }

        @if (error()) {
          <p class="mt-4 text-sm text-red-300">{{ error() }}</p>
        }
      </div>
    </section>
  `,
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);

  email = '';
  loading = signal(false);
  error = signal<string | null>(null);
  sent = signal(false);

  async submit(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.requestPasswordReset(this.email);
      this.sent.set(true);
    } catch {
      this.error.set('Não foi possível enviar o e-mail. Tente novamente mais tarde.');
    } finally {
      this.loading.set(false);
    }
  }
}
