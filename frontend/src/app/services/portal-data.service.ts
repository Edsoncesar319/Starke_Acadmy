import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, prepareImageForUpload } from '../utils/image-upload.util';
import { printPaymentReceipt, purchaseToReceiptData } from '../utils/payment-receipt.util';

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
  pdfUrl: string | null;
}

export interface StudentMessage {
  id: number;
  userId: number;
  sentByAdminId: number;
  isFromStudent: boolean;
  courseId: number | null;
  subject: string;
  details: string;
  createdAt: string;
}

export interface PixCheckout {
  purchase: {
    id: number;
    status: string;
    course_id: number;
  };
  provider: string;
  provider_reference: string;
  qr_code_base64: string;
  qr_code: string;
  ticket_url: string | null;
  pix_key?: string | null;
  amount_brl?: number | null;
  merchant_name?: string | null;
}

export interface Purchase {
  id: number;
  user_id: number;
  course_id: number;
  amount_cents: number;
  currency: string;
  status: string;
  provider: string;
  provider_reference: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface ChapterQuizQuestion {
  position: number;
  prompt: string;
  options: string[];
}

export interface ChapterQuizSubmitResult {
  score: number;
  total: number;
  passed: boolean;
  minimum_score: number;
  chapter_progress: number;
  course_contribution: number;
  course_progress: number;
}

export interface LessonProgress {
  lesson_id: number;
  video_completed: boolean;
  quiz_passed: boolean;
  chapter_progress: number;
  course_contribution: number;
  course_progress: number;
}

export interface CourseLessonProgressBundle {
  course_id: number;
  course_progress: number;
  chapter_weight_percent: number;
  lessons: LessonProgress[];
}

@Injectable({ providedIn: 'root' })
export class PortalDataService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = environment.apiUrl;

  readonly student = signal<StudentProfile>({
    id: 0,
    name: 'Carregando...',
    email: '',
    studentLevel: 'Aluno Elite',
    avatarUrl: null,
  });
  readonly status = signal<string | null>(null);
  readonly courses = signal<Course[]>([]);
  readonly enrollments = signal<Enrollment[]>([]);
  readonly lessons = signal<Lesson[]>([]);
  readonly messages = signal<StudentMessage[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pixCheckout = signal<PixCheckout | null>(null);
  readonly pixModalOpen = signal(false);
  readonly pixStatus = signal<string | null>(null);
  readonly purchases = signal<Purchase[]>([]);
  /** Incrementado a cada sincronização de progresso (UI reativa). */
  readonly progressTick = signal(0);

  readonly activeCourses = computed(() =>
    this.enrollments()
      .filter((enrollment) => this.hasCourseAccess(enrollment.courseId))
      .map((enrollment) => {
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
    return this.messages().filter((message) => !message.isFromStudent && message.id > lastSeenId).length;
  });

  /** Cursos pagos sem acesso liberado e sem cobrança PIX em andamento. */
  readonly coursesAwaitingPayment = computed(() => {
    const coveredCourseIds = new Set(
      this.purchases()
        .filter((item) => item.status === 'paid' || this.isPurchaseAwaitingPayment(item))
        .map((item) => item.course_id),
    );

    return this.courses().filter(
      (course) =>
        (course.price || 0) > 0 && !this.hasCourseAccess(course.id) && !coveredCourseIds.has(course.id),
    );
  });

  isPurchaseAwaitingPayment(purchase: Purchase): boolean {
    return ['pending', 'approved', 'in_process', 'in_mediation'].includes(purchase.status);
  }

  isPurchaseAwaitingAdminRelease(purchase: Purchase): boolean {
    return purchase.status === 'approved';
  }

  canConfirmPaymentManually(_purchase: Purchase): boolean {
    return false;
  }

  hasPaidPurchase(courseId: number): boolean {
    return this.purchases().some((item) => item.course_id === courseId && item.status === 'paid');
  }

  /** Matrícula válida: gratuito com enroll ou pago com pagamento confirmado. */
  hasCourseAccess(courseId: number): boolean {
    const enrolled = this.enrollments().some((item) => item.courseId === courseId);
    if (!enrolled) return false;

    const course = this.courses().find((item) => item.id === courseId);
    if (!course || (course.price || 0) <= 0) return true;

    return this.hasPaidPurchase(courseId);
  }

  async refreshPortalData(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const [me, courses, enrollments, messages, purchases] = await Promise.all([
        firstValueFrom(this.http.get<any>(`${this.apiUrl}/me`)),
        firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/courses`)),
        firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/enrollments`)),
        firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/messages`)),
        firstValueFrom(this.http.get<Purchase[]>(`${this.apiUrl}/purchases`)),
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
      this.messages.set(messages.map((item) => this.mapStudentMessage(item)));
      this.purchases.set(purchases);
    } catch {
      this.error.set('Não foi possível carregar os dados. Verifique se o backend está em execução na porta 8000.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Atualiza matrículas/progresso do servidor sem recarregar o portal inteiro. */
  async refreshEnrollments(): Promise<void> {
    if (!this.auth.token()) return;
    try {
      const enrollments = await firstValueFrom(
        this.http.get<Array<{ id: number; user_id: number; course_id: number; progress_percentage: number; last_accessed: string }>>(
          `${this.apiUrl}/enrollments`,
        ),
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
      this.progressTick.update((n) => n + 1);
    } catch {
      // Mantém dados locais se a rede falhar.
    }
  }

  /** Painel: matrículas + progresso calculado por capítulo (tempo real). */
  async refreshDashboardCourseProgress(): Promise<void> {
    if (!this.auth.token() || this.auth.isContentManager()) return;

    await this.refreshEnrollments();
    const enrolled = [...this.enrollments()];
    if (enrolled.length === 0) return;

    const bundles = await Promise.all(
      enrolled.map((item) => this.loadCourseLessonProgress(item.courseId)),
    );

    for (let i = 0; i < enrolled.length; i++) {
      const bundle = bundles[i];
      if (!bundle) continue;
      if (bundle.course_progress !== enrolled[i].progressPercentage) {
        this.applyCourseProgressForCourse(enrolled[i].courseId, bundle.course_progress);
      }
    }
  }

  private async syncProgressFromServer(courseId: number, fallbackCourseProgress?: number): Promise<void> {
    if (typeof fallbackCourseProgress === 'number') {
      this.applyCourseProgressForCourse(courseId, fallbackCourseProgress);
    }
    await this.refreshEnrollments();
  }

  async enrollInCourse(courseId: number): Promise<'enrolled' | 'payment' | 'already' | 'error'> {
    this.error.set(null);
    this.status.set(null);

    const course = this.courses().find((item) => item.id === courseId);
    const courseTitle = course?.title ?? 'curso';

    if (this.hasCourseAccess(courseId)) {
      this.status.set(`Você já está matriculado em "${courseTitle}".`);
      return 'already';
    }

    if (course && (course.price || 0) > 0 && !this.hasPaidPurchase(courseId)) {
      const started = await this.startPixCheckout(courseId);
      if (!started) return 'error';
      this.status.set(
        `Para se matricular em "${courseTitle}", finalize o pagamento PIX. As aulas são liberadas após confirmação do administrador.`,
      );
      return 'payment';
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${this.apiUrl}/enrollments`,
          { course_id: courseId },
        ),
      );
      await this.refreshPortalData();
      this.status.set(
        `Matrícula confirmada em "${courseTitle}"! Você já pode acessar o curso no painel e nas aulas.`,
      );
      return 'enrolled';
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 402) {
        await this.startPixCheckout(courseId);
        this.status.set(
          `Para se matricular em "${courseTitle}", finalize o pagamento PIX. As aulas são liberadas após confirmação do administrador.`,
        );
        return 'payment';
      }
      this.error.set('Não foi possível concluir a matrícula no curso.');
      return 'error';
    }
  }

  async cancelEnrollment(enrollmentId: number): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/enrollments/${enrollmentId}`));
      await this.refreshPortalData();
      this.status.set('Matrícula removida com sucesso.');
      return true;
    } catch {
      this.error.set('Não foi possível remover a matrícula.');
      return false;
    }
  }

  async startPixCheckout(courseId: number): Promise<boolean> {
    this.error.set(null);
    this.pixStatus.set('Gerando PIX...');
    try {
      const checkout = await firstValueFrom(
        this.http.post<PixCheckout>(`${this.apiUrl}/checkout/pix`, { course_id: courseId }),
      );
      this.pixCheckout.set(checkout);
      this.pixStatus.set('Aguardando pagamento...');
      await this.refreshPurchases();
      return true;
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((item) => (item as { msg?: string }).msg).filter(Boolean).join(' ')
            : null;
      this.error.set(message || 'Não foi possível gerar o PIX. Tente novamente.');
      this.pixCheckout.set(null);
      this.pixStatus.set(null);
      return false;
    }
  }

  async pollPixStatus(purchaseId: number): Promise<void> {
    const checkout = this.pixCheckout();
    const isMercadoPago = checkout?.provider === 'mercadopago';
    const timeoutMs = isMercadoPago ? 300_000 : 120_000;
    const start = Date.now();

    while (Date.now() - start < timeoutMs && this.pixModalOpen()) {
      try {
        const purchase = await firstValueFrom(
          this.http.get<{ id: number; status: string; course_id: number }>(`${this.apiUrl}/purchases/${purchaseId}`),
        );
        if (purchase.status === 'paid') {
          const current = this.pixCheckout();
          if (current) {
            this.pixCheckout.set({
              ...current,
              purchase: {
                id: purchase.id,
                status: purchase.status,
                course_id: purchase.course_id,
              },
            });
          }
          this.pixStatus.set('Pagamento confirmado! Comprovante disponível no seu painel.');
          await this.refreshPortalData();
          await this.refreshPurchases();
          return;
        }
        if (purchase.status === 'approved') {
          this.pixStatus.set(
            'Pagamento recebido. Aguarde o administrador liberar suas aulas — você será notificado no painel.',
          );
          await this.refreshPurchases();
          return;
        }
      } catch {
        // ignora erros temporários
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    if (this.pixModalOpen()) {
      this.pixStatus.set(
        isMercadoPago
          ? 'Pagamento ainda não confirmado. Se já pagou, aguarde mais um pouco ou atualize a página.'
          : 'Pagamento não confirmado ainda. Você pode aguardar e tentar novamente.',
      );
    }
  }

  async confirmPayment(purchaseId: number): Promise<boolean> {
    this.error.set(null);
    this.pixStatus.set('Confirmando pagamento...');
    try {
      const purchase = await firstValueFrom(
        this.http.post<Purchase>(`${this.apiUrl}/purchases/${purchaseId}/confirm-payment`, {}),
      );
      const checkout = this.pixCheckout();
      if (checkout) {
        this.pixCheckout.set({
          ...checkout,
          purchase: {
            id: purchase.id,
            status: purchase.status,
            course_id: purchase.course_id,
          },
        });
      }
      await this.refreshPortalData();
      await this.refreshPurchases();
      this.pixStatus.set('Pagamento confirmado! Comprovante enviado no seu chat e painel.');
      return true;
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
      const message = typeof detail === 'string' ? detail : null;
      this.error.set(message || 'Não foi possível confirmar o pagamento.');
      this.pixStatus.set(null);
      return false;
    }
  }

  async refreshPurchases(): Promise<void> {
    try {
      const purchases = await firstValueFrom(
        this.http.get<Purchase[]>(`${this.apiUrl}/purchases`),
      );
      this.purchases.set(purchases);
    } catch {
      this.error.set('Não foi possível carregar seus pagamentos.');
    }
  }

  printPurchaseReceipt(purchase: Purchase, courseTitle: string): boolean {
    if (purchase.status !== 'paid') {
      this.error.set('Só é possível imprimir comprovante de compras pagas.');
      return false;
    }
    const receipt = purchaseToReceiptData(purchase, this.student(), courseTitle);
    const opened = printPaymentReceipt(receipt);
    if (!opened) {
      this.error.set('Permita pop-ups neste site para imprimir o comprovante.');
      return false;
    }
    this.error.set(null);
    return true;
  }

  async deletePurchase(purchaseId: number): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/purchases/${purchaseId}`));
      this.purchases.update((list) => list.filter((item) => item.id !== purchaseId));
      this.status.set('Compra removida.');
      return true;
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
      const message = typeof detail === 'string' ? detail : null;
      this.error.set(message || 'Não foi possível remover a compra.');
      return false;
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
      this.error.set('Não foi possível atualizar o progresso.');
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
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
      const message = typeof detail === 'string' ? detail : null;
      this.error.set(message || 'Falha no upload da foto. Verifique formato e tamanho.');
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
    if (!this.auth.isAuthenticated() || !this.auth.isStudent()) {
      return;
    }
    try {
      const messages = await firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/messages`));
      this.messages.set(messages.map((item) => this.mapStudentMessage(item)));
    } catch {
      // Keep existing messages if refresh fails.
    }
  }

  async sendStudentMessage(payload: {
    details: string;
    subject?: string;
    courseId?: number | null;
  }): Promise<StudentMessage | null> {
    this.error.set(null);
    const details = payload.details.trim();
    if (!details) {
      this.error.set('Digite uma mensagem antes de enviar.');
      return null;
    }
    try {
      const created = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/messages`, {
          subject: payload.subject?.trim() || null,
          details,
          course_id: payload.courseId ?? null,
        }),
      );
      const mapped = this.mapStudentMessage(created);
      this.messages.update((list) => [...list, mapped]);
      return mapped;
    } catch (err) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.error.set(typeof detail === 'string' ? detail : 'Não foi possível enviar a mensagem.');
      return null;
    }
  }

  private mapStudentMessage(item: {
    id: number;
    user_id: number;
    sent_by_admin_id: number;
    is_from_student?: boolean;
    course_id: number | null;
    subject: string;
    details: string;
    created_at: string;
  }): StudentMessage {
    const isFromStudent = item.is_from_student ?? item.sent_by_admin_id === item.user_id;
    return {
      id: item.id,
      userId: item.user_id,
      sentByAdminId: item.sent_by_admin_id,
      isFromStudent,
      courseId: item.course_id,
      subject: item.subject,
      details: item.details,
      createdAt: item.created_at,
    };
  }

  markMessagesAsSeen(): void {
    const userId = this.student().id;
    if (!userId || this.messages().length === 0) return;
    const latestId = Math.max(...this.messages().map((message) => message.id));
    localStorage.setItem(this.lastSeenMessageKey(userId), String(latestId));
  }

  async loadLessonQuiz(lessonId: number): Promise<ChapterQuizQuestion[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ lesson_id: number; questions: ChapterQuizQuestion[] }>(
          `${this.apiUrl}/lessons/${lessonId}/quiz`,
        ),
      );
      return response.questions;
    } catch {
      this.error.set('Não foi possível carregar a avaliação deste capítulo.');
      return [];
    }
  }

  async submitLessonQuiz(
    lessonId: number,
    courseId: number,
    answers: number[],
  ): Promise<ChapterQuizSubmitResult | null> {
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<ChapterQuizSubmitResult>(`${this.apiUrl}/lessons/${lessonId}/quiz/submit`, {
          answers,
        }),
      );
      await this.syncProgressFromServer(courseId, result.course_progress);
      return result;
    } catch (err) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.error.set(typeof detail === 'string' ? detail : 'Não foi possível enviar a avaliação.');
      return null;
    }
  }

  async loadLessonProgress(lessonId: number): Promise<LessonProgress | null> {
    try {
      return await firstValueFrom(
        this.http.get<LessonProgress>(`${this.apiUrl}/lessons/${lessonId}/progress`),
      );
    } catch {
      return null;
    }
  }

  async loadCourseLessonProgress(courseId: number): Promise<CourseLessonProgressBundle | null> {
    try {
      return await firstValueFrom(
        this.http.get<CourseLessonProgressBundle>(`${this.apiUrl}/courses/${courseId}/lesson-progress`),
      );
    } catch {
      return null;
    }
  }

  async markLessonVideoComplete(lessonId: number, courseId: number): Promise<LessonProgress | null> {
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<LessonProgress>(`${this.apiUrl}/lessons/${lessonId}/progress/video`, {}),
      );
      await this.syncProgressFromServer(courseId, result.course_progress);
      return result;
    } catch (err) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.error.set(typeof detail === 'string' ? detail : 'Não foi possível registrar o vídeo assistido.');
      return null;
    }
  }

  applyCourseProgressForCourse(courseId: number, progress: number): void {
    this.enrollments.update((list) =>
      list.map((item) => (item.courseId === courseId ? { ...item, progressPercentage: progress } : item)),
    );
    this.progressTick.update((n) => n + 1);
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
          pdfUrl: lesson.pdf_url ?? null,
        })),
      );
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 402) {
        this.error.set('Pagamento pendente. Conclua o PIX para liberar as aulas deste curso.');
      } else if (status === 403) {
        this.error.set('Matricule-se no curso para acessar as aulas.');
      } else {
        this.error.set('Não foi possível carregar as aulas.');
      }
      this.lessons.set([]);
    }
  }

  private lastSeenMessageKey(userId: number): string {
    return `elite_last_seen_message_${userId}`;
  }

  clear(): void {
    this.student.set({
      id: 0,
      name: 'Carregando...',
      email: '',
      studentLevel: 'Aluno Elite',
      avatarUrl: null,
    });
    this.status.set(null);
    this.courses.set([]);
    this.enrollments.set([]);
    this.lessons.set([]);
    this.messages.set([]);
    this.purchases.set([]);
    this.pixCheckout.set(null);
    this.pixModalOpen.set(false);
    this.pixStatus.set(null);
    this.error.set(null);
  }
}
