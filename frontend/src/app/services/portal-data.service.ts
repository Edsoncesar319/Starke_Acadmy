import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, prepareImageForUpload } from '../utils/image-upload.util';

export interface Course {
  id: number;
  title: string;
  category: string;
  description: string;
  price: number;
  rating: number;
  heroImageUrl: string | null;
}

export interface Enrollment {
  id: number;
  userId: number;
  courseId: number;
  progressPercentage: number;
  lastAccessed: string;
}

export interface StudentProfile {
  id: number;
  name: string;
  email: string;
  studentLevel: string;
  avatarUrl: string | null;
}

export interface Lesson {
  id: number;
  courseId: number;
  moduleName: string;
  title: string;
  videoUrl: string;
  contentMd: string;
}

export interface StudentMessage {
  id: number;
  userId: number;
  courseId: number | null;
  subject: string;
  details: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class PortalDataService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  readonly student = signal<StudentProfile>({
    id: 0,
    name: 'Loading student...',
    email: '',
    studentLevel: 'Gold Scholar',
    avatarUrl: null,
  });
  readonly status = signal<string | null>(null);
  readonly courses = signal<Course[]>([]);
  readonly enrollments = signal<Enrollment[]>([]);
  readonly lessons = signal<Lesson[]>([]);
  readonly messages = signal<StudentMessage[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly activeCourses = computed(() =>
    this.enrollments().map((enrollment) => {
      const course = this.courses().find((item) => item.id === enrollment.courseId);
      return {
        ...enrollment,
        course,
      };
    }),
  );

  readonly unreadMessagesCount = computed(() => {
    const userId = this.student().id;
    if (!userId) return 0;
    const lastSeenId = Number(localStorage.getItem(this.lastSeenMessageKey(userId)) ?? 0);
    return this.messages().filter((message) => message.id > lastSeenId).length;
  });

  async refreshPortalData(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const [me, courses, enrollments, messages] = await Promise.all([
        firstValueFrom(this.http.get<any>(`${this.apiUrl}/me`)),
        firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/courses`)),
        firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/enrollments`)),
        firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/messages`)),
      ]);

      this.student.set({
        id: me.id,
        name: me.name,
        email: me.email,
        studentLevel: me.student_level,
        avatarUrl: me.avatar_url,
      });
      this.courses.set(
        courses.map((course) => ({
          id: course.id,
          title: course.title,
          category: course.category,
          description: course.description,
          price: course.price,
          rating: course.rating,
          heroImageUrl: course.hero_image_url,
        })),
      );
      this.enrollments.set(
        enrollments.map((item) => ({
          id: item.id,
          userId: item.user_id,
          courseId: item.course_id,
          progressPercentage: item.progress_percentage,
          lastAccessed: item.last_accessed,
        })),
      );
      this.messages.set(
        messages.map((item) => ({
          id: item.id,
          userId: item.user_id,
          courseId: item.course_id,
          subject: item.subject,
          details: item.details,
          createdAt: item.created_at,
        })),
      );
    } catch {
      this.error.set('Could not load portal data. Ensure backend is running on port 8000.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async enrollInCourse(courseId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.apiUrl}/enrollments`,
          { course_id: courseId },
        ),
      );
      await this.refreshPortalData();
    } catch {
      this.error.set('Enrollment failed.');
    }
  }

  async updateProgress(courseId: number, progress: number): Promise<void> {
    const enrollment = this.enrollments().find((item) => item.courseId === courseId);
    if (!enrollment) return;

    try {
      await firstValueFrom(
        this.http.patch(
          `${this.apiUrl}/enrollments/${enrollment.id}/progress`,
          { progress_percentage: Math.max(0, Math.min(100, progress)) },
        ),
      );
      await this.refreshPortalData();
    } catch {
      this.error.set('Progress update failed.');
    }
  }

  async uploadAvatar(file: File): Promise<string> {
    this.error.set(null);
    this.status.set(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.error.set('Formato inválido. Use PNG, JPG ou WEBP.');
      throw new Error('Formato inválido.');
    }

    const preparedFile = await prepareImageForUpload(file);
    if (preparedFile.size > MAX_UPLOAD_BYTES) {
      this.error.set('Imagem muito grande. Use um arquivo menor.');
      throw new Error('Imagem muito grande.');
    }

    const formData = new FormData();
    formData.append('file', preparedFile);
    try {
      const response = await firstValueFrom(
        this.http.post<{ image_url: string; user: { avatar_url: string | null } }>(
          `${this.apiUrl}/me/upload-avatar`,
          formData,
        ),
      );
      this.student.update((current) => ({
        ...current,
        avatarUrl: response.user.avatar_url ?? response.image_url,
      }));
      this.status.set('Foto de perfil atualizada.');
      return response.image_url;
    } catch {
      this.error.set('Falha no upload da foto. Verifique formato e tamanho.');
      throw new Error('Falha no upload.');
    }
  }

  async updateProfile(payload: {
    name: string;
    email: string;
    avatarUrl: string | null;
    password: string | null;
  }): Promise<void> {
    this.error.set(null);
    this.status.set(null);
    try {
      const body: Record<string, string | null> = {
        name: payload.name.trim(),
        email: payload.email.trim(),
        avatar_url: payload.avatarUrl,
      };
      if (payload.password) {
        body['password'] = payload.password;
      }
      const me = await firstValueFrom(this.http.patch<any>(`${this.apiUrl}/me`, body));
      this.student.set({
        id: me.id,
        name: me.name,
        email: me.email,
        studentLevel: me.student_level,
        avatarUrl: me.avatar_url,
      });
      this.status.set('Perfil atualizado com sucesso.');
    } catch {
      this.error.set('Não foi possível atualizar o perfil. Verifique email e senha.');
    }
  }

  async refreshMessages(): Promise<void> {
    try {
      const messages = await firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/messages`));
      this.messages.set(
        messages.map((item) => ({
          id: item.id,
          userId: item.user_id,
          courseId: item.course_id,
          subject: item.subject,
          details: item.details,
          createdAt: item.created_at,
        })),
      );
    } catch {
      // Keep existing messages if refresh fails.
    }
  }

  markMessagesAsSeen(): void {
    const userId = this.student().id;
    if (!userId || this.messages().length === 0) return;
    const latestId = Math.max(...this.messages().map((message) => message.id));
    localStorage.setItem(this.lastSeenMessageKey(userId), String(latestId));
  }

  async loadLessonsForCourse(courseId: number): Promise<void> {
    try {
      const lessons = await firstValueFrom(
        this.http.get<any[]>(`${this.apiUrl}/courses/${courseId}/lessons`),
      );
      this.lessons.set(
        lessons.map((lesson) => ({
          id: lesson.id,
          courseId: lesson.course_id,
          moduleName: lesson.module_name,
          title: lesson.title,
          videoUrl: lesson.video_url,
          contentMd: lesson.content_md,
        })),
      );
    } catch {
      this.error.set('Could not load lessons.');
    }
  }

  private lastSeenMessageKey(userId: number): string {
    return `elite_last_seen_message_${userId}`;
  }

  clear(): void {
    this.student.set({
      id: 0,
      name: 'Loading student...',
      email: '',
      studentLevel: 'Gold Scholar',
      avatarUrl: null,
    });
    this.status.set(null);
    this.courses.set([]);
    this.enrollments.set([]);
    this.lessons.set([]);
    this.messages.set([]);
    this.error.set(null);
  }
}
