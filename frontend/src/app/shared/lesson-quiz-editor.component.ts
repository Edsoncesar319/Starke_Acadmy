import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { AdminService, LessonQuizQuestion } from '../services/admin.service';
import { LessonQuizDraftService } from '../services/lesson-quiz-draft.service';

@Component({
  selector: 'app-lesson-quiz-editor',
  standalone: true,
  template: `
    <section class="mt-3 rounded-lg border border-gold-500/25 bg-obsidian-900/60 p-3">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 class="text-sm font-medium text-gold-300">10 questões contextualizadas</h4>
          <p class="text-xs text-slate-500">
            @if (lessonTitle()) {
              Capítulo: {{ lessonTitle() }} ·
            }
            Marque a alternativa correta de cada questão (bolinha).
          </p>
        </div>
        @if (loading()) {
          <span class="text-xs text-gold-300">Carregando...</span>
        }
      </div>

      @if (localError()) {
        <p class="mb-3 rounded border border-red-400/30 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          {{ localError() }}
        </p>
      }
      @if (successMessage()) {
        <p class="mb-3 rounded border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-300">
          {{ successMessage() }}
        </p>
      }

      @if (!loading() && questions().length !== 10) {
        <p class="mb-3 text-xs text-slate-400">
          Não foi possível carregar as questões.
          <button type="button" class="ml-1 text-gold-300 underline" (click)="reload()">Tentar novamente</button>
        </p>
      }

      @if (questions().length === 10) {
        <div class="max-h-[32rem] space-y-3 overflow-auto pr-1">
          @for (question of questions(); track qIdx; let qIdx = $index) {
            <div class="rounded-lg border border-gold-500/15 p-3">
              <p class="mb-2 text-xs font-semibold text-gold-300">Questão {{ qIdx + 1 }}</p>
              <textarea
                [value]="question.prompt"
                (input)="updatePrompt(qIdx, readValue($event))"
                rows="2"
                placeholder="Enunciado contextualizado para este capítulo"
                class="mb-2 w-full rounded border border-gold-500/20 bg-obsidian-800 px-2 py-1.5 text-sm text-slate-100"
              ></textarea>
              <div class="space-y-1">
                @for (option of question.options; track optIdx; let optIdx = $index) {
                  <label class="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="radio"
                      [name]="'correct-' + lessonId() + '-' + qIdx"
                      [checked]="question.correct_index === optIdx"
                      (change)="setCorrectIndex(qIdx, optIdx)"
                    />
                    <input
                      [value]="option"
                      (input)="updateOption(qIdx, optIdx, readValue($event))"
                      placeholder="Alternativa {{ optIdx + 1 }}"
                      class="flex-1 rounded border border-gold-500/20 bg-obsidian-800 px-2 py-1 text-sm text-slate-100"
                    />
                  </label>
                }
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class LessonQuizEditorComponent implements OnInit {
  readonly lessonId = input.required<number>();
  readonly lessonTitle = input<string>('');
  readonly saved = output<void>();

  private readonly admin = inject(AdminService);
  private readonly draft = inject(LessonQuizDraftService);

  readonly questions = signal<LessonQuizQuestion[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly localError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  ngOnInit(): void {
    void this.reload();
  }

  readValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  private syncDraft(): void {
    const id = this.lessonId();
    if (id && this.questions().length === 10) {
      this.draft.set(id, this.questions());
    }
  }

  async reload(): Promise<void> {
    const id = this.lessonId();
    if (!id) return;

    this.loading.set(true);
    this.localError.set(null);
    this.successMessage.set(null);
    const quiz = await this.admin.loadLessonQuiz(id);
    this.loading.set(false);
    if (quiz?.questions.length === 10) {
      const normalized = quiz.questions
        .map((item, index) => ({
          position: index,
          prompt: item.prompt,
          options: [...item.options],
          correct_index: Number(item.correct_index) || 0,
        }))
        .sort((a, b) => a.position - b.position);
      this.questions.set(normalized);
      this.draft.set(id, normalized);
      return;
    }
    this.questions.set([]);
    this.localError.set(this.admin.error() ?? 'Não foi possível carregar as questões deste capítulo.');
  }

  updatePrompt(index: number, value: string): void {
    this.questions.update((list) =>
      list.map((item, idx) => (idx === index ? { ...item, prompt: value } : item)),
    );
    this.syncDraft();
  }

  updateOption(questionIndex: number, optionIndex: number, value: string): void {
    this.questions.update((list) =>
      list.map((item, idx) => {
        if (idx !== questionIndex) return item;
        const options = [...item.options];
        options[optionIndex] = value;
        return { ...item, options };
      }),
    );
    this.syncDraft();
  }

  setCorrectIndex(questionIndex: number, optionIndex: number): void {
    this.questions.update((list) =>
      list.map((item, idx) => (idx === questionIndex ? { ...item, correct_index: optionIndex } : item)),
    );
    this.syncDraft();
  }

  /** Salva via API; usado pelo painel pai e pelo botão externo. */
  async saveIfValid(): Promise<boolean> {
    const id = this.lessonId();
    if (!id) return false;

    this.syncDraft();
    const draft = this.draft.get(id) ?? this.questions();
    const validationError = this.draft.validate(draft);
    if (validationError) {
      this.localError.set(validationError);
      this.admin.error.set(validationError);
      return false;
    }

    this.saving.set(true);
    this.localError.set(null);
    this.successMessage.set(null);
    this.admin.error.set(null);

    const ok = await this.admin.saveLessonQuiz(id, this.draft.buildPayload(draft));
    this.saving.set(false);

    if (ok) {
      this.successMessage.set('Questões salvas com sucesso!');
      this.saved.emit();
      return true;
    }

    const message = this.admin.error() ?? 'Não foi possível salvar as questões.';
    this.localError.set(message);
    return false;
  }

  isSaving(): boolean {
    return this.saving();
  }
}
