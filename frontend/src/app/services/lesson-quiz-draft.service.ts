import { Injectable } from '@angular/core';
import { LessonQuizQuestion } from './admin.service';

@Injectable({ providedIn: 'root' })
export class LessonQuizDraftService {
  private readonly drafts = new Map<number, LessonQuizQuestion[]>();

  set(lessonId: number, questions: LessonQuizQuestion[]): void {
    this.drafts.set(
      lessonId,
      questions.map((item) => ({
        position: item.position,
        prompt: item.prompt,
        options: [...item.options],
        correct_index: item.correct_index,
      })),
    );
  }

  get(lessonId: number): LessonQuizQuestion[] | null {
    const draft = this.drafts.get(lessonId);
    if (!draft) return null;
    return draft.map((item) => ({
      position: item.position,
      prompt: item.prompt,
      options: [...item.options],
      correct_index: item.correct_index,
    }));
  }

  validate(questions: LessonQuizQuestion[]): string | null {
    if (questions.length !== 10) {
      return 'A avaliação precisa ter exatamente 10 questões carregadas.';
    }
    for (let index = 0; index < questions.length; index++) {
      const item = questions[index];
      if (!item.prompt?.trim()) {
        return `Preencha o enunciado da questão ${index + 1}.`;
      }
      if (!item.options || item.options.length !== 4 || item.options.some((option) => !option?.trim())) {
        return `Preencha as 4 alternativas da questão ${index + 1}.`;
      }
      const correct = Number(item.correct_index);
      if (!Number.isFinite(correct) || correct < 0 || correct > 3) {
        return `Marque a alternativa correta da questão ${index + 1}.`;
      }
    }
    return null;
  }

  buildPayload(questions: LessonQuizQuestion[]): LessonQuizQuestion[] {
    return questions.map((item, index) => ({
      position: index,
      prompt: item.prompt.trim(),
      options: item.options.map((option) => option.trim()),
      correct_index: Number(item.correct_index),
    }));
  }
}
