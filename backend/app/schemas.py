from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    student_level: str
    avatar_url: str | None = None
    is_admin: bool
    is_instructor: bool = False


class UserProfileUpdate(BaseModel):
    name: str
    email: EmailStr
    avatar_url: str | None = None
    password: str | None = None


class AdminStudentUpdate(BaseModel):
    name: str
    email: EmailStr
    student_level: str
    avatar_url: str | None = None
    is_instructor: bool = False


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    price: float
    category: str
    rating: float
    hero_image_url: str | None = None


class CourseCreate(BaseModel):
    title: str
    description: str
    price: float
    category: str
    rating: float
    hero_image_url: str | None = None


class CourseUpdate(BaseModel):
    title: str
    description: str
    price: float
    category: str
    rating: float
    hero_image_url: str | None = None


class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    module_name: str
    title: str
    video_url: str
    content_md: str
    pdf_url: str | None = None


class LessonCreate(BaseModel):
    course_id: int
    module_name: str
    title: str
    video_url: str = ""
    content_md: str = ""
    pdf_url: str | None = None


class LessonUpdate(BaseModel):
    module_name: str
    title: str
    video_url: str
    content_md: str
    pdf_url: str | None = None


class LessonQuizQuestionIn(BaseModel):
    prompt: str
    options: list[str]
    correct_index: int


class LessonQuizSave(BaseModel):
    questions: list[LessonQuizQuestionIn]


class LessonQuizQuestionStudentOut(BaseModel):
    position: int
    prompt: str
    options: list[str]


class LessonQuizQuestionAdminOut(LessonQuizQuestionStudentOut):
    correct_index: int


class LessonQuizStudentOut(BaseModel):
    lesson_id: int
    questions: list[LessonQuizQuestionStudentOut]


class LessonQuizAdminOut(BaseModel):
    lesson_id: int
    questions: list[LessonQuizQuestionAdminOut]


class LessonQuizSubmit(BaseModel):
    answers: list[int]


class LessonQuizSubmitResult(BaseModel):
    score: int
    total: int
    passed: bool
    minimum_score: int
    chapter_progress: int = 0
    course_contribution: int = 0
    course_progress: int = 0


class LessonProgressOut(BaseModel):
    lesson_id: int
    video_completed: bool
    quiz_passed: bool
    chapter_progress: int
    course_contribution: int = 0
    course_progress: int = 0


class CourseLessonProgressOut(BaseModel):
    course_id: int
    course_progress: int
    chapter_weight_percent: int = 10
    lessons: list[LessonProgressOut]


class EnrollmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    course_id: int
    progress_percentage: int
    last_accessed: datetime


class EnrollmentCreate(BaseModel):
    course_id: int


class ProgressUpdate(BaseModel):
    progress_percentage: int


class CheckoutCreate(BaseModel):
    course_id: int


class PurchaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    course_id: int
    amount_cents: int
    currency: str
    status: str
    provider: str
    provider_reference: str | None = None
    created_at: datetime
    paid_at: datetime | None = None


class CheckoutOut(BaseModel):
    purchase: PurchaseOut
    checkout_url: str | None = None


class PixCheckoutOut(BaseModel):
    purchase: PurchaseOut
    provider: str
    provider_reference: str
    qr_code_base64: str
    qr_code: str
    ticket_url: str | None = None


class TicketCreate(BaseModel):
    subject: str


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    subject: str
    status: str
    created_at: datetime


class StudentMessageCreate(BaseModel):
    user_id: int
    course_id: int | None = None
    subject: str
    details: str


class StudentMessageReplyCreate(BaseModel):
    course_id: int | None = None
    subject: str | None = None
    details: str


class StudentMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    sent_by_admin_id: int
    course_id: int | None = None
    subject: str
    details: str
    created_at: datetime
    is_from_student: bool = False

    @classmethod
    def from_orm_message(cls, message) -> "StudentMessageOut":
        return cls(
            id=message.id,
            user_id=message.user_id,
            sent_by_admin_id=message.sent_by_admin_id,
            course_id=message.course_id,
            subject=message.subject,
            details=message.details,
            created_at=message.created_at,
            is_from_student=message.sent_by_admin_id == message.user_id,
        )
