import { NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PortalDataService } from '../services/portal-data.service';
import { findPurchaseIdFromReceiptSubject, isReceiptMessage } from '../utils/payment-receipt.util';

@Component({
  selector: 'app-support-center',
  standalone: true,
  imports: [NgClass, FormsModule],
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
        <button
          type="button"
          class="btn-outline w-full sm:w-auto"
          [ngClass]="chatOpen() ? 'border-gold-400 bg-gold-500/15 text-gold-200' : ''"
          (click)="toggleChat()"
        >
          Chat ao vivo
          @if (data.unreadMessagesCount() > 0) {
            <span class="ml-2 rounded-full bg-gold-500 px-2 py-0.5 text-xs font-semibold text-obsidian-900">
              {{ data.unreadMessagesCount() }} nova(s)
            </span>
          }
        </button>
        <button class="btn-outline w-full sm:w-auto">Suporte por e-mail</button>
        <button class="btn-outline w-full sm:w-auto">Comunidade</button>
      </div>

      @if (chatOpen()) {
        <section class="chat-panel" id="support-chat">
          <header class="chat-header">
            <div>
              <p class="text-sm font-semibold text-gold-300">Chat com a Academia</p>
              <p class="text-xs text-slate-400">Converse com a equipe Starke Academy</p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-gold-500/25 px-3 py-1 text-xs text-slate-300 transition hover:bg-gold-500/10"
              (click)="chatOpen.set(false)"
            >
              Fechar
            </button>
          </header>

          <div class="chat-body">
            @if (chatMessages().length === 0) {
              <p class="text-center text-sm text-slate-500">
                Nenhuma mensagem ainda. Envie sua primeira mensagem para a Starke Academy abaixo.
              </p>
            } @else {
              @for (message of chatMessages(); track message.id) {
                @if (message.isFromStudent) {
                  <div class="chat-row chat-row-out">
                    <div>
                      <article class="chat-bubble chat-bubble-out">
                        <p class="font-semibold text-gold-200">{{ message.subject }}</p>
                        @if (courseTitle(message.courseId)) {
                          <p class="mt-1 text-xs text-gold-200/70">{{ courseTitle(message.courseId) }}</p>
                        }
                        <p class="mt-2 whitespace-pre-wrap leading-relaxed">{{ message.details }}</p>
                      </article>
                      <p class="chat-meta text-right">{{ formatTime(message.createdAt) }}</p>
                    </div>
                    <div class="chat-avatar">EU</div>
                  </div>
                } @else {
                  <div class="chat-row chat-row-in">
                    <div class="chat-avatar">SA</div>
                    <div>
                      <article class="chat-bubble chat-bubble-in">
                        <p class="font-semibold text-gold-300">{{ message.subject }}</p>
                        @if (courseTitle(message.courseId)) {
                          <p class="mt-1 text-xs text-gold-400/80">{{ courseTitle(message.courseId) }}</p>
                        }
                        <p class="mt-2 whitespace-pre-wrap leading-relaxed">{{ message.details }}</p>
                        @if (isReceiptMessage(message.subject)) {
                          <button
                            type="button"
                            (click)="printReceiptFromMessage(message)"
                            class="btn-outline mt-3 text-xs"
                          >
                            Imprimir comprovante
                          </button>
                        }
                      </article>
                      <p class="chat-meta">{{ formatTime(message.createdAt) }}</p>
                    </div>
                  </div>
                }
              }
            }
          </div>

          <form class="chat-composer space-y-2" (ngSubmit)="sendChatMessage()">
            <select
              [(ngModel)]="chatCourseId"
              name="chatCourseId"
              class="chat-input"
            >
              <option [ngValue]="null">Assunto geral (sem curso)</option>
              @for (item of data.activeCourses(); track item.courseId) {
                <option [ngValue]="item.courseId">{{ item.course?.title }}</option>
              }
            </select>
            <input
              [(ngModel)]="chatSubject"
              name="chatSubject"
              placeholder="Assunto (opcional)"
              class="chat-input"
            />
            <textarea
              [(ngModel)]="chatDetails"
              name="chatDetails"
              required
              rows="3"
              placeholder="Escreva sua mensagem para a Starke Academy..."
              class="chat-input"
            ></textarea>
            <div class="flex justify-end">
              <button type="submit" [disabled]="chatSending()" class="chat-send-btn">
                {{ chatSending() ? 'Enviando...' : 'Enviar mensagem' }}
              </button>
            </div>
          </form>
        </section>
      }
    </section>
  `,
})
export class SupportCenterComponent implements OnInit, OnDestroy {
  private static readonly MESSAGE_SYNC_MS = 5000;

  readonly data = inject(PortalDataService);
  private readonly route = inject(ActivatedRoute);

  readonly chatOpen = signal(false);
  readonly chatSending = signal(false);
  chatSubject = '';
  chatDetails = '';
  chatCourseId: number | null = null;
  private messageTimer?: ReturnType<typeof setInterval>;

  readonly chatMessages = computed(() =>
    [...this.data.messages()].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
  );
  readonly isReceiptMessage = isReceiptMessage;

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

  ngOnInit(): void {
    void this.data.refreshMessages();
    void this.data.refreshPurchases();

    if (this.route.snapshot.queryParamMap.get('chat') === '1') {
      this.openChat();
    }

    this.messageTimer = setInterval(() => {
      if (this.chatOpen()) {
        void this.data.refreshMessages();
      }
    }, SupportCenterComponent.MESSAGE_SYNC_MS);
  }

  ngOnDestroy(): void {
    if (this.messageTimer) {
      clearInterval(this.messageTimer);
    }
  }

  toggleChat(): void {
    if (this.chatOpen()) {
      this.chatOpen.set(false);
      return;
    }
    this.openChat();
  }

  private openChat(): void {
    this.chatOpen.set(true);
    this.data.markMessagesAsSeen();
    void this.data.refreshMessages();
    setTimeout(() => {
      document.getElementById('support-chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  async sendChatMessage(): Promise<void> {
    const details = this.chatDetails.trim();
    if (!details) {
      this.data.error.set('Digite uma mensagem antes de enviar.');
      return;
    }

    this.chatSending.set(true);
    const sent = await this.data.sendStudentMessage({
      details,
      subject: this.chatSubject.trim() || undefined,
      courseId: this.chatCourseId,
    });
    this.chatSending.set(false);

    if (!sent) return;

    this.chatDetails = '';
    this.chatSubject = '';
    this.data.status.set('Mensagem enviada para a Starke Academy.');
    await this.data.refreshMessages();
  }

  async printReceiptFromMessage(message: {
    subject: string;
    details: string;
    courseId: number | null;
  }): Promise<void> {
    const purchaseId = findPurchaseIdFromReceiptSubject(message.subject);
    if (!purchaseId) {
      this.data.error.set('Não foi possível identificar a compra deste comprovante.');
      return;
    }

    await this.data.refreshPurchases();
    const purchase = this.data.purchases().find((p) => p.id === purchaseId);
    const courseTitle = this.courseTitle(message.courseId ?? purchase?.course_id ?? null);

    if (purchase?.status === 'paid') {
      await this.data.printPurchaseReceipt(purchase, courseTitle);
      return;
    }

    if (await this.data.printReceiptFromMessageData(message, courseTitle)) {
      return;
    }

    this.data.error.set('Comprovante indisponível. Aguarde a confirmação do pagamento pelo administrador.');
  }

  courseTitle(courseId: number | null): string {
    if (!courseId) return '';
    return this.data.courses().find((course) => course.id === courseId)?.title ?? '';
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
