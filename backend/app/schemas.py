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


class StudentMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    sent_by_admin_id: int
    course_id: int | None = None
    subject: str
    details: str
    created_at: datetime
