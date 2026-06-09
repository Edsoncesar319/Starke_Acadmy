import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StarkeLogoComponent } from '../shared/starke-logo.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, StarkeLogoComponent],
  template: `
    <div class="relative min-h-[100dvh]">
      <header class="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6 md:px-8">
        <app-starke-logo variant="login" size="sm" [showTitle]="false" />
        <a routerLink="/admin/login" class="text-xs text-slate-500 transition hover:text-gold-300">
          Admin
        </a>
      </header>

      <main class="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-12 pt-4 sm:px-6 sm:pb-16 md:px-8">
        <section class="flex w-full flex-col items-center text-center">
          <app-starke-logo variant="login" size="xl" [showTitle]="false" containerClass="mb-6 sm:mb-8" />

          <p class="text-xs font-medium uppercase tracking-[0.25em] text-gold-400 sm:text-sm">
            Educação premium
          </p>
          <h1 class="mt-3 max-w-2xl text-balance text-3xl font-bold text-slate-50 sm:text-4xl md:text-5xl">
            Sua jornada de excelência começa na
            <span class="text-gold-300">Starke Academy</span>
          </h1>
          <p class="mt-4 max-w-xl text-balance text-sm leading-relaxed text-slate-300 sm:text-base">
            Cursos em vídeo, acompanhamento personalizado e uma plataforma feita para quem busca
            evolução contínua. Entre na sua conta ou faça sua matrícula agora.
          </p>

          <div class="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-lg sm:flex-row sm:justify-center">
            <a routerLink="/login" class="btn-primary w-full sm:flex-1">
              Entrar no portal
            </a>
            <a routerLink="/matricula" class="btn-outline w-full bg-gold-500/5 sm:flex-1">
              Fazer matrícula
            </a>
          </div>
        </section>

        <section class="mt-12 grid w-full grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5 md:mt-16">
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

      <footer class="relative z-10 border-t border-gold-500/10 px-4 py-6 text-center text-xs text-slate-500">
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
