import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { upload } from '@vercel/blob/client';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, prepareImageForUpload } from '../utils/image-upload.util';
import { videoValidationError } from '../utils/video-upload.util';
import { AuthService } from './auth.service';

export interface AdminCourse {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  rating: number;
  hero_image_url: string | null;
}

export interface AdminCourseCreate {
  title: string;
  description: string;
  price: number;
  category: string;
  rating: number;
  hero_image_url: string | null;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  student_level: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_instructor: boolean;
}

export interface AdminSentMessage {
  id: number;
  user_id: number;
  sent_by_admin_id: number;
  is_from_student: boolean;
  course_id: number | null;
  subject: string;
  details: string;
  created_at: string;
}

export interface AdminLesson {
  id: number;
  course_id: number;
  module_name: string;
  title: string;
  video_url: string;
  content_md: string;
  pdf_url: string | null;
}

export interface AdminLessonCreate {
  course_id: number;
  module_name: string;
  title: string;
  video_url: string;
  content_md: string;
  pdf_url: string | null;
}

export interface LessonQuizQuestion {
  position: number;
  prompt: string;
  options: string[];
  correct_index: number;
}

export interface LessonQuizPayload {
  lesson_id: number;
  questions: LessonQuizQuestion[];
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly apiUrl = environment.apiUrl;
  private readonly auth = inject(AuthService);
  readonly courses = signal<AdminCourse[]>([]);
  readonly students = signal<AdminUser[]>([]);
  readonly instructors = signal<AdminUser[]>([]);
  readonly sentMessages = signal<AdminSentMessage[]>([]);
  readonly lessons = signal<AdminLesson[]>([]);
  readonly status = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  constructor(private readonly http: HttpClient) {}

  async loadDashboardData(): Promise<void> {
    await this.refreshDashboard(false);
  }

  async loadCoursesForContent(): Promise<void> {
    const courses = await firstValueFrom(this.http.get<AdminCourse[]>(`${this.apiUrl}/courses`));
    this.courses.set(courses);
  }

  async refreshDashboard(silent = true): Promise<number> {
    try {
      const [courses, students, instructors, messages] = await Promise.all([
        firstValueFrom(this.http.get<AdminCourse[]>(`${this.apiUrl}/courses`)),
        firstValueFrom(this.http.get<AdminUser[]>(`${this.apiUrl}/admin/students`)),
        firstValueFrom(this.http.get<AdminUser[]>(`${this.apiUrl}/admin/instructors`)),
        firstValueFrom(this.http.get<AdminSentMessage[]>(`${this.apiUrl}/admin/messages`)),
      ]);
      const previousIds = new Set(this.students().map((student) => student.id));
      const newStudents = students.filter((student) => !previousIds.has(student.id));

      this.courses.set(courses);
      this.students.set(students);
      this.instructors.set(instructors);
      this.sentMessages.set(messages);

      if (newStudents.length > 0 && !silent) {
        const label = newStudents.length === 1 ? '1 novo aluno matriculado' : `${newStudents.length} novos alunos matriculados`;
        this.status.set(`${label}. Lista atualizada.`);
      }

      return newStudents.length;
    } catch {
      if (!silent) {
        this.error.set('Não foi possível atualizar os dados do painel.');
      }
      return 0;
    }
  }

  async updateCourse(course: AdminCourse): Promise<void> {
    await firstValueFrom(this.http.put(`${this.apiUrl}/admin/courses/${course.id}`, course));
    this.status.set(`Curso "${course.title}" atualizado.`);
    await this.loadDashboardData();
  }

  async createCourse(payload: AdminCourseCreate): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiUrl}/admin/courses`, payload));
    this.status.set(`Novo curso "${payload.title}" criado.`);
    await this.loadDashboardData();
  }

  async deleteCourse(courseId: number, courseTitle: string): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/admin/courses/${courseId}`));
      this.status.set(`Curso "${courseTitle}" removido.`);
      await this.loadDashboardData();
      return true;
    } catch {
      this.error.set(`Não foi possível remover o curso "${courseTitle}".`);
      return false;
    }
  }

  async uploadCourseImage(file: File): Promise<string> {
    return this.uploadImage(file, `${this.apiUrl}/admin/courses/upload-image`, 'Imagem enviada com sucesso.');
  }

  async uploadStudentAvatar(studentId: number, file: File): Promise<string> {
    const imageUrl = await this.uploadImage(
      file,
      `${this.apiUrl}/admin/students/${studentId}/upload-avatar`,
      'Foto do aluno atualizada.',
    );
    const patchAvatar = (list: AdminUser[]) =>
      list.map((user) => (user.id === studentId ? { ...user, avatar_url: imageUrl } : user));
    this.students.update(patchAvatar);
    this.instructors.update(patchAvatar);
    return imageUrl;
  }

  private async uploadImage(file: File, endpoint: string, successMessage: string): Promise<string> {
    this.error.set(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Formato inválido. Use PNG, JPG ou WEBP.');
    }

    const preparedFile = await prepareImageForUpload(file);
    if (preparedFile.size > MAX_UPLOAD_BYTES) {
      throw new Error('Imagem muito grande mesmo após compressão. Use um arquivo menor.');
    }

    const formData = new FormData();
    formData.append('file', preparedFile);
    try {
      const response = await firstValueFrom(
        this.http.post<{ image_url: string }>(endpoint, formData),
      );
      this.status.set(successMessage);
      return response.image_url;
    } catch {
      this.error.set('Falha no upload da imagem. Verifique formato e tamanho.');
      throw new Error('Falha no upload da imagem.');
    }
  }

  async updateStudent(
    studentId: number,
    payload: {
      name: string;
      email: string;
      studentLevel: string;
      avatarUrl: string | null;
      isInstructor: boolean;
    },
  ): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.patch(`${this.apiUrl}/admin/students/${studentId}`, {
          name: payload.name.trim(),
          email: payload.email.trim(),
          student_level: payload.studentLevel.trim(),
          avatar_url: payload.avatarUrl,
          is_instructor: payload.isInstructor,
        }),
      );
      this.status.set(`Perfil do aluno "${payload.name}" atualizado.`);
      await this.loadDashboardData();
    } catch {
      this.error.set('Falha ao atualizar perfil do aluno.');
      throw new Error('Falha ao atualizar perfil do aluno.');
    }
  }

  async loadLessons(courseId: number): Promise<void> {
    const lessons = await firstValueFrom(
      this.http.get<AdminLesson[]>(`${this.apiUrl}/admin/courses/${courseId}/lessons`),
    );
    this.lessons.set(lessons);
  }

  async createLesson(payload: AdminLessonCreate): Promise<void> {
    this.error.set(null);
    await firstValueFrom(this.http.post(`${this.apiUrl}/admin/lessons`, payload));
    this.status.set(`Aula "${payload.title}" criada.`);
    await this.loadLessons(payload.course_id);
  }

  async updateLesson(lesson: AdminLesson): Promise<void> {
    this.error.set(null);
    await firstValueFrom(
      this.http.put(`${this.apiUrl}/admin/lessons/${lesson.id}`, {
        module_name: lesson.module_name.trim(),
        title: lesson.title.trim(),
        video_url: lesson.video_url.trim(),
        content_md: lesson.content_md.trim(),
        pdf_url: lesson.pdf_url?.trim() || null,
      }),
    );
    this.status.set(`Aula "${lesson.title}" atualizada.`);
    await this.loadLessons(lesson.course_id);
  }

  async deleteLesson(lesson: AdminLesson): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiUrl}/admin/lessons/${lesson.id}`));
    this.status.set(`Aula "${lesson.title}" excluída.`);
    await this.loadLessons(lesson.course_id);
  }

  async loadLessonQuiz(lessonId: number): Promise<LessonQuizPayload | null> {
    this.error.set(null);
    try {
      return await firstValueFrom(
        this.http.get<LessonQuizPayload>(`${this.apiUrl}/admin/lessons/${lessonId}/quiz`),
      );
    } catch {
      this.error.set('Não foi possível carregar as questões deste capítulo.');
      return null;
    }
  }

  async saveLessonQuiz(lessonId: number, questions: LessonQuizQuestion[]): Promise<boolean> {
    this.error.set(null);
    const body = {
      questions: questions.map((item) => ({
        prompt: item.prompt.trim(),
        options: item.options.map((option) => option.trim()),
        correct_index: Number(item.correct_index),
      })),
    };

    const url = `${this.apiUrl}/admin/lessons/${lessonId}/quiz`;
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };

    try {
      await firstValueFrom(this.http.post<LessonQuizPayload>(url, body, { headers }));
      this.status.set('10 questões do capítulo salvas com sucesso.');
      return true;
    } catch (postErr) {
      const postStatus = postErr instanceof HttpErrorResponse ? postErr.status : 0;
      if (postStatus !== 404 && postStatus !== 405) {
        this.error.set(this.formatApiError(postErr, 'Não foi possível salvar as questões.'));
        return false;
      }
    }

    try {
      await firstValueFrom(this.http.put<LessonQuizPayload>(url, body, { headers }));
      this.status.set('10 questões do capítulo salvas com sucesso.');
      return true;
    } catch (putErr) {
      this.error.set(this.formatApiError(putErr, 'Não foi possível salvar as questões.'));
      return false;
    }
  }

  private formatApiError(err: unknown, fallback: string): string {
    if (!(err instanceof HttpErrorResponse)) {
      return fallback;
    }
    const detail = err.error?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'msg' in item) {
            return String((item as { msg: string }).msg);
          }
          return null;
        })
        .filter((item): item is string => Boolean(item));
      if (messages.length > 0) {
        return messages.join(' · ');
      }
    }
    if (err.status === 0) {
      return 'Sem conexão com o servidor. Verifique se o backend está ativo.';
    }
    if (err.status === 401 || err.status === 403) {
      return 'Sessão expirada ou sem permissão. Faça login novamente como administrador.';
    }
    return fallback;
  }

  private blobResultToMediaUrl(result: { url: string; pathname?: string | null }): string {
    const pathname = result.pathname?.replace(/^\//, '');
    if (pathname) {
      return `${this.apiUrl}/media/${pathname}`;
    }
    if (result.url.startsWith('/api/media/')) {
      return result.url;
    }
    const fromBlob = result.url.match(/blob\.vercel-storage\.com\/(.+)$/);
    if (fromBlob?.[1]) {
      return `${this.apiUrl}/media/${fromBlob[1]}`;
    }
    return result.url;
  }

  async uploadLessonVideo(file: File): Promise<string> {
    this.error.set(null);
    const validationMessage = videoValidationError(file);
    if (validationMessage) {
      this.error.set(validationMessage);
      throw new Error(validationMessage);
    }

    if (environment.useBlobClientUpload && file.size > SERVER_VIDEO_UPLOAD_BYTES) {
      return this.uploadLessonVideoViaBlob(file);
    }

    const formData = new FormData();
    formData.append('file', file, file.name);
    try {
      const response = await firstValueFrom(
        this.http.post<{ video_url: string }>(`${this.apiUrl}/admin/lessons/upload-video`, formData),
      );
      this.status.set('Vídeo da aula enviado com sucesso.');
      return response.video_url;
    } catch (err) {
      const message = this.extractUploadError(err);
      this.error.set(message);
      throw new Error(message);
    }
  }

  async uploadLessonPdf(file: File): Promise<string> {
    this.error.set(null);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      const message = 'Formato inválido. Use arquivo PDF.';
      this.error.set(message);
      throw new Error(message);
    }

    const maxBytes = 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      const message = 'PDF muito grande. Máximo 25 MB.';
      this.error.set(message);
      throw new Error(message);
    }

    const formData = new FormData();
    formData.append('file', file, file.name);
    try {
      const response = await firstValueFrom(
        this.http.post<{ pdf_url: string }>(`${this.apiUrl}/admin/lessons/upload-pdf`, formData),
      );
      this.status.set('PDF da aula enviado com sucesso.');
      return response.pdf_url;
    } catch (err) {
      const message = this.extractUploadError(err);
      this.error.set(message);
      throw new Error(message);
    }
  }

  private async uploadLessonVideoViaBlob(file: File): Promise<string> {
    const token = this.auth.token();
    if (!token) {
      const message = 'Faça login para enviar vídeo.';
      this.error.set(message);
      throw new Error(message);
    }

    try {
      const blobAccess = environment.blobVideoAccess === 'private' ? 'private' : 'public';

      const result = await upload(file.name, file, {
        access: blobAccess,
        handleUploadUrl: environment.blobClientUploadUrl,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        multipart: file.size > 4 * 1024 * 1024,
        contentType: file.type || undefined,
      });
      this.status.set('Vídeo da aula enviado com sucesso.');
      return this.blobResultToMediaUrl(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no upload do vídeo via Blob.';
      this.error.set(message);
      throw new Error(message);
    }
  }

  private extractUploadError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const detail = err.error?.detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
      if (err.status === 0) return 'Sem conexão com o servidor. Verifique se o backend está ativo na porta 8000.';
      if (err.status === 413) return 'Vídeo muito grande. Máximo 100 MB.';
    }
    return 'Falha no upload do vídeo. Use MP4, WEBM ou MOV (até 100 MB).';
  }

  async sendStudentDetails(payload: {
    userId: number;
    courseId?: number | null;
    subject: string;
    details: string;
  }): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.post(
          `${this.apiUrl}/admin/messages`,
          {
            user_id: payload.userId,
            course_id: payload.courseId ?? null,
            subject: payload.subject.trim(),
            details: payload.details.trim(),
          },
          { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
        ),
      );
      this.status.set('Detalhes enviados para o aluno com sucesso.');
      await this.loadDashboardData();
    } catch {
      this.error.set('Falha ao enviar mensagem. Verifique aluno, assunto e detalhes.');
      throw new Error('Falha ao enviar mensagem.');
    }
  }
}
