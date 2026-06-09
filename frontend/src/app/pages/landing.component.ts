import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="landing-page">
      <img
        src="assets/landing-hero.png"
        alt=""
        class="landing-page__bg"
        aria-hidden="true"
        decoding="async"
        fetchpriority="high"
      />
      <div class="landing-page__overlay" aria-hidden="true"></div>

      <header class="relative z-20 flex items-center justify-end px-4 py-4 sm:px-6 md:px-8">
        <a routerLink="/admin/login" class="text-xs text-slate-300/80 transition hover:text-gold-300">
          Admin
        </a>
      </header>

      <main class="relative z-20 mx-auto flex w-full max-w-5xl flex-col px-4 pb-12 sm:px-6 sm:pb-16 md:px-8">
        <section
          class="flex min-h-[min(68vh,680px)] w-full flex-col items-center justify-end pb-2 pt-8 text-center sm:min-h-[min(72vh,760px)] sm:pb-8"
        >
          <div class="mt-auto flex w-full max-w-md flex-col gap-3 sm:max-w-lg sm:flex-row sm:justify-center">
            <a routerLink="/login" class="btn-primary w-full sm:flex-1">
              Entrar no portal
            </a>
            <a routerLink="/matricula" class="btn-outline w-full bg-obsidian-900/40 backdrop-blur-sm sm:flex-1">
              Fazer matrícula
            </a>
          </div>
        </section>

        <section class="mt-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5 md:mt-12">
          @for (item of highlights; track item.title) {
            <article class="panel text-center sm:text-left">
              <span
                class="material-symbols-rounded mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gold-500/25 bg-gold-500/10 text-gold-400"
              >
                {{ item.icon }}
              </span>
              <h2 class="text-base font-semibold text-gold-300">{{ item.title }}</h2>
              <p class="mt-2 text-sm leading-relaxed text-slate-400">{{ item.text }}</p>
            </article>
          }
        </section>

        <section class="panel mt-10 w-full max-w-3xl text-center sm:mt-12">
          <h2 class="text-lg font-semibold text-gold-300">Como começar</h2>
          <ol class="mt-4 space-y-3 text-left text-sm text-slate-300">
            <li class="flex gap-3">
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 text-xs font-bold text-gold-300"
                >1</span
              >
              <span><strong class="text-slate-100">Matrícula:</strong> crie sua conta de aluno em poucos passos.</span>
            </li>
            <li class="flex gap-3">
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 text-xs font-bold text-gold-300"
                >2</span
              >
              <span><strong class="text-slate-100">Login:</strong> acesse o portal com e-mail e senha.</span>
            </li>
            <li class="flex gap-3">
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 text-xs font-bold text-gold-300"
                >3</span
              >
              <span
                ><strong class="text-slate-100">Cursos:</strong> explore o catálogo, matricule-se e assista às
                videoaulas.</span
              >
            </li>
          </ol>
          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a routerLink="/matricula" class="btn-primary w-full sm:w-auto">Criar conta</a>
            <a routerLink="/login" class="btn-outline w-full sm:w-auto">Já tenho conta</a>
          </div>
        </section>
      </main>

      <footer class="relative z-20 border-t border-gold-500/10 px-4 py-6 text-center text-xs text-slate-500">
        © {{ year }} Starke Academy · Todos os direitos reservados
      </footer>
    </div>
  `,
})
export class LandingComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly year = new Date().getFullYear();

  readonly highlights = [
    {
      icon: 'play_circle',
      title: 'Videoaulas',
      text: 'Conteúdo em vídeo com progresso por capítulo e avaliações integradas.',
    },
    {
      icon: 'menu_book',
      title: 'Catálogo de cursos',
      text: 'Escolha entre diversos cursos e acompanhe seu desenvolvimento no painel.',
    },
    {
      icon: 'support_agent',
      title: 'Suporte dedicado',
      text: 'Chat com a equipe Starke para tirar dúvidas e receber orientação.',
    },
  ];

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) return;
    if (this.auth.isAdmin()) {
      void this.router.navigateByUrl('/admin/dashboard');
      return;
    }
    if (this.auth.isInstructor()) {
      void this.router.navigateByUrl('/lesson-player');
      return;
    }
    void this.router.navigateByUrl('/dashboard');
  }
}
