import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLesson, AdminService } from '../services/admin.service';
import { AuthService } from '../services/auth.service';
import { Lesson, PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-lesson-player',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <section class="space-y-6">
      @if (data.error()) {
        <p class="rounded-lg border border-red-400/30 bg-red-900/20 px-4 py-2 text-sm text-red-300">{{ data.error() }}</p>
      }
      @if (admin.error()) {
        <p class="rounded-lg border border-red-400/30 bg-red-900/20 px-4 py-2 text-sm text-red-300">{{ admin.error() }}</p>
      }
      @if (admin.status()) {
        <p class="rounded-lg border border-gold-500/20 bg-obsidian-700/60 px-4 py-2 text-sm text-gold-300">{{ admin.status() }}</p>
      }

      @if (isContentManager()) {
        <article class="rounded-xl border border-gold-500/30 bg-obsidian-700/70 p-6">
          <h2 class="text-lg font-semibold text-gold-300">Gerenciar vídeo-aulas</h2>
          <p class="mt-1 text-sm text-slate-400">
            @if (isAdmin()) {
              Super Admin: envie vídeos e cadastre lições para os cursos.
            } @else {
              Instrutor: envie vídeos e cadastre lições dos cursos.
            }
          </p>

          <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div class="space-y-3">
              <label class="block text-xs text-slate-400">Curso</label>
              <select
                [(ngModel)]="selectedCourseId"
                (ngModelChange)="onAdminCourseChange()"
                name="adminCourse"
                class="w-full rounded-lg border border-gold-500/25 bg-obsidian-800 px-3 py-2 text-sm"
              >
                @for (course of admin.courses(); track course.id) {
                  <option [ngValue]="course.id">{{ course.title }}</option>
                }
              </select>

              <form class="space-y-2 rounded-lg border border-gold-500/20 p-3" (ngSubmit)="createLesson()">
                <p class="text-xs font-medium text-gold-300">Nova aula</p>
                <input
                  [(ngModel)]="newLesson.module_name"
                  name="newModule"
                  required
                  placeholder="Módulo (ex: Módulo 1)"
                  class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-sm"
                />
                <input
                  [(ngModel)]="newLesson.title"
                  name="newTitle"
                  required
                  placeholder="Título da aula"
                  class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-sm"
                />
                <textarea
                  [(ngModel)]="newLesson.content_md"
                  name="newContent"
                  rows="3"
                  placeholder="Descrição / conteúdo da aula"
                  class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-sm"
                ></textarea>
                <label class="block text-xs text-slate-400">Upload vídeo da aula</label>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  (change)="onNewLessonVideo($event)"
                  [disabled]="videoUploading()"
                  class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-gold-500/20 file:px-2 file:py-1 file:text-gold-300"
                />
                @if (newLesson.video_url) {
                  <p class="truncate text-xs text-gold-300">Vídeo: {{ newLesson.video_url }}</p>
                }
                <label class="block text-xs text-slate-400">Upload PDF do capítulo</label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  (change)="onNewLessonPdf($event)"
                  [disabled]="videoUploading()"
                  class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-gold-500/20 file:px-2 file:py-1 file:text-gold-300"
                />
                @if (newLesson.pdf_url) {
                  <p class="truncate text-xs text-gold-300">PDF: {{ newLesson.pdf_url }}</p>
                }
                <button
                  type="submit"
                  [disabled]="!selectedCourseId || videoUploading()"
                  class="rounded border border-gold-500/40 px-3 py-2 text-xs text-gold-300 hover:bg-gold-500/10 disabled:opacity-60"
                >
                  Criar aula
                </button>
              </form>
            </div>

            <div class="max-h-96 space-y-3 overflow-auto">
              @if (admin.lessons().length === 0) {
                <p class="text-sm text-slate-500">Nenhuma aula neste curso.</p>
              }
              @for (lesson of admin.lessons(); track lesson.id) {
                <form class="space-y-2 rounded-lg border border-gold-500/20 p-3" (ngSubmit)="saveAdminLesson(lesson)">
                  <input
                    [(ngModel)]="lesson.module_name"
                    [name]="'mod-' + lesson.id"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-2 py-1 text-sm"
                  />
                  <input
                    [(ngModel)]="lesson.title"
                    [name]="'title-' + lesson.id"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-2 py-1 text-sm"
                  />
                  <textarea
                    [(ngModel)]="lesson.content_md"
                    [name]="'content-' + lesson.id"
                    rows="2"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-2 py-1 text-sm"
                  ></textarea>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                    (change)="onLessonVideoUpload(lesson, $event)"
                    [disabled]="videoUploading()"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-2 py-1 text-xs"
                  />
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    (change)="onLessonPdfUpload(lesson, $event)"
                    [disabled]="videoUploading()"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-2 py-1 text-xs"
                  />
                  @if (lesson.video_url) {
                    <p class="truncate text-xs text-slate-400">{{ lesson.video_url }}</p>
                  }
                  @if (lesson.pdf_url) {
                    <p class="truncate text-xs text-slate-400">{{ lesson.pdf_url }}</p>
                  }
                  <div class="flex gap-2">
                    <button type="submit" class="rounded border border-gold-500/40 px-2 py-1 text-xs text-gold-300">
                      Salvar
                    </button>
                    <button
                      type="button"
                      (click)="deleteAdminLesson(lesson)"
                      class="rounded border border-red-400/40 px-2 py-1 text-xs text-red-300"
                    >
                      Excluir
                    </button>
                  </div>
                </form>
              }
            </div>
          </div>
        </article>
      }

      @if (showStudentPlayer()) {
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <aside class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4 xl:col-span-3">
          <h4 class="mb-3 text-gold-300">Reprodutor de Lições</h4>

          @if (auth.isStudent()) {
            <label class="mb-2 block text-xs text-slate-400">Meu curso</label>
            <select
              [(ngModel)]="selectedCourseId"
              (ngModelChange)="onStudentCourseChange()"
              name="studentCourse"
              class="mb-4 w-full rounded-lg border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-sm"
            >
              @for (item of data.activeCourses(); track item.courseId) {
                <option [ngValue]="item.courseId">{{ item.course?.title }}</option>
              }
            </select>
          }

          @if (lessons().length === 0) {
            <p class="text-sm text-slate-500">Nenhuma aula disponível.</p>
          }
          @for (lesson of lessons(); track lesson.id) {
            <button
              type="button"
              (click)="selectLesson(lesson.id)"
              class="mb-2 block w-full rounded-lg border px-3 py-2 text-left text-sm transition"
              [ngClass]="selectedLessonId() === lesson.id ? 'border-gold-500 bg-gold-500/10' : 'border-gold-500/20'"
            >
              <span class="block text-gold-300/90">{{ lesson.moduleName }}</span>
              <span class="text-xs text-slate-400">{{ lesson.title }}</span>
            </button>
          }
        </aside>

        <div class="space-y-4 xl:col-span-9">
          @if (currentLesson(); as lesson) {
            <div class="aspect-video overflow-hidden rounded-xl border border-gold-500/30 bg-black">
              @if (hasPlayableVideo(lesson.videoUrl)) {
                <video
                  [src]="lesson.videoUrl"
                  controls
                  playsinline
                  class="h-full w-full bg-black object-contain"
                  (ended)="onVideoEnded()"
                >
                  Seu navegador não suporta reprodução de vídeo.
                </video>
              } @else {
                <div class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-slate-400">
                  <p class="text-gold-300">Vídeo ainda não disponível</p>
                  <p class="text-xs">O administrador pode enviar o vídeo desta aula.</p>
                </div>
              }
            </div>

            <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4 lg:col-span-2">
                <h5 class="text-lg font-medium text-gold-300">{{ lesson.title }}</h5>
                <p class="mt-1 text-xs text-slate-500">{{ lesson.moduleName }}</p>
                <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {{ lesson.contentMd || 'Sem descrição para esta aula.' }}
                </p>
                @if (lesson.pdfUrl) {
                  <a
                    [href]="lesson.pdfUrl"
                    target="_blank"
                    rel="noopener"
                    class="mt-4 inline-block rounded-lg border border-gold-500/40 px-3 py-2 text-xs text-gold-300 hover:bg-gold-500/10"
                  >
                    Baixar conteúdo (PDF)
                  </a>
                }
                @if (courseProgress() !== null) {
                  <p class="mt-2 text-xs text-slate-400">Progresso do curso: {{ courseProgress() }}%</p>
                }
              </article>
              <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
                <h5 class="text-gold-300">Avaliação do capítulo</h5>
                <p class="mt-1 text-xs text-slate-400">10 questões. Aprovação mínima: 80% (8 acertos).</p>
                <div class="mt-3 max-h-80 space-y-3 overflow-auto pr-1">
                  @for (question of chapterQuiz; track question.prompt; let qIdx = $index) {
                    <div class="rounded-lg border border-gold-500/15 p-2">
                      <p class="text-xs text-slate-200">{{ qIdx + 1 }}. {{ question.prompt }}</p>
                      <div class="mt-2 space-y-1">
                        @for (option of question.options; track option; let optIdx = $index) {
                          <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                            <input
                              type="radio"
                              [name]="'q-' + qIdx"
                              [checked]="selectedAnswer(qIdx) === optIdx"
                              (change)="setQuizAnswer(qIdx, optIdx)"
                            />
                            {{ option }}
                          </label>
                        }
                      </div>
                    </div>
                  }
                </div>
                <button
                  type="button"
                  (click)="submitQuiz()"
                  [disabled]="!selectedCourseId()"
                  class="mt-3 w-full rounded border border-gold-500/40 px-3 py-2 text-xs text-gold-300 hover:bg-gold-500/10 disabled:opacity-60"
                >
                  Finalizar avaliação
                </button>
                @if (quizResult(); as result) {
                  <p class="mt-2 text-xs" [ngClass]="result.passed ? 'text-emerald-300' : 'text-red-300'">
                    Resultado: {{ result.score }}/10
                  </p>
                }
                @if (quizMessage()) {
                  <p class="mt-1 text-xs text-slate-300">{{ quizMessage() }}</p>
                }
              </article>
            </div>
          } @else {
            <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-8 text-center text-slate-400">
              Selecione um curso e uma aula para assistir.
            </div>
          }
        </div>
      </div>
      }
    </section>
  `,
})
export class LessonPlayerComponent implements OnInit {
  readonly data = inject(PortalDataService);
  readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);

  readonly isAdmin = this.auth.isAdmin;
  readonly isContentManager = this.auth.isContentManager;
  readonly selectedCourseId = signal<number | null>(null);
  readonly selectedLessonId = signal<number | null>(null);
  readonly videoUploading = signal(false);
  readonly quizAnswers = signal<Record<number, number[]>>({});
  readonly quizResult = signal<{ score: number; passed: boolean } | null>(null);
  readonly quizMessage = signal<string | null>(null);

  readonly chapterQuiz: { prompt: string; options: string[]; correctIndex: number }[] = [
    {
      prompt: 'Qual é a melhor atitude ao iniciar o estudo de um novo capítulo?',
      options: ['Ignorar o objetivo', 'Definir objetivo claro', 'Estudar sem foco', 'Pular exemplos'],
      correctIndex: 1,
    },
    {
      prompt: 'Para fixar o conteúdo, a prática recomendada é:',
      options: ['Apenas assistir', 'Repetir sem entender', 'Aplicar em exercícios', 'Memorizar sem contexto'],
      correctIndex: 2,
    },
    {
      prompt: 'Ao encontrar dificuldade em um tópico, o ideal é:',
      options: ['Abandonar o capítulo', 'Rever o conceito-base', 'Ignorar e avançar', 'Trocar de curso'],
      correctIndex: 1,
    },
    {
      prompt: 'Qual estratégia melhora retenção de longo prazo?',
      options: ['Revisão espaçada', 'Estudo único e longo', 'Sem anotações', 'Somente leitura passiva'],
      correctIndex: 0,
    },
    {
      prompt: 'No contexto do capítulo, exemplos práticos servem para:',
      options: ['Confundir o aluno', 'Substituir teoria', 'Conectar teoria e aplicação', 'Aumentar tempo sem ganho'],
      correctIndex: 2,
    },
    {
      prompt: 'Ao final de cada seção, o aluno deve principalmente:',
      options: ['Checar entendimento', 'Pular para prova', 'Encerrar sem revisão', 'Copiar tudo sem filtrar'],
      correctIndex: 0,
    },
    {
      prompt: 'Um bom indicador de domínio do capítulo é:',
      options: ['Saber explicar o conteúdo', 'Apenas reconhecer termos', 'Ter visto o vídeo uma vez', 'Não errar nunca'],
      correctIndex: 0,
    },
    {
      prompt: 'Quando revisar erro em exercício, o foco correto é:',
      options: ['Só ver o gabarito', 'Entender causa do erro', 'Refazer sem analisar', 'Ignorar o resultado'],
      correctIndex: 1,
    },
    {
      prompt: 'Para evoluir no capítulo, feedback deve ser:',
      options: ['Específico e acionável', 'Genérico e vago', 'Raro e tardio', 'Sem relação com conteúdo'],
      correctIndex: 0,
    },
    {
      prompt: 'A melhor forma de concluir o capítulo é:',
      options: ['Passar para o próximo sem validar', 'Atingir desempenho mínimo na avaliação', 'Assistir novamente sem prática', 'Parar no meio do conteúdo'],
      correctIndex: 1,
    },
  ];

  newLesson = {
    module_name: '',
    title: '',
    content_md: '',
    video_url: '',
    pdf_url: '',
  };

  readonly lessons = computed<Lesson[]>(() => {
    if (this.isContentManager()) {
      return this.admin.lessons().map((lesson) => this.toLesson(lesson));
    }
    return this.data.lessons();
  });

  readonly currentLesson = computed(() =>
    this.lessons().find((lesson) => lesson.id === this.selectedLessonId()) ?? null,
  );

  constructor() {
    effect(() => {
      if (this.isContentManager()) return;
      const first = this.data.activeCourses()[0];
      if (!first || this.selectedCourseId()) return;
      this.selectedCourseId.set(first.courseId);
      void this.data.loadLessonsForCourse(first.courseId);
    });

    effect(() => {
      const list = this.lessons();
      if (list.length === 0) {
        this.selectedLessonId.set(null);
        return;
      }
      if (!list.some((lesson) => lesson.id === this.selectedLessonId())) {
        this.selectedLessonId.set(list[0].id);
      }
    });
  }

  showStudentPlayer(): boolean {
    return this.auth.isStudent() || (this.isAdmin() && this.data.activeCourses().length > 0);
  }

  async ngOnInit(): Promise<void> {
    if (this.isContentManager()) {
      if (this.isAdmin()) {
        await this.admin.loadDashboardData();
      } else {
        await this.admin.loadCoursesForContent();
      }
      const firstCourse = this.admin.courses()[0];
      if (firstCourse) {
        this.selectedCourseId.set(firstCourse.id);
        await this.admin.loadLessons(firstCourse.id);
      }
      return;
    }

    if (this.data.activeCourses().length === 0) {
      await this.data.refreshPortalData();
    }
    const first = this.data.activeCourses()[0];
    if (first) {
      this.selectedCourseId.set(first.courseId);
      await this.data.loadLessonsForCourse(first.courseId);
    }
  }

  onStudentCourseChange(): void {
    const courseId = this.selectedCourseId();
    if (!courseId) return;
    void this.data.loadLessonsForCourse(courseId);
  }

  async onAdminCourseChange(): Promise<void> {
    const courseId = this.selectedCourseId();
    if (!courseId) return;
    await this.admin.loadLessons(courseId);
  }

  selectLesson(lessonId: number): void {
    this.selectedLessonId.set(lessonId);
    this.quizResult.set(null);
    this.quizMessage.set(null);
  }

  hasPlayableVideo(url: string): boolean {
    if (!url?.trim()) return false;
    return (
      url.includes('/uploads/videos/') ||
      url.includes('.public.blob.vercel-storage.com') ||
      url.startsWith('blob:') ||
      /\.(mp4|webm|mov)(\?|$)/i.test(url)
    );
  }

  courseProgress(): number | null {
    const courseId = this.selectedCourseId();
    if (!courseId) return null;
    return this.data.activeCourses().find((item) => item.courseId === courseId)?.progressPercentage ?? null;
  }

  onVideoEnded(): void {
    if (!this.auth.isStudent()) return;
    this.quizMessage.set('Para atingir 100% deste capítulo, conclua a avaliação com no mínimo 80%.');
  }

  setQuizAnswer(questionIndex: number, optionIndex: number): void {
    const lessonId = this.selectedLessonId();
    if (!lessonId) return;
    const current = this.quizAnswers();
    const lessonAnswers = [...(current[lessonId] ?? Array(10).fill(-1))];
    lessonAnswers[questionIndex] = optionIndex;
    this.quizAnswers.set({ ...current, [lessonId]: lessonAnswers });
  }

  selectedAnswer(questionIndex: number): number {
    const lessonId = this.selectedLessonId();
    if (!lessonId) return -1;
    return this.quizAnswers()[lessonId]?.[questionIndex] ?? -1;
  }

  async submitQuiz(): Promise<void> {
    const lessonId = this.selectedLessonId();
    const courseId = this.selectedCourseId();
    if (!lessonId || !courseId) return;

    const answers = this.quizAnswers()[lessonId] ?? [];
    if (answers.length < this.chapterQuiz.length || answers.some((answer) => answer < 0)) {
      this.quizMessage.set('Responda as 10 questões antes de finalizar a avaliação.');
      return;
    }

    const score = this.chapterQuiz.reduce((acc, question, index) => {
      return acc + (answers[index] === question.correctIndex ? 1 : 0);
    }, 0);
    const passed = score >= 8;
    this.quizResult.set({ score, passed });

    if (passed) {
      await this.data.updateProgress(courseId, 100);
      this.quizMessage.set('Aprovado! Capítulo concluído com 100% de progresso.');
      return;
    }

    const current = this.courseProgress() ?? 0;
    await this.data.updateProgress(courseId, Math.min(current, 90));
    this.quizMessage.set('Você precisa de 80% (8/10). Revise o capítulo e tente novamente.');
  }

  async onNewLessonVideo(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.videoUploading.set(true);
    try {
      this.newLesson.video_url = await this.admin.uploadLessonVideo(file);
    } catch {
      // handled by service
    } finally {
      this.videoUploading.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  async onLessonVideoUpload(lesson: AdminLesson, event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.videoUploading.set(true);
    try {
      lesson.video_url = await this.admin.uploadLessonVideo(file);
      await this.admin.updateLesson(lesson);
    } catch {
      // handled by service
    } finally {
      this.videoUploading.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  async onNewLessonPdf(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.videoUploading.set(true);
    try {
      this.newLesson.pdf_url = await this.admin.uploadLessonPdf(file);
    } catch {
      // handled by service
    } finally {
      this.videoUploading.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  async onLessonPdfUpload(lesson: AdminLesson, event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.videoUploading.set(true);
    try {
      lesson.pdf_url = await this.admin.uploadLessonPdf(file);
      await this.admin.updateLesson(lesson);
    } catch {
      // handled by service
    } finally {
      this.videoUploading.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  async createLesson(): Promise<void> {
    const courseId = this.selectedCourseId();
    if (!courseId) return;
    await this.admin.createLesson({
      course_id: courseId,
      module_name: this.newLesson.module_name,
      title: this.newLesson.title,
      content_md: this.newLesson.content_md,
      video_url: this.newLesson.video_url,
      pdf_url: this.newLesson.pdf_url || null,
    });
    this.newLesson = { module_name: '', title: '', content_md: '', video_url: '', pdf_url: '' };
  }

  async saveAdminLesson(lesson: AdminLesson): Promise<void> {
    await this.admin.updateLesson(lesson);
  }

  async deleteAdminLesson(lesson: AdminLesson): Promise<void> {
    const confirmed = window.confirm(`Excluir a aula "${lesson.title}"?`);
    if (!confirmed) return;
    await this.admin.deleteLesson(lesson);
  }

  private toLesson(lesson: AdminLesson): Lesson {
    return {
      id: lesson.id,
      courseId: lesson.course_id,
      moduleName: lesson.module_name,
      title: lesson.title,
      videoUrl: lesson.video_url,
      contentMd: lesson.content_md,
      pdfUrl: lesson.pdf_url,
    };
  }
}
