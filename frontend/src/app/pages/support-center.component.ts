import { Component } from '@angular/core';

@Component({
  selector: 'app-support-center',
  standalone: true,
  template: `
    <section class="page-section">
      <input
        placeholder="Buscar na base de conhecimento..."
        class="form-input rounded-xl"
      />

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        @for (item of categories; track item.title) {
          <article class="panel">
            <h4 class="text-gold-300">{{ item.title }}</h4>
            <p class="mt-2 text-sm text-slate-300">{{ item.text }}</p>
          </article>
        }
      </div>

      <div class="panel">
        <h4 class="mb-3 text-gold-300">Perguntas frequentes</h4>
        @for (faq of faqs; track faq.q) {
          <details class="mb-2 rounded-lg border border-gold-500/20 px-3 py-2">
            <summary class="cursor-pointer text-sm text-slate-100">{{ faq.q }}</summary>
            <p class="mt-2 text-sm text-slate-300">{{ faq.a }}</p>
          </details>
        }
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button class="btn-outline w-full sm:w-auto">Chat ao vivo</button>
        <button class="btn-outline w-full sm:w-auto">Suporte por e-mail</button>
        <button class="btn-outline w-full sm:w-auto">Comunidade</button>
      </div>
    </section>
  `,
})
export class SupportCenterComponent {
  readonly categories = [
    { title: 'Técnico', text: 'Login, reprodução de vídeos e problemas na plataforma.' },
    { title: 'Acadêmico', text: 'Currículo, avaliações e orientação do mentor.' },
    { title: 'Financeiro', text: 'Faturas, planos e renovações.' },
  ];

  readonly faqs = [
    {
      q: 'Como solicito o certificado?',
      a: 'Conclua todos os módulos e acesse a seção de conquistas no seu perfil.',
    },
    {
      q: 'Posso reagendar as aulas ao vivo?',
      a: 'Sim. Em Próximas ao vivo, abra os detalhes da sessão e solicite o reagendamento.',
    },
    {
      q: 'Onde baixo os materiais das aulas?',
      a: 'Abra Aulas e use o painel de recursos de cada lição para baixar PDFs e anexos.',
    },
  ];
}
