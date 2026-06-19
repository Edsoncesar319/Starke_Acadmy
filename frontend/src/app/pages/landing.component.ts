import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="landing-page">
      <section class="landing-page__hero" aria-label="Starke Academy">
        <img
          src="assets/landing-hero.png"
          alt=""
          class="landing-page__bg"
          aria-hidden="true"
          decoding="async"
          fetchpriority="high"
          width="1024"
          height="682"
        />
        <div class="landing-page__overlay" aria-hidden="true"></div>

        <div class="landing-page__cta">
          <div class="landing-page__cta-inner">
            <a routerLink="/login" class="btn-primary w-full sm:flex-1">
              Entrar no portal
            </a>
            <a
              routerLink="/matricula"
              class="btn-outline w-full bg-obsidian-900/50 backdrop-blur-sm sm:flex-1"
            >
              Fazer matrícula
            </a>
          </div>
        </div>
      </section>

      <main class="landing-page__content">
        <section class="mt-[clamp(1.5rem,4vw,3rem)] grid w-full grid-cols-1 gap-[clamp(0.85rem,2.5vw,1.25rem)] sm:grid-cols-3">
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

        <section class="panel mt-[clamp(1.5rem,4vw,3rem)] w-full max-w-3xl mx-auto text-center">
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

      <footer
        class="relative z-20 border-t border-gold-500/10 px-[clamp(1rem,4vw,2rem)] py-[clamp(1rem,3vw,1.5rem)] text-center text-xs text-slate-500"
      >
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
