import os
from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .auth import (
    create_access_token,
    get_current_admin,
    get_current_content_manager,
    get_current_user,
    verify_password,
)
from .database import Base, SessionLocal, engine, ensure_schema_updates, get_db
from .storage import (
    UPLOAD_DIR,
    VIDEO_UPLOAD_DIR,
    blob_storage_enabled,
    max_video_bytes,
    on_vercel,
    upload_avatar_or_course_image,
    upload_lesson_video,
)
from .models import Course, Enrollment, Lesson, StudentMessage, Ticket, User
from .schemas import (
    CourseCreate,
    CourseOut,
    CourseUpdate,
    EnrollmentCreate,
    EnrollmentOut,
    LessonCreate,
    LessonOut,
    LessonUpdate,
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
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}
ALLOWED_VIDEO_MIME_TYPES = {
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/octet-stream",
    "binary/octet-stream",
}
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not blob_storage_enabled():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    VIDEO_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.middleware("http")
async def ensure_utf8_json(request, call_next):
    response = await call_next(request)
    content_type = response.headers.get("content-type", "")
    if content_type.startswith("application/json") and "charset" not in content_type:
        response.headers["content-type"] = "application/json; charset=utf-8"
    return response


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


async def _save_uploaded_image(file: UploadFile, *, blob_folder: str) -> str:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid image format")
    if file.content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image content type")

    content = await file.read()
    max_bytes = min(MAX_IMAGE_SIZE_BYTES, 4 * 1024 * 1024) if on_vercel() else MAX_IMAGE_SIZE_BYTES
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"Image too large (max {max_bytes // (1024 * 1024)}MB)")

    return await upload_avatar_or_course_image(
        content,
        extension,
        file.content_type or "application/octet-stream",
        blob_folder=blob_folder,
    )


async def _save_uploaded_video(file: UploadFile) -> str:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid video format. Use MP4, WEBM or MOV.")

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if (
        content_type
        and content_type not in ALLOWED_VIDEO_MIME_TYPES
        and not content_type.startswith("video/")
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de arquivo não suportado ({content_type}). Use MP4, WEBM ou MOV.",
        )

    content = await file.read()
    limit = max_video_bytes()
    if len(content) > limit:
        if on_vercel():
            raise HTTPException(
                status_code=400,
                detail="Video too large for server upload on Vercel (max 4MB). Use a smaller file or client-side upload.",
            )
        raise HTTPException(status_code=400, detail="Video too large (max 100MB)")

    return await upload_lesson_video(
        content,
        extension,
        file.content_type or "application/octet-stream",
    )


@app.post("/me/upload-avatar")
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admins must use admin routes")

    image_url = await _save_uploaded_image(file, blob_folder="avatars")
    current_user.avatar_url = image_url
    db.commit()
    db.refresh(current_user)
    return {"image_url": image_url, "user": current_user}


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
    return db.query(User).order_by(User.id.desc()).all()


@app.get("/admin/students", response_model=list[UserOut])
def admin_list_students(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return (
        db.query(User)
        .filter(User.is_admin.is_(False), User.is_instructor.is_(False))
        .order_by(User.id.desc())
        .all()
    )


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
    student.is_instructor = payload.is_instructor
    db.commit()
    db.refresh(student)
    return student


@app.post("/admin/students/{student_id}/upload-avatar")
async def admin_upload_student_avatar(
    student_id: int,
    file: UploadFile = File(...),
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    student = db.query(User).filter(User.id == student_id, User.is_admin.is_(False)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    image_url = await _save_uploaded_image(file, blob_folder="avatars")
    student.avatar_url = image_url
    db.commit()
    db.refresh(student)
    return {"image_url": image_url, "user": student}


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
    image_url = await _save_uploaded_image(file, blob_folder="course-images")
    return {"image_url": image_url}


@app.get("/admin/courses/{course_id}/lessons", response_model=list[LessonOut])
def admin_list_lessons(
    course_id: int,
    _: User = Depends(get_current_content_manager),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return db.query(Lesson).filter(Lesson.course_id == course_id).order_by(Lesson.id.asc()).all()


@app.post("/admin/lessons", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
def admin_create_lesson(
    payload: LessonCreate,
    _: User = Depends(get_current_content_manager),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    lesson = Lesson(
        course_id=payload.course_id,
        module_name=payload.module_name.strip(),
        title=payload.title.strip(),
        video_url=payload.video_url.strip(),
        content_md=payload.content_md.strip(),
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


@app.put("/admin/lessons/{lesson_id}", response_model=LessonOut)
def admin_update_lesson(
    lesson_id: int,
    payload: LessonUpdate,
    _: User = Depends(get_current_content_manager),
    db: Session = Depends(get_db),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    lesson.module_name = payload.module_name.strip()
    lesson.title = payload.title.strip()
    lesson.video_url = payload.video_url.strip()
    lesson.content_md = payload.content_md.strip()
    db.commit()
    db.refresh(lesson)
    return lesson


@app.delete("/admin/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_lesson(
    lesson_id: int,
    _: User = Depends(get_current_content_manager),
    db: Session = Depends(get_db),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    db.delete(lesson)
    db.commit()


@app.get("/admin/blob/upload-authorize")
def authorize_lesson_video_blob_upload(_: User = Depends(get_current_content_manager)):
    """Usado pelo handler Node de client upload do Vercel Blob."""
    return {"ok": True}


@app.post("/admin/lessons/upload-video")
async def admin_upload_lesson_video(
    file: UploadFile = File(...),
    _: User = Depends(get_current_content_manager),
):
    video_url = await _save_uploaded_video(file)
    return {"video_url": video_url}


# Composite app: API under /api; SPA/static em public/ (CDN + StaticFiles).
def _resolve_public_dir() -> Path | None:
    app_dir = Path(__file__).resolve().parent
    backend_root = app_dir.parent
    repo_root = backend_root.parent
    task_root = Path("/var/task")

    candidates: list[Path] = [
        app_dir / "public",
        repo_root / "public",
        backend_root / "public",
    ]
    if task_root.is_dir():
        candidates.extend(
            [
                task_root / "public",
                task_root / "backend" / "app" / "public",
                task_root / "backend" / "public",
            ]
        )

    for public in candidates:
        if (public / "index.html").is_file():
            return public
        nested = public / "browser"
        if (nested / "index.html").is_file():
            return nested
    return None


def _static_file(path: Path, media_type: str) -> FileResponse:
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, media_type=media_type)


def _favicon_paths() -> list[Path]:
    app_dir = Path(__file__).resolve().parent
    backend_root = app_dir.parent
    repo_root = backend_root.parent
    task_root = Path("/var/task")

    paths = [
        app_dir / "branding" / "favicon.ico",
        app_dir / "public" / "favicon.ico",
        repo_root / "public" / "favicon.ico",
        backend_root / "public" / "favicon.ico",
    ]
    if task_root.is_dir():
        paths.extend(
            [
                task_root / "public" / "favicon.ico",
                task_root / "backend" / "app" / "branding" / "favicon.ico",
                task_root / "backend" / "app" / "public" / "favicon.ico",
            ]
        )
    if PUBLIC_DIR:
        paths.insert(0, PUBLIC_DIR / "favicon.ico")
    return paths


PUBLIC_DIR = _resolve_public_dir()
elite_api = app
application = FastAPI(title="Starke Academy Portal")
application.mount("/api", elite_api)


@application.get("/favicon.ico", include_in_schema=False)
async def portal_favicon():
    for path in _favicon_paths():
        if path.is_file():
            return FileResponse(path, media_type="image/x-icon")
    raise HTTPException(status_code=404, detail="favicon not found")


if PUBLIC_DIR:
    application.mount(
        "/",
        StaticFiles(directory=str(PUBLIC_DIR), html=True),
        name="spa",
    )
else:

    @application.get("/")
    async def serve_portal_placeholder():
        return {
            "status": "ok",
            "message": "Execute: cd frontend && npm run build (gera /public na raiz)",
        }

    @application.get("/{full_path:path}")
    async def spa_route_missing(full_path: str):
        if full_path.startswith("api") or full_path == "favicon.ico":
            raise HTTPException(status_code=404, detail="Not found")
        raise HTTPException(
            status_code=503,
            detail=(
                "Portal não publicado. Rode 'npm run build' no frontend "
                "ou use 'npm start' em http://localhost:4200."
            ),
        )


def _vercel_api_only() -> bool:
    return os.environ.get("VERCEL") == "1"


# Na Vercel: serviço backend só em /api (rotas sem prefixo /api no app).
# Local: portal composto (SPA + API em /api).
app = elite_api if _vercel_api_only() else application
