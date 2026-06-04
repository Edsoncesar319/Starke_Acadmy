import { Component, OnDestroy, OnInit, QueryList, ViewChildren, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { AdminCourse, AdminLesson, AdminService } from '../services/admin.service';
import { StarkeLogoComponent } from '../shared/starke-logo.component';
import { LessonQuizEditorComponent } from '../shared/lesson-quiz-editor.component';
import { LessonQuizDraftService } from '../services/lesson-quiz-draft.service';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [FormsModule, StarkeLogoComponent, LessonQuizEditorComponent],
  template: `
    <section class="space-y-6 p-6">
      <header class="rounded-xl border border-gold-500/30 bg-obsidian-700/70 p-6">
        <div class="flex flex-wrap items-center gap-6">
          <app-starke-logo size="md" [showTitle]="false" />
          <div class="min-w-0 flex-1">
        <h1 class="text-2xl font-semibold text-gold-300">Painel do administrador</h1>
        <p class="mt-1 text-sm text-slate-300">Edição dos cursos oferecidos e envio de detalhes para alunos.</p>
        <p class="mt-2 text-xs text-slate-500">
          {{ admin.students().length }} aluno(s) · {{ admin.instructors().length }} instrutor(es) · atualização a cada 8s
        </p>
        <button (click)="logout()" class="mt-4 rounded-lg border border-gold-500/40 px-3 py-2 text-xs font-semibold text-gold-300 hover:bg-gold-500/10">
          Sair
        </button>
          </div>
        </div>
      </header>

      @if (admin.status()) {
        <p class="rounded-lg border border-gold-500/20 bg-obsidian-700/60 px-4 py-2 text-sm text-gold-300">{{ admin.status() }}</p>
      }
      @if (admin.error()) {
        <p class="rounded-lg border border-red-400/30 bg-red-900/20 px-4 py-2 text-sm text-red-300">{{ admin.error() }}</p>
      }

      <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-medium text-gold-300">Todos os alunos no banco</h2>
            <p class="text-xs text-slate-500">Lista completa de usuários matriculados (não administradores).</p>
          </div>
          <span class="rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-300">
            Total: {{ admin.students().length }}
          </span>
        </div>

        @if (admin.students().length === 0) {
          <p class="rounded-lg border border-gold-500/15 bg-obsidian-800/60 px-4 py-6 text-center text-sm text-slate-400">
            Nenhum aluno matriculado no banco de dados.
          </p>
        } @else {
          <div class="max-h-80 overflow-auto rounded-lg border border-gold-500/15">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="sticky top-0 bg-obsidian-800 text-xs uppercase tracking-wide text-gold-300">
                <tr>
                  <th class="px-4 py-3">ID</th>
                  <th class="px-4 py-3">Aluno</th>
                  <th class="px-4 py-3">E-mail</th>
                  <th class="px-4 py-3">Nível</th>
                  <th class="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                @for (student of admin.students(); track student.id) {
                  <tr
                    [class]="
                      student.id === selectedUserId
                        ? 'border-t border-gold-500/10 bg-gold-500/10 transition hover:bg-gold-500/5'
                        : 'border-t border-gold-500/10 transition hover:bg-gold-500/5'
                    "
                  >
                    <td class="px-4 py-3 text-slate-400">#{{ student.id }}</td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3">
                        <div
                          class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold-500/30 bg-gold-500/10 text-xs font-semibold text-gold-300"
                        >
                          @if (student.avatar_url) {
                            <img [src]="student.avatar_url" alt="" class="h-full w-full object-cover" />
                          } @else {
                            {{ studentInitials(student.name) }}
                          }
                        </div>
                        <span class="font-medium text-slate-100">{{ student.name }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-slate-300">{{ student.email }}</td>
                    <td class="px-4 py-3 text-gold-300/90">{{ student.student_level }}</td>
                    <td class="px-4 py-3 text-right">
                      <button
                        type="button"
                        (click)="selectStudent(student.id)"
                        class="rounded border border-gold-500/40 px-2 py-1 text-xs text-gold-300 hover:bg-gold-500/10"
                      >
                        {{ student.id === selectedUserId ? 'Selecionado' : 'Selecionar' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </article>

      <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-medium text-gold-300">Instrutores</h2>
            <p class="text-xs text-slate-500">Usuários com permissão para gerenciar vídeo-aulas na plataforma.</p>
          </div>
          <span class="rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-300">
            Total: {{ admin.instructors().length }}
          </span>
        </div>

        @if (admin.instructors().length === 0) {
          <p class="rounded-lg border border-gold-500/15 bg-obsidian-800/60 px-4 py-6 text-center text-sm text-slate-400">
            Nenhum instrutor cadastrado. Marque um aluno como instrutor em «Editar perfil do aluno».
          </p>
        } @else {
          <div class="max-h-64 overflow-auto rounded-lg border border-gold-500/15">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="sticky top-0 bg-obsidian-800 text-xs uppercase tracking-wide text-gold-300">
                <tr>
                  <th class="px-4 py-3">ID</th>
                  <th class="px-4 py-3">Instrutor</th>
                  <th class="px-4 py-3">E-mail</th>
                  <th class="px-4 py-3">Nível</th>
                  <th class="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                @for (instructor of admin.instructors(); track instructor.id) {
                  <tr
                    [class]="
                      instructor.id === selectedUserId
                        ? 'border-t border-gold-500/10 bg-gold-500/10 transition hover:bg-gold-500/5'
                        : 'border-t border-gold-500/10 transition hover:bg-gold-500/5'
                    "
                  >
                    <td class="px-4 py-3 text-slate-400">#{{ instructor.id }}</td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3">
                        <div
                          class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold-500/30 bg-gold-500/10 text-xs font-semibold text-gold-300"
                        >
                          @if (instructor.avatar_url) {
                            <img [src]="instructor.avatar_url" alt="" class="h-full w-full object-cover" />
                          } @else {
                            {{ studentInitials(instructor.name) }}
                          }
                        </div>
                        <span class="font-medium text-slate-100">{{ instructor.name }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-slate-300">{{ instructor.email }}</td>
                    <td class="px-4 py-3 text-gold-300/90">{{ instructor.student_level }}</td>
                    <td class="px-4 py-3 text-right">
                      <button
                        type="button"
                        (click)="selectInstructor(instructor.id)"
                        class="rounded border border-gold-500/40 px-2 py-1 text-xs text-gold-300 hover:bg-gold-500/10"
                      >
                        {{ instructor.id === selectedUserId ? 'Selecionado' : 'Selecionar' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </article>

      <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
        <h2 class="mb-1 text-lg font-medium text-gold-300">Editar Aulas e Vídeo-aulas</h2>
        <p class="mb-4 text-xs text-slate-500">Crie, edite, envie vídeos ou exclua lições por curso.</p>

        <div class="mb-6 flex flex-wrap items-end gap-3">
          <div class="min-w-[12rem] flex-1">
            <label class="mb-2 block text-xs text-slate-400">Curso</label>
            <select
              [(ngModel)]="lessonCourseId"
              (ngModelChange)="onLessonCourseChange()"
              name="lessonCourseId"
              class="w-full max-w-md rounded-lg border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-sm"
            >
              @for (course of admin.courses(); track course.id) {
                <option [ngValue]="course.id">{{ course.title }}</option>
              }
            </select>
          </div>
          @if (selectedLessonCourse(); as course) {
            <button
              type="button"
              (click)="deleteCourse(course)"
              class="rounded-lg border border-red-400/40 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
            >
              Remover curso
            </button>
          }
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form class="space-y-3 rounded-lg border border-gold-500/20 p-4" (ngSubmit)="createLesson()">
            <h3 class="text-sm font-medium text-gold-300">Nova aula</h3>
            <input
              [(ngModel)]="newLesson.module_name"
              name="newLessonModule"
              required
              placeholder="Módulo (ex: Módulo 1)"
              class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"
            />
            <input
              [(ngModel)]="newLesson.title"
              name="newLessonTitle"
              required
              placeholder="Título da aula"
              class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"
            />
            <textarea
              [(ngModel)]="newLesson.content_md"
              name="newLessonContent"
              rows="4"
              placeholder="Descrição / conteúdo da aula"
              class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"
            ></textarea>
            <label class="block text-xs text-slate-400">Upload vídeo (MP4, WEBM, MOV — até 100 MB)</label>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              (change)="onNewLessonVideo($event)"
              [disabled]="videoUploading()"
              class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-gold-500/20 file:px-2 file:py-1 file:text-gold-300"
            />
            @if (newLesson.video_url) {
              <p class="truncate text-xs text-gold-300">Vídeo anexado</p>
            }
            <label class="block text-xs text-slate-400">Upload PDF do capítulo</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              (change)="onNewLessonPdf($event)"
              [disabled]="videoUploading()"
              class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-gold-500/20 file:px-2 file:py-1 file:text-gold-300"
            />
            @if (newLesson.pdf_url) {
              <p class="truncate text-xs text-gold-300">PDF anexado</p>
            }
            @if (videoUploading()) {
              <p class="text-xs text-gold-300">Enviando vídeo...</p>
            }
            <button
              type="submit"
              [disabled]="!lessonCourseId || videoUploading()"
              class="rounded border border-gold-500/40 px-3 py-2 text-xs font-semibold text-gold-300 hover:bg-gold-500/10 disabled:opacity-60"
            >
              Criar aula
            </button>
          </form>

          <div class="space-y-3">
            <h3 class="text-sm font-medium text-gold-300">
              Aulas cadastradas ({{ admin.lessons().length }})
            </h3>
            <div class="max-h-[28rem] space-y-3 overflow-auto pr-1">
              @if (admin.lessons().length === 0) {
                <p class="rounded-lg border border-gold-500/15 bg-obsidian-800/50 px-4 py-6 text-center text-sm text-slate-500">
                  Nenhuma aula neste curso. Crie a primeira ao lado.
                </p>
              }
              @for (lesson of admin.lessons(); track lesson.id) {
                <div class="space-y-2 rounded-lg border border-gold-500/20 bg-obsidian-800/40 p-3">
                <form
                  class="space-y-2"
                  (ngSubmit)="saveLesson(lesson)"
                >
                  <p class="text-xs text-slate-500">Aula #{{ lesson.id }}</p>
                  <input
                    [(ngModel)]="lesson.module_name"
                    [name]="'lessonMod-' + lesson.id"
                    placeholder="Módulo"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-2 py-1.5 text-sm"
                  />
                  <input
                    [(ngModel)]="lesson.title"
                    [name]="'lessonTitle-' + lesson.id"
                    placeholder="Título"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-2 py-1.5 text-sm"
                  />
                  <textarea
                    [(ngModel)]="lesson.content_md"
                    [name]="'lessonContent-' + lesson.id"
                    rows="3"
                    placeholder="Conteúdo da aula"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-2 py-1.5 text-sm"
                  ></textarea>
                  <label class="block text-xs text-slate-400">Substituir vídeo</label>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                    (change)="onLessonVideoUpload(lesson, $event)"
                    [disabled]="videoUploading()"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-2 py-1 text-xs"
                  />
                  @if (lesson.video_url) {
                    <a
                      [href]="lesson.video_url"
                      target="_blank"
                      rel="noopener"
                      class="block truncate text-xs text-gold-300 hover:underline"
                    >
                      Ver vídeo atual
                    </a>
                  }
                  <label class="block text-xs text-slate-400">Substituir PDF</label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    (change)="onLessonPdfUpload(lesson, $event)"
                    [disabled]="videoUploading()"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-900 px-2 py-1 text-xs"
                  />
                  @if (lesson.pdf_url) {
                    <a
                      [href]="lesson.pdf_url"
                      target="_blank"
                      rel="noopener"
                      class="block truncate text-xs text-gold-300 hover:underline"
                    >
                      Ver PDF atual
                    </a>
                  }
                  <div class="flex flex-wrap gap-2 pt-1">
                    <button
                      type="submit"
                      [disabled]="lessonSavingId() === lesson.id"
                      class="rounded border border-gold-500/40 px-3 py-1.5 text-xs text-gold-300 hover:bg-gold-500/10 disabled:opacity-60"
                    >
                      {{ lessonSavingId() === lesson.id ? 'Salvando...' : 'Salvar aula' }}
                    </button>
                    <button
                      type="button"
                      (click)="toggleQuizEditor(lesson.id)"
                      class="rounded border border-gold-500/40 px-3 py-1.5 text-xs text-gold-300 hover:bg-gold-500/10"
                    >
                      {{ editingQuizLessonId() === lesson.id ? 'Fechar questões' : 'Editar 10 questões' }}
                    </button>
                    <button
                      type="button"
                      (click)="deleteLesson(lesson)"
                      class="rounded border border-red-400/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      Excluir
                    </button>
                  </div>
                </form>
                  @if (editingQuizLessonId() === lesson.id) {
                    <app-lesson-quiz-editor
                      #activeQuizEditor
                      [lessonId]="lesson.id"
                      [lessonTitle]="lesson.title"
                    />
                    <div class="sticky bottom-0 z-20 mt-2 flex flex-wrap gap-2 rounded-lg border border-gold-500/30 bg-obsidian-900/95 p-3 backdrop-blur">
                      <button
                        type="button"
                        (click)="saveQuizForLesson(lesson.id, activeQuizEditor)"
                        [disabled]="quizSavingId() === lesson.id || activeQuizEditor.isSaving()"
                        class="rounded-lg border-2 border-gold-500 bg-gold-500/25 px-4 py-2 text-sm font-semibold text-gold-100 hover:bg-gold-500/40 disabled:opacity-60"
                      >
                        {{
                          quizSavingId() === lesson.id || activeQuizEditor.isSaving()
                            ? 'Salvando questões...'
                            : 'Salvar 10 questões'
                        }}
                      </button>
                      <button
                        type="button"
                        (click)="activeQuizEditor.reload()"
                        [disabled]="quizSavingId() === lesson.id"
                        class="rounded border border-slate-500/40 px-3 py-2 text-xs text-slate-300 hover:bg-slate-500/10 disabled:opacity-60"
                      >
                        Recarregar do servidor
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </article>

      <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-medium text-gold-300">Cursos cadastrados</h2>
            <p class="text-xs text-slate-500">Remova ou edite os cursos oferecidos na plataforma.</p>
          </div>
          <span class="rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-300">
            Total: {{ admin.courses().length }}
          </span>
        </div>

        @if (admin.courses().length === 0) {
          <p class="rounded-lg border border-gold-500/15 bg-obsidian-800/60 px-4 py-6 text-center text-sm text-slate-400">
            Nenhum curso cadastrado.
          </p>
        } @else {
          <div class="overflow-auto rounded-lg border border-gold-500/15">
            <table class="w-full min-w-[520px] text-left text-sm">
              <thead class="bg-obsidian-800 text-xs uppercase tracking-wide text-gold-300">
                <tr>
                  <th class="px-4 py-3">Curso</th>
                  <th class="px-4 py-3">Categoria</th>
                  <th class="px-4 py-3">Preço</th>
                  <th class="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                @for (course of admin.courses(); track course.id) {
                  <tr class="border-t border-gold-500/10 hover:bg-gold-500/5">
                    <td class="px-4 py-3 font-medium text-slate-100">{{ course.title }}</td>
                    <td class="px-4 py-3 text-slate-300">{{ course.category }}</td>
                    <td class="px-4 py-3 text-gold-300/90">{{ formatCoursePrice(course.price) }}</td>
                    <td class="px-4 py-3 text-right">
                      <button
                        type="button"
                        (click)="focusCourseEdit(course.id)"
                        class="mr-2 rounded border border-gold-500/40 px-2 py-1 text-xs text-gold-300 hover:bg-gold-500/10"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        (click)="deleteCourse(course)"
                        class="rounded border border-red-400/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                      >
                        Remover curso
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </article>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
          <h2 class="mb-4 text-lg font-medium text-gold-300">Inserir Novo Curso</h2>
          <form class="mb-6 space-y-2 rounded-lg border border-gold-500/20 p-3" (ngSubmit)="createNewCourse()">
            <input [(ngModel)]="newCourse.title" name="new-title" required placeholder="Título do curso" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm" />
            <textarea [(ngModel)]="newCourse.description" name="new-description" required placeholder="Descrição" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"></textarea>
            <div class="grid grid-cols-3 gap-2">
              <input [(ngModel)]="newCourse.category" name="new-category" required placeholder="Categoria" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
              <input [(ngModel)]="newCourse.price" name="new-price" required type="number" min="0" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
              <input [(ngModel)]="newCourse.rating" name="new-rating" required type="number" min="0" max="5" step="0.1" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
            </div>
            <input [(ngModel)]="newCourse.hero_image_url" name="new-hero" placeholder="URL da imagem (opcional)" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm" />
            <button type="submit" class="rounded border border-gold-500/40 px-3 py-2 text-xs text-gold-300 hover:bg-gold-500/10">Inserir novo curso</button>
          </form>

          <h2 class="mb-4 text-lg font-medium text-gold-300">Editar Cursos Oferecidos</h2>
          <div class="space-y-4">
            @for (course of admin.courses(); track course.id) {
              <form
                [id]="courseFormId(course.id)"
                (ngSubmit)="saveCourse(course)"
                class="space-y-2 rounded-lg border border-gold-500/20 p-3"
              >
                <input [(ngModel)]="course.title" [name]="'title-' + course.id" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm" />
                <textarea [(ngModel)]="course.description" [name]="'description-' + course.id" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"></textarea>
                <div class="grid grid-cols-3 gap-2">
                  <input [(ngModel)]="course.category" [name]="'category-' + course.id" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
                  <input [(ngModel)]="course.price" [name]="'price-' + course.id" type="number" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
                  <input [(ngModel)]="course.rating" [name]="'rating-' + course.id" type="number" step="0.1" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
                </div>
                <input [(ngModel)]="course.hero_image_url" [name]="'hero-' + course.id" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm" />
                <div class="space-y-2">
                  <label class="block text-xs text-slate-300">Upload nova imagem do curso</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    [name]="'upload-' + course.id"
                    (change)="onCourseImageSelected(course, $event)"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-xs"
                  />
                  @if (course.hero_image_url) {
                    <img [src]="course.hero_image_url" alt="Preview do curso" class="h-24 w-full rounded object-cover" />
                  }
                  @if (imageUploading()[course.id]) {
                    <p class="text-xs text-gold-300">Enviando imagem...</p>
                  }
                </div>
                <div class="flex flex-wrap gap-2 pt-1">
                  <button type="submit" class="rounded border border-gold-500/40 px-3 py-2 text-xs text-gold-300 hover:bg-gold-500/10">
                    Salvar curso
                  </button>
                  <button
                    type="button"
                    (click)="deleteCourse(course)"
                    class="rounded border border-red-400/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    Remover curso
                  </button>
                </div>
              </form>
            }
          </div>
        </article>

        <article class="mb-4 rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
          <h2 class="mb-1 text-lg font-medium text-gold-300">Editar perfil do usuário</h2>
          <p class="mb-4 text-xs text-slate-500">
            Selecione um aluno ou instrutor nas tabelas acima. Instrutores saem da lista de alunos.
          </p>
          <form class="space-y-3" (ngSubmit)="saveStudentProfile()">
            <input
              [(ngModel)]="studentProfile.name"
              name="studentProfileName"
              required
              placeholder="Nome"
              class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"
            />
            <input
              [(ngModel)]="studentProfile.email"
              name="studentProfileEmail"
              type="email"
              required
              placeholder="E-mail"
              class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"
            />
            <input
              [(ngModel)]="studentProfile.studentLevel"
              name="studentProfileLevel"
              required
              placeholder="Nível (ex: Aluno Platina)"
              class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"
            />
            <div class="flex flex-wrap items-center gap-3">
              @if (studentProfile.avatarUrl) {
                <img
                  [src]="studentProfile.avatarUrl"
                  alt="Avatar do aluno"
                  class="h-14 w-14 rounded-full border border-gold-500/30 object-cover"
                />
              }
              <div class="min-w-0 flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  (change)="onStudentAvatarSelected($event)"
                  [disabled]="!selectedUserId || avatarUploading()"
                  class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-gold-500/20 file:px-2 file:py-1 file:text-xs file:text-gold-300"
                />
                @if (avatarUploading()) {
                  <p class="mt-1 text-xs text-gold-300">Enviando foto...</p>
                }
              </div>
            </div>
            <input
              [(ngModel)]="studentProfile.avatarUrl"
              name="studentProfileAvatar"
              placeholder="URL do avatar (opcional)"
              class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"
            />
            <label class="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" [(ngModel)]="studentProfile.isInstructor" name="studentIsInstructor" />
              Usuário instrutor (gerencia vídeo-aulas)
            </label>
            <button
              type="submit"
              [disabled]="profileSaving()"
              class="rounded-lg border border-gold-500/40 px-3 py-2 text-xs font-semibold text-gold-300 hover:bg-gold-500/10 disabled:opacity-60"
            >
              {{ profileSaving() ? 'Salvando perfil...' : 'Salvar perfil do aluno' }}
            </button>
          </form>
        </article>

        <section class="chat-panel">
          <header class="chat-header">
            <div>
              <p class="text-sm font-semibold text-gold-300">Chat com Aluno</p>
              <p class="text-xs text-slate-400">{{ selectedStudentName() || 'Selecione um aluno' }}</p>
            </div>
            <span class="rounded-full border border-gold-500/30 px-2 py-0.5 text-xs text-gold-300">Administrador</span>
          </header>

          <div class="border-b border-gold-500/20 px-3 py-2">
            <select
              [(ngModel)]="selectedUserId"
              (ngModelChange)="onStudentChange()"
              name="selectedUserId"
              class="mb-2 w-full rounded-lg border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-sm"
            >
              @for (student of admin.students(); track student.id) {
                <option [ngValue]="student.id">{{ student.name }} ({{ student.email }})</option>
              }
            </select>
            <select
              [(ngModel)]="selectedCourseId"
              name="selectedCourseId"
              class="w-full rounded-lg border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-sm"
            >
              <option [ngValue]="null">Sem curso específico</option>
              @for (course of admin.courses(); track course.id) {
                <option [ngValue]="course.id">{{ course.title }}</option>
              }
            </select>
          </div>

          <div class="chat-body">
            @if (chatMessagesForStudent().length === 0) {
              <p class="text-center text-sm text-slate-500">Nenhuma mensagem com este aluno ainda.</p>
            } @else {
              @for (message of chatMessagesForStudent(); track message.id) {
                @if (isMessageFromStudent(message)) {
                  <div class="chat-row chat-row-in">
                    <div class="chat-avatar">AL</div>
                    <div>
                      <article class="chat-bubble chat-bubble-in">
                        <p class="font-semibold text-gold-300">{{ message.subject }}</p>
                        @if (courseTitle(message.course_id)) {
                          <p class="mt-1 text-xs text-gold-400/80">{{ courseTitle(message.course_id) }}</p>
                        }
                        <p class="mt-2 whitespace-pre-wrap leading-relaxed">{{ message.details }}</p>
                      </article>
                      <p class="chat-meta">{{ formatTime(message.created_at) }}</p>
                    </div>
                  </div>
                } @else {
                  <div class="chat-row chat-row-out">
                    <div>
                      <article class="chat-bubble chat-bubble-out">
                        <p class="font-semibold">{{ message.subject }}</p>
                        @if (courseTitle(message.course_id)) {
                          <p class="mt-1 text-xs text-gold-200/80">{{ courseTitle(message.course_id) }}</p>
                        }
                        <p class="mt-2 whitespace-pre-wrap leading-relaxed">{{ message.details }}</p>
                      </article>
                      <p class="chat-meta text-right">{{ formatTime(message.created_at) }}</p>
                    </div>
                    <div class="chat-avatar">AD</div>
                  </div>
                }
              }
            }
          </div>

          <form class="chat-composer space-y-2" (ngSubmit)="sendDetails()">
            <input
              [(ngModel)]="subject"
              name="subject"
              required
              placeholder="Assunto da mensagem..."
              class="chat-input"
            />
            <textarea
              [(ngModel)]="details"
              name="details"
              required
              rows="3"
              placeholder="Digite sua mensagem para o aluno..."
              class="chat-input"
            ></textarea>
            <div class="flex justify-end">
              <button type="submit" [disabled]="loading()" class="chat-send-btn">
                {{ loading() ? 'Enviando...' : 'Enviar mensagem' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  `,
})
export class SuperAdminDashboardComponent implements OnInit, OnDestroy {
  @ViewChildren('activeQuizEditor') quizEditors!: QueryList<LessonQuizEditorComponent>;

  readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly quizDraft = inject(LessonQuizDraftService);
  private refreshTimer?: ReturnType<typeof setInterval>;
  readonly quizSavingId = signal<number | null>(null);
  private static readonly REFRESH_MS = 8000;

  selectedUserId: number | null = null;
  selectedCourseId: number | null = null;
  lessonCourseId: number | null = null;
  subject = '';
  details = '';
  readonly loading = signal(false);
  readonly profileSaving = signal(false);
  readonly avatarUploading = signal(false);
  readonly videoUploading = signal(false);
  readonly lessonSavingId = signal<number | null>(null);
  readonly editingQuizLessonId = signal<number | null>(null);
  readonly imageUploading = signal<Record<number, boolean>>({});
  newCourse = this.emptyCourseForm();
  newLesson = {
    module_name: '',
    title: '',
    content_md: '',
    video_url: '',
    pdf_url: '',
  };
  studentProfile = {
    name: '',
    email: '',
    studentLevel: '',
    avatarUrl: '',
    isInstructor: false,
  };

  async ngOnInit(): Promise<void> {
    await this.admin.loadDashboardData();
    this.syncSelectedStudent();
    const firstCourse = this.admin.courses()[0];
    if (firstCourse) {
      this.lessonCourseId = firstCourse.id;
      await this.admin.loadLessons(firstCourse.id);
    }
    this.refreshTimer = setInterval(() => {
      void this.pollDashboard();
    }, SuperAdminDashboardComponent.REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  private async pollDashboard(): Promise<void> {
    const newCount = await this.admin.refreshDashboard(true);
    this.syncSelectedStudent(newCount > 0);
  }

  private syncSelectedStudent(preferNewest = false): void {
    const students = this.admin.students();
    const instructors = this.admin.instructors();
    if (students.length === 0 && instructors.length === 0) {
      this.selectedUserId = null;
      return;
    }

    const stillExists =
      students.some((student) => student.id === this.selectedUserId) ||
      instructors.some((instructor) => instructor.id === this.selectedUserId);

    if (!stillExists || preferNewest) {
      this.selectedUserId = students[0]?.id ?? instructors[0]?.id ?? null;
    }
    this.onStudentChange();
  }

  selectStudent(studentId: number): void {
    this.selectedUserId = studentId;
    this.onStudentChange();
  }

  selectInstructor(instructorId: number): void {
    this.selectedUserId = instructorId;
    this.onStudentChange();
  }

  studentInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  onStudentChange(): void {
    const user = this.findEditableUser(this.selectedUserId);
    if (!user) return;
    this.studentProfile = {
      name: user.name,
      email: user.email,
      studentLevel: user.student_level,
      avatarUrl: user.avatar_url ?? '',
      isInstructor: user.is_instructor ?? false,
    };
  }

  private findEditableUser(userId: number | null) {
    if (!userId) return undefined;
    return (
      this.admin.students().find((item) => item.id === userId) ??
      this.admin.instructors().find((item) => item.id === userId)
    );
  }

  async saveStudentProfile(): Promise<void> {
    if (!this.selectedUserId) {
      this.admin.error.set('Selecione um aluno para editar o perfil.');
      return;
    }
    this.profileSaving.set(true);
    try {
      await this.admin.updateStudent(this.selectedUserId, {
        name: this.studentProfile.name,
        email: this.studentProfile.email,
        studentLevel: this.studentProfile.studentLevel,
        avatarUrl: this.studentProfile.avatarUrl || null,
        isInstructor: this.studentProfile.isInstructor,
      });
      this.onStudentChange();
    } catch {
      // handled by AdminService
    } finally {
      this.profileSaving.set(false);
    }
  }

  async saveCourse(course: AdminCourse): Promise<void> {
    await this.admin.updateCourse(course);
  }

  async createNewCourse(): Promise<void> {
    await this.admin.createCourse(this.newCourse);
    this.newCourse = this.emptyCourseForm();
  }

  async onLessonCourseChange(): Promise<void> {
    if (!this.lessonCourseId) return;
    await this.admin.loadLessons(this.lessonCourseId);
  }

  async createLesson(): Promise<void> {
    if (!this.lessonCourseId) {
      this.admin.error.set('Selecione um curso antes de criar a aula.');
      return;
    }
    if (!this.newLesson.module_name.trim() || !this.newLesson.title.trim()) {
      this.admin.error.set('Preencha módulo e título antes de criar a aula.');
      return;
    }
    try {
      await this.admin.createLesson({
        course_id: this.lessonCourseId,
        module_name: this.newLesson.module_name,
        title: this.newLesson.title,
        content_md: this.newLesson.content_md,
        video_url: this.newLesson.video_url,
        pdf_url: this.newLesson.pdf_url || null,
      });
      this.newLesson = { module_name: '', title: '', content_md: '', video_url: '', pdf_url: '' };
    } catch {
      // AdminService já define admin.error
    }
  }

  toggleQuizEditor(lessonId: number): void {
    this.editingQuizLessonId.update((current) => (current === lessonId ? null : lessonId));
  }

  async saveQuizForLesson(lessonId: number, editor?: LessonQuizEditorComponent): Promise<void> {
    this.quizSavingId.set(lessonId);
    this.admin.error.set(null);
    try {
      if (editor) {
        const ok = await editor.saveIfValid();
        if (!ok) return;
        return;
      }
      const draft = this.quizDraft.get(lessonId);
      const validationError = draft ? this.quizDraft.validate(draft) : 'Abra o editor e carregue as questões.';
      if (validationError) {
        this.admin.error.set(validationError);
        return;
      }
      const ok = await this.admin.saveLessonQuiz(lessonId, this.quizDraft.buildPayload(draft!));
      if (!ok) return;
    } finally {
      this.quizSavingId.set(null);
    }
  }

  async saveLesson(lesson: AdminLesson): Promise<void> {
    this.lessonSavingId.set(lesson.id);
    try {
      if (this.editingQuizLessonId() === lesson.id) {
        const editor = this.quizEditors?.find((item) => item.lessonId() === lesson.id);
        if (editor) {
          const quizSaved = await editor.saveIfValid();
          if (!quizSaved) {
            this.admin.error.set(
              this.admin.error() ?? 'Corrija as questões antes de salvar a aula (ou use o botão Salvar 10 questões).',
            );
            return;
          }
        }
      }
      await this.admin.updateLesson(lesson);
    } catch {
      // handled by AdminService
    } finally {
      this.lessonSavingId.set(null);
    }
  }

  async deleteLesson(lesson: AdminLesson): Promise<void> {
    const confirmed = window.confirm(`Excluir a aula "${lesson.title}"?`);
    if (!confirmed) return;
    await this.admin.deleteLesson(lesson);
  }

  async onNewLessonVideo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.videoUploading.set(true);
    try {
      this.newLesson.video_url = await this.admin.uploadLessonVideo(file);
      if (
        this.lessonCourseId &&
        this.newLesson.module_name.trim() &&
        this.newLesson.title.trim()
      ) {
        await this.createLesson();
      } else if (!this.newLesson.module_name.trim() || !this.newLesson.title.trim()) {
        this.admin.status.set(
          'Vídeo enviado. Preencha módulo e título e clique em "Criar aula" para salvar.',
        );
      }
    } catch {
      // handled by AdminService
    } finally {
      this.videoUploading.set(false);
      input.value = '';
    }
  }

  async onNewLessonPdf(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.videoUploading.set(true);
    try {
      this.newLesson.pdf_url = await this.admin.uploadLessonPdf(file);
    } catch {
      // handled by AdminService
    } finally {
      this.videoUploading.set(false);
      input.value = '';
    }
  }

  async onLessonVideoUpload(lesson: AdminLesson, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.videoUploading.set(true);
    try {
      lesson.video_url = await this.admin.uploadLessonVideo(file);
      await this.admin.updateLesson(lesson);
    } catch {
      // handled by AdminService
    } finally {
      this.videoUploading.set(false);
      input.value = '';
    }
  }

  async onLessonPdfUpload(lesson: AdminLesson, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.videoUploading.set(true);
    try {
      lesson.pdf_url = await this.admin.uploadLessonPdf(file);
      await this.admin.updateLesson(lesson);
    } catch {
      // handled by AdminService
    } finally {
      this.videoUploading.set(false);
      input.value = '';
    }
  }

  async onStudentAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.selectedUserId) return;

    this.avatarUploading.set(true);
    try {
      const imageUrl = await this.admin.uploadStudentAvatar(this.selectedUserId, file);
      this.studentProfile.avatarUrl = imageUrl;
    } catch {
      // Error handled by AdminService.
    } finally {
      this.avatarUploading.set(false);
      input.value = '';
    }
  }

  async onCourseImageSelected(course: AdminCourse, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.setImageUploading(course.id, true);
    try {
      const imageUrl = await this.admin.uploadCourseImage(file);
      course.hero_image_url = imageUrl;
      await this.admin.updateCourse(course);
    } catch {
      // Error message is handled by AdminService signal.
    } finally {
      this.setImageUploading(course.id, false);
      input.value = '';
    }
  }

  selectedLessonCourse(): AdminCourse | null {
    if (!this.lessonCourseId) return null;
    return this.admin.courses().find((course) => course.id === this.lessonCourseId) ?? null;
  }

  courseFormId(courseId: number): string {
    return `course-form-${courseId}`;
  }

  formatCoursePrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price || 0);
  }

  focusCourseEdit(courseId: number): void {
    document.getElementById(this.courseFormId(courseId))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async deleteCourse(course: AdminCourse): Promise<void> {
    const confirmed = window.confirm(
      `Tem certeza que deseja remover o curso "${course.title}"?\n\nTodas as aulas e matrículas deste curso serão excluídas. Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    const removed = await this.admin.deleteCourse(course.id, course.title);
    if (!removed) return;

    if (this.selectedCourseId === course.id) {
      this.selectedCourseId = null;
    }

    if (this.lessonCourseId === course.id) {
      const next = this.admin.courses()[0];
      this.lessonCourseId = next?.id ?? null;
      if (this.lessonCourseId) {
        await this.admin.loadLessons(this.lessonCourseId);
      } else {
        this.admin.lessons.set([]);
      }
    }
  }

  async sendDetails(): Promise<void> {
    if (!this.selectedUserId) {
      this.admin.error.set('Selecione um aluno antes de enviar a mensagem.');
      return;
    }
    if (!this.subject.trim() || !this.details.trim()) {
      this.admin.error.set('Preencha assunto e detalhes da mensagem.');
      return;
    }

    this.loading.set(true);
    try {
      await this.admin.sendStudentDetails({
        userId: this.selectedUserId,
        courseId: this.selectedCourseId,
        subject: this.subject,
        details: this.details,
      });
      this.subject = '';
      this.details = '';
    } catch {
      // Error handled by AdminService.
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    location.href = '/admin/login';
  }

  private setImageUploading(courseId: number, value: boolean): void {
    this.imageUploading.update((state) => ({ ...state, [courseId]: value }));
  }

  selectedStudentName(): string {
    return this.findEditableUser(this.selectedUserId)?.name ?? '';
  }

  chatMessagesForStudent() {
    if (!this.selectedUserId) return [];
    return this.admin
      .sentMessages()
      .filter((message) => message.user_id === this.selectedUserId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  isMessageFromStudent(message: { user_id: number; is_from_student?: boolean; sent_by_admin_id: number }): boolean {
    return message.is_from_student ?? message.sent_by_admin_id === message.user_id;
  }

  courseTitle(courseId: number | null): string {
    if (!courseId) return '';
    return this.admin.courses().find((course) => course.id === courseId)?.title ?? '';
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private emptyCourseForm() {
    return {
      title: '',
      description: '',
      price: 0,
      category: '',
      rating: 4.8,
      hero_image_url: '',
    };
  }
}
