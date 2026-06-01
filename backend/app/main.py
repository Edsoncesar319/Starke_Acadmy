from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.orm import Session

from .auth import create_access_token, get_current_admin, get_current_user, verify_password
from .database import Base, SessionLocal, engine, get_db
from .models import Course, Enrollment, Lesson, StudentMessage, Ticket, User
from .schemas import (
    CourseCreate,
    CourseOut,
    CourseUpdate,
    EnrollmentCreate,
    EnrollmentOut,
    ProgressUpdate,
    StudentMessageCreate,
    StudentMessageOut,
    TicketCreate,
    TicketOut,
    Token,
    AdminStudentUpdate,
    UserCreate,
    UserOut,
    UserProfileUpdate,
)
from .seed import seed_data

app = FastAPI(title="Starke Academy Elite API", version="1.0.0")
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.middleware("http")
async def ensure_utf8_json(request, call_next):
    response = await call_next(request)
    content_type = response.headers.get("content-type", "")
    if content_type.startswith("application/json") and "charset" not in content_type:
        response.headers["content-type"] = "application/json; charset=utf-8"
    return response


def ensure_schema_updates() -> None:
    with engine.begin() as connection:
        result = connection.execute(text("PRAGMA table_info(users)")).mappings().all()
        columns = {row["name"] for row in result}
        if "is_admin" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema_updates()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    from .auth import get_password_hash

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        student_level="Gold Scholar",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token)


@app.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.patch("/me", response_model=UserOut)
def update_me(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admins must use admin profile routes")

    existing = db.query(User).filter(User.email == payload.email, User.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    from .auth import get_password_hash

    current_user.name = payload.name.strip()
    current_user.email = payload.email
    current_user.avatar_url = payload.avatar_url or None
    if payload.password:
        current_user.password_hash = get_password_hash(payload.password)

    db.commit()
    db.refresh(current_user)
    return current_user


@app.get("/courses", response_model=list[CourseOut])
def list_courses(db: Session = Depends(get_db)):
    return db.query(Course).all()


@app.get("/courses/{course_id}/lessons")
def list_course_lessons(course_id: int, db: Session = Depends(get_db)) -> list[dict]:
    lessons = db.query(Lesson).filter(Lesson.course_id == course_id).all()
    return [
        {
            "id": lesson.id,
            "course_id": lesson.course_id,
            "module_name": lesson.module_name,
            "title": lesson.title,
            "video_url": lesson.video_url,
            "content_md": lesson.content_md,
        }
        for lesson in lessons
    ]


@app.get("/enrollments", response_model=list[EnrollmentOut])
def list_enrollments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Enrollment).filter(Enrollment.user_id == current_user.id).all()


@app.post("/enrollments", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
def enroll(
    payload: EnrollmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current_user.id, Enrollment.course_id == payload.course_id)
        .first()
    )
    if existing:
        return existing

    enrollment = Enrollment(
        user_id=current_user.id,
        course_id=payload.course_id,
        progress_percentage=0,
        last_accessed=datetime.utcnow(),
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


@app.patch("/enrollments/{enrollment_id}/progress", response_model=EnrollmentOut)
def update_progress(
    enrollment_id: int,
    payload: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.id == enrollment_id, Enrollment.user_id == current_user.id)
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    enrollment.progress_percentage = max(0, min(100, payload.progress_percentage))
    enrollment.last_accessed = datetime.utcnow()
    db.commit()
    db.refresh(enrollment)
    return enrollment


@app.get("/tickets", response_model=list[TicketOut])
def list_tickets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Ticket).filter(Ticket.user_id == current_user.id).all()


@app.post("/tickets", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = Ticket(user_id=current_user.id, subject=payload.subject, status="open")
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@app.get("/messages", response_model=list[StudentMessageOut])
def list_student_messages(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(StudentMessage)
        .filter(StudentMessage.user_id == current_user.id)
        .order_by(StudentMessage.created_at.desc())
        .all()
    )


@app.get("/admin/users", response_model=list[UserOut])
def admin_list_users(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.name.asc()).all()


@app.patch("/admin/students/{student_id}", response_model=UserOut)
def admin_update_student(
    student_id: int,
    payload: AdminStudentUpdate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    student = db.query(User).filter(User.id == student_id, User.is_admin.is_(False)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = db.query(User).filter(User.email == payload.email, User.id != student_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    student.name = payload.name.strip()
    student.email = payload.email
    student.student_level = payload.student_level.strip()
    student.avatar_url = payload.avatar_url or None
    db.commit()
    db.refresh(student)
    return student


@app.post("/admin/courses", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def admin_create_course(
    payload: CourseCreate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    course = Course(
        title=payload.title,
        description=payload.description,
        price=payload.price,
        category=payload.category,
        rating=payload.rating,
        hero_image_url=payload.hero_image_url,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@app.put("/admin/courses/{course_id}", response_model=CourseOut)
def admin_update_course(
    course_id: int,
    payload: CourseUpdate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course.title = payload.title
    course.description = payload.description
    course.price = payload.price
    course.category = payload.category
    course.rating = payload.rating
    course.hero_image_url = payload.hero_image_url
    db.commit()
    db.refresh(course)
    return course


@app.delete("/admin/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_course(
    course_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    db.delete(course)
    db.commit()


@app.post("/admin/messages", response_model=StudentMessageOut, status_code=status.HTTP_201_CREATED)
def admin_send_message(
    payload: StudentMessageCreate,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    student = db.query(User).filter(User.id == payload.user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    message = StudentMessage(
        user_id=payload.user_id,
        sent_by_admin_id=admin_user.id,
        course_id=payload.course_id,
        subject=payload.subject,
        details=payload.details,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@app.get("/admin/messages", response_model=list[StudentMessageOut])
def admin_list_messages(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return db.query(StudentMessage).order_by(StudentMessage.created_at.desc()).all()


@app.post("/admin/courses/upload-image")
async def admin_upload_course_image(
    file: UploadFile = File(...),
    _: User = Depends(get_current_admin),
):
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid image format")
    if file.content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image content type")

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")

    filename = f"{uuid4().hex}{extension}"
    destination = UPLOAD_DIR / filename
    destination.write_bytes(content)
    return {"image_url": f"http://127.0.0.1:8000/uploads/{filename}"}
