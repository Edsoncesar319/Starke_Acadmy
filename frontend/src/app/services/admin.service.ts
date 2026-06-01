import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

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
}

export interface AdminSentMessage {
  id: number;
  user_id: number;
  course_id: number | null;
  subject: string;
  details: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly apiUrl = environment.apiUrl;
  readonly courses = signal<AdminCourse[]>([]);
  readonly students = signal<AdminUser[]>([]);
  readonly sentMessages = signal<AdminSentMessage[]>([]);
  readonly status = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  private readonly maxUploadBytes = 5 * 1024 * 1024;

  constructor(private readonly http: HttpClient) {}

  async loadDashboardData(): Promise<void> {
    const [courses, users] = await Promise.all([
      firstValueFrom(this.http.get<AdminCourse[]>(`${this.apiUrl}/courses`)),
      firstValueFrom(this.http.get<AdminUser[]>(`${this.apiUrl}/admin/users`)),
    ]);
    this.courses.set(courses);
    this.students.set(users.filter((user) => !user.is_admin));
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

  async deleteCourse(courseId: number, courseTitle: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiUrl}/admin/courses/${courseId}`));
    this.status.set(`Curso "${courseTitle}" excluido.`);
    await this.loadDashboardData();
  }

  async uploadCourseImage(file: File): Promise<string> {
    this.error.set(null);
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Formato inválido. Use PNG, JPG ou WEBP.');
    }

    const preparedFile = await this.optimizeImage(file);
    if (preparedFile.size > this.maxUploadBytes) {
      throw new Error('Imagem muito grande mesmo após compressão. Use um arquivo menor.');
    }

    const formData = new FormData();
    formData.append('file', preparedFile);
    try {
      const response = await firstValueFrom(
        this.http.post<{ image_url: string }>(`${this.apiUrl}/admin/courses/upload-image`, formData),
      );
      this.status.set('Imagem enviada com sucesso.');
      return response.image_url;
    } catch {
      this.error.set('Falha no upload da imagem. Verifique formato e tamanho.');
      throw new Error('Falha no upload da imagem.');
    }
  }

  private async optimizeImage(file: File): Promise<File> {
    // Keep small files untouched for max quality.
    if (file.size <= 900 * 1024) return file;

    const image = await this.loadImage(file);
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.floor(image.width * scale));
    const height = Math.max(1, Math.floor(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);

    const outputType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, 0.82);
    });
    if (!blob) return file;

    const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${file.name.replace(/\.[^/.]+$/, '')}.${extension}`;
    return new File([blob], filename, { type: outputType });
  }

  private async loadImage(file: File): Promise<HTMLImageElement> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async updateStudent(
    studentId: number,
    payload: {
      name: string;
      email: string;
      studentLevel: string;
      avatarUrl: string | null;
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
        }),
      );
      this.status.set(`Perfil do aluno "${payload.name}" atualizado.`);
      await this.loadDashboardData();
    } catch {
      this.error.set('Falha ao atualizar perfil do aluno.');
      throw new Error('Falha ao atualizar perfil do aluno.');
    }
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
