import os
import json
from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from uuid import uuid4

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
    upload_lesson_pdf,
    upload_lesson_video,
)
from .models import (
    Course,
    Enrollment,
    Lesson,
    LessonProgress,
    PaymentEvent,
    Purchase,
    StudentMessage,
    Ticket,
    User,
)
from .payments import finalize_purchase_as_paid
from .pix_brcode import build_pix_copia_cola, pix_qr_code_base64
from .schemas import (
    CourseCreate,
    CourseOut,
    CourseUpdate,
    EnrollmentCreate,
    EnrollmentOut,
    CheckoutCreate,
    CheckoutOut,
    PixCheckoutOut,
    LessonCreate,
    LessonOut,
    LessonUpdate,
    ProgressUpdate,
    PurchaseOut,
    StudentMessageCreate,
    StudentMessageOut,
    StudentMessageReplyCreate,
    TicketCreate,
    TicketOut,
    Token,
    AdminStudentUpdate,
    UserCreate,
    UserOut,
    UserProfileUpdate,
    LessonQuizAdminOut,
    LessonQuizSave,
    LessonQuizStudentOut,
    LessonQuizSubmit,
    LessonQuizSubmitResult,
    LessonProgressOut,
    CourseLessonProgressOut,
)
from .lesson_progress import (
    course_lesson_progress_list,
    lesson_progress_dict,
    mark_quiz_passed,
    mark_video_completed,
)
from .lesson_quiz import (
    QUIZ_SIZE,
    ensure_lesson_quiz,
    get_lesson_quiz_rows,
    question_to_admin_dict,
    question_to_student_dict,
    save_lesson_quiz,
    score_quiz_answers,
    seed_quizzes_for_existing_lessons,
)
from .seed import seed_data

_backend_root = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv

    load_dotenv(_backend_root / ".env")
except ImportError:
    pass

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
ALLOWED_PDF_EXTENSIONS = {".pdf"}
ALLOWED_PDF_MIME_TYPES = {"application/pdf"}


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

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


_startup_done = False


def _run_startup() -> None:
    global _startup_done
    if _startup_done:
        return
    _startup_done = True
    ensure_schema_updates()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_data(db)
        seed_quizzes_for_existing_lessons(db)
    finally:
        db.close()


@app.on_event("startup")
def on_elite_api_startup() -> None:
    _run_startup()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/build-id")
def build_id():
    # Endpoint usado apenas para confirmar se a Vercel implantou este commit.
    return {"build_id": "vercel-fix-521534b"}


@app.post("/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    from .auth import get_password_hash

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        student_level="Aluno Elite",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

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
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

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


async def _save_uploaded_pdf(file: UploadFile) -> str:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_PDF_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid PDF format. Use .pdf.")

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in ALLOWED_PDF_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo de arquivo não suportado ({content_type}). Use PDF.")

    content = await file.read()
    max_bytes = 4 * 1024 * 1024 if on_vercel() else 25 * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"PDF too large (max {max_bytes // (1024 * 1024)}MB)")

    return await upload_lesson_pdf(
        content,
        extension,
        file.content_type or "application/pdf",
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


def _to_cents(amount: float) -> int:
    return max(0, int(round((amount or 0) * 100)))


def _pix_receiver_key() -> str | None:
    key = os.getenv("PIX_RECEIVER_KEY", "").strip()
    return key or None


def _pix_merchant_name() -> str:
    return os.getenv("PIX_MERCHANT_NAME", "Starke Academy").strip() or "Starke Academy"


def _pix_merchant_city() -> str:
    return os.getenv("PIX_MERCHANT_CITY", "Sao Paulo").strip() or "Sao Paulo"


def _mercadopago_enabled() -> bool:
    return bool(os.getenv("MERCADOPAGO_ACCESS_TOKEN") or os.getenv("MP_ACCESS_TOKEN"))


def _pix_mock_enabled() -> bool:
    if _pix_receiver_key():
        return False
    flag = os.getenv("PIX_CHECKOUT_MOCK", "").strip().lower()
    if flag in ("1", "true", "yes"):
        return True
    if flag in ("0", "false", "no"):
        return False
    if on_vercel():
        return False
    return not _mercadopago_enabled()


def _static_pix_checkout_response(purchase: Purchase, course: Course) -> dict:
    pix_key = _pix_receiver_key()
    if not pix_key:
        raise HTTPException(status_code=503, detail="Chave PIX não configurada (PIX_RECEIVER_KEY).")

    txid = f"COMPRA{purchase.id}"
    copia_cola = build_pix_copia_cola(
        pix_key=pix_key,
        amount_brl=purchase.amount_cents / 100.0,
        merchant_name=_pix_merchant_name(),
        merchant_city=_pix_merchant_city(),
        txid=txid,
    )
    try:
        qr_base64 = pix_qr_code_base64(copia_cola)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Não foi possível gerar o QR Code PIX: {exc}",
        ) from exc

    purchase.provider = "pix"
    purchase.provider_reference = txid
    return {
        "purchase": purchase,
        "provider": "pix",
        "provider_reference": txid,
        "qr_code_base64": qr_base64,
        "qr_code": copia_cola,
        "ticket_url": None,
    }


# 1x1 PNG placeholder for local/dev PIX UI.
_MOCK_PIX_QR_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _mock_pix_checkout_response(purchase: Purchase) -> dict:
    ref = f"mock-{purchase.id}"
    purchase.provider = "mock"
    purchase.provider_reference = ref
    return {
        "purchase": purchase,
        "provider": "mock",
        "provider_reference": ref,
        "qr_code_base64": _MOCK_PIX_QR_BASE64,
        "qr_code": f"PIX-DEV-MOCK-{purchase.id}",
        "ticket_url": None,
    }


def _mp_sdk():
    token = os.getenv("MERCADOPAGO_ACCESS_TOKEN") or os.getenv("MP_ACCESS_TOKEN")
    if not token:
        raise HTTPException(
            status_code=503,
            detail="Mercado Pago não configurado. Defina MERCADOPAGO_ACCESS_TOKEN ou use PIX_CHECKOUT_MOCK=true em dev.",
        )
    import mercadopago  # type: ignore

    return mercadopago.SDK(token)


@app.post("/checkout/pix", response_model=PixCheckoutOut)
def create_pix_checkout(
    payload: CheckoutCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if (course.price or 0) <= 0:
        raise HTTPException(status_code=400, detail="Este curso é gratuito e não exige PIX.")

    purchase = Purchase(
        user_id=current_user.id,
        course_id=course.id,
        amount_cents=_to_cents(course.price),
        currency="BRL",
        status="pending",
        provider="mercadopago",
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)

    if _pix_receiver_key() and not _mercadopago_enabled():
        response = _static_pix_checkout_response(purchase, course)
        db.commit()
        db.refresh(purchase)
        return response

    if _pix_mock_enabled():
        response = _mock_pix_checkout_response(purchase)
        db.commit()
        db.refresh(purchase)
        return response

    sdk = _mp_sdk()
    payment_data = {
        "transaction_amount": float(purchase.amount_cents) / 100.0,
        "description": f"Curso: {course.title}",
        "payment_method_id": "pix",
        "external_reference": str(purchase.id),
        "payer": {"email": current_user.email},
    }

    try:
        from mercadopago.config import RequestOptions  # type: ignore

        request_options = RequestOptions()
        request_options.custom_headers = {"x-idempotency-key": uuid4().hex}
        result = sdk.payment().create(payment_data, request_options)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao criar cobrança PIX no Mercado Pago: {exc}",
        ) from exc

    status_code = result.get("status")
    if status_code and status_code >= 400:
        message = (result.get("response") or {}).get("message") or result
        raise HTTPException(status_code=502, detail=f"Mercado Pago recusou o PIX: {message}")

    payment = result.get("response") or {}
    mp_payment_id = str(payment.get("id") or "")
    purchase.provider_reference = mp_payment_id or None
    db.commit()
    db.refresh(purchase)

    tx = (
        (payment.get("point_of_interaction") or {})
        .get("transaction_data") or {}
    )
    qr_code_base64 = str(tx.get("qr_code_base64") or "")
    qr_code = str(tx.get("qr_code") or "")
    ticket_url = tx.get("ticket_url")

    if not qr_code_base64 or not qr_code:
        raise HTTPException(status_code=502, detail="Mercado Pago não retornou dados do PIX.")

    return {
        "purchase": purchase,
        "provider": "mercadopago",
        "provider_reference": mp_payment_id,
        "qr_code_base64": qr_code_base64,
        "qr_code": qr_code,
        "ticket_url": ticket_url,
    }

@app.post("/checkout", response_model=CheckoutOut)
def create_checkout(
    payload: CheckoutCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Estrutura base de pagamento.

    Hoje cria uma Purchase "pending" e retorna um checkout_url placeholder.
    Depois, você pluga Stripe/MercadoPago e preenche provider_reference/checkout_url.
    """
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    purchase = Purchase(
        user_id=current_user.id,
        course_id=course.id,
        amount_cents=_to_cents(course.price),
        currency="BRL",
        status="pending",
        provider="manual",
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)

    # Placeholder. Em produção, isso seria a URL do provedor.
    checkout_url = f"/checkout/{purchase.id}"
    return {"purchase": purchase, "checkout_url": checkout_url}


@app.get("/purchases", response_model=list[PurchaseOut])
def list_my_purchases(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Purchase)
        .filter(Purchase.user_id == current_user.id)
        .order_by(Purchase.created_at.desc())
        .all()
    )


@app.get("/purchases/{purchase_id}", response_model=PurchaseOut)
def get_purchase(purchase_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id, Purchase.user_id == current_user.id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Compra não encontrada")
    return purchase


@app.delete("/purchases/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_purchase(
    purchase_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    purchase = (
        db.query(Purchase)
        .filter(Purchase.id == purchase_id, Purchase.user_id == current_user.id)
        .first()
    )
    if not purchase:
        raise HTTPException(status_code=404, detail="Compra não encontrada")

    if purchase.status == "paid":
        raise HTTPException(
            status_code=400,
            detail="Compras já pagas não podem ser removidas. Cancele a matrícula no painel, se necessário.",
        )

    db.query(PaymentEvent).filter(PaymentEvent.purchase_id == purchase_id).delete(synchronize_session=False)
    db.delete(purchase)
    db.commit()


@app.post("/payments/webhook")
async def payments_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Webhook genérico para provedores (Stripe/MercadoPago).
    Nesta fase, só armazena o payload para auditoria.
    """
    raw = await request.body()
    payload_text = raw.decode("utf-8", errors="replace")

    # Log sempre
    event = PaymentEvent(
        purchase_id=0,
        provider="unknown",
        event_type="webhook",
        payload=payload_text,
    )
    db.add(event)
    db.commit()

    # Mercado Pago costuma enviar: {"data":{"id":"<payment_id>"},"type":"payment"}
    try:
        body = json.loads(payload_text or "{}")
    except Exception:
        return {"ok": True}

    payment_id = (
        (body.get("data") or {}).get("id")
        or body.get("id")
    )
    if not payment_id:
        return {"ok": True}

    # Buscar status real do pagamento e atualizar Purchase via external_reference.
    try:
        sdk = _mp_sdk()
        payment = sdk.payment().get(str(payment_id)).get("response") or {}
        external_ref = str(payment.get("external_reference") or "")
        status_mp = str(payment.get("status") or "")
        purchase_id = int(external_ref) if external_ref.isdigit() else 0
        if purchase_id:
            purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
            if purchase:
                event.purchase_id = purchase.id
                event.provider = "mercadopago"
                event.event_type = f"payment.{status_mp}"
                purchase.provider = "mercadopago"
                purchase.provider_reference = str(payment.get("id") or purchase.provider_reference or "")
                if status_mp == "approved":
                    finalize_purchase_as_paid(db, purchase)
                elif status_mp in {"cancelled", "rejected"}:
                    purchase.status = status_mp
                    db.commit()
                else:
                    purchase.status = "pending"
                    db.commit()
    except Exception:
        # webhook não deve falhar
        return {"ok": True}

    return {"ok": True}


@app.post("/purchases/{purchase_id}/confirm-payment", response_model=PurchaseOut)
def student_confirm_payment(
    purchase_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aluno confirma que realizou o PIX; libera curso e envia comprovante no chat."""
    if current_user.is_admin:
        raise HTTPException(status_code=403, detail="Use o painel administrativo para confirmar pagamentos.")

    purchase = (
        db.query(Purchase)
        .filter(Purchase.id == purchase_id, Purchase.user_id == current_user.id)
        .first()
    )
    if not purchase:
        raise HTTPException(status_code=404, detail="Compra não encontrada")

    if purchase.status == "paid":
        return purchase

    if purchase.status not in {"pending"}:
        raise HTTPException(status_code=400, detail="Esta compra não pode ser confirmada.")

    finalize_purchase_as_paid(db, purchase)
    return purchase


@app.post("/admin/purchases/{purchase_id}/mark-paid", response_model=PurchaseOut)
def admin_mark_purchase_paid(
    purchase_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Compra não encontrada")
    finalize_purchase_as_paid(db, purchase)
    return purchase

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
            "pdf_url": lesson.pdf_url,
        }
        for lesson in lessons
    ]


@app.get("/courses/{course_id}/lesson-progress", response_model=CourseLessonProgressOut)
def get_course_lesson_progress(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_admin:
        raise HTTPException(status_code=403, detail="Administradores não registram progresso de aluno.")

    enrolled = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
        .first()
    )
    if not enrolled:
        raise HTTPException(status_code=403, detail="Matricule-se no curso para ver o progresso.")

    return course_lesson_progress_list(db, current_user.id, course_id)


@app.get("/lessons/{lesson_id}/quiz", response_model=LessonQuizStudentOut)
def get_lesson_quiz(
    lesson_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Aula não encontrada.")
    rows = get_lesson_quiz_rows(db, lesson_id)
    return {
        "lesson_id": lesson_id,
        "questions": [question_to_student_dict(row) for row in rows],
    }


@app.post("/lessons/{lesson_id}/quiz/submit", response_model=LessonQuizSubmitResult)
def submit_lesson_quiz(
    lesson_id: int,
    payload: LessonQuizSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_admin:
        raise HTTPException(status_code=403, detail="Administradores não enviam avaliação de aluno.")

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Aula não encontrada.")

    enrolled = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current_user.id, Enrollment.course_id == lesson.course_id)
        .first()
    )
    if not enrolled:
        raise HTTPException(status_code=403, detail="Matricule-se no curso para realizar a avaliação.")

    rows = get_lesson_quiz_rows(db, lesson_id)
    try:
        score, passed = score_quiz_answers(rows, payload.answers)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    progress_row = (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == current_user.id, LessonProgress.lesson_id == lesson_id)
        .first()
    )
    snapshot = lesson_progress_dict(progress_row)
    chapter_progress = snapshot["chapter_progress"]
    course_contribution = snapshot["course_contribution"]
    from .lesson_progress import compute_course_progress

    course_progress = compute_course_progress(db, current_user.id, lesson.course_id)
    if passed:
        _, chapter_progress, course_contribution, course_progress = mark_quiz_passed(
            db, current_user.id, lesson_id
        )

    return {
        "score": score,
        "total": QUIZ_SIZE,
        "passed": passed,
        "minimum_score": 8,
        "chapter_progress": chapter_progress,
        "course_contribution": course_contribution,
        "course_progress": course_progress,
    }


@app.get("/lessons/{lesson_id}/progress", response_model=LessonProgressOut)
def get_lesson_progress(
    lesson_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Aula não encontrada.")

    progress = (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == current_user.id, LessonProgress.lesson_id == lesson_id)
        .first()
    )
    from .lesson_progress import compute_course_progress

    data = lesson_progress_dict(progress)
    data["lesson_id"] = lesson_id
    data["course_progress"] = compute_course_progress(db, current_user.id, lesson.course_id)
    return data


@app.post("/lessons/{lesson_id}/progress/video", response_model=LessonProgressOut)
def complete_lesson_video(
    lesson_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_admin:
        raise HTTPException(status_code=403, detail="Administradores não registram progresso de aluno.")

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Aula não encontrada.")

    enrolled = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current_user.id, Enrollment.course_id == lesson.course_id)
        .first()
    )
    if not enrolled:
        raise HTTPException(status_code=403, detail="Matricule-se no curso para registrar progresso.")

    try:
        progress, chapter_progress, course_contribution, course_progress = mark_video_completed(
            db, current_user.id, lesson_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "lesson_id": lesson_id,
        "video_completed": progress.video_completed,
        "quiz_passed": progress.quiz_passed,
        "chapter_progress": chapter_progress,
        "course_contribution": course_contribution,
        "course_progress": course_progress,
    }


@app.get("/enrollments", response_model=list[EnrollmentOut])
def list_enrollments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Enrollment).filter(Enrollment.user_id == current_user.id).all()


@app.post("/enrollments", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
def enroll(
    payload: EnrollmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current_user.id, Enrollment.course_id == payload.course_id)
        .first()
    )
    if existing:
        return existing

    # Curso pago: exige compra aprovada
    if (course.price or 0) > 0:
        paid = (
            db.query(Purchase)
            .filter(
                Purchase.user_id == current_user.id,
                Purchase.course_id == course.id,
                Purchase.status == "paid",
            )
            .first()
        )
        if not paid:
            raise HTTPException(
                status_code=402,
                detail="Pagamento pendente. Gere um PIX em /api/checkout/pix e conclua o pagamento para liberar a matrícula.",
            )

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


@app.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_enrollment(
    enrollment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.id == enrollment_id, Enrollment.user_id == current_user.id)
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Matrícula não encontrada")

    db.delete(enrollment)
    db.commit()


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


def _message_to_out(message: StudentMessage) -> StudentMessageOut:
    return StudentMessageOut.from_orm_message(message)


@app.get("/messages", response_model=list[StudentMessageOut])
def list_student_messages(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(StudentMessage)
        .filter(StudentMessage.user_id == current_user.id)
        .order_by(StudentMessage.created_at.asc())
        .all()
    )
    return [_message_to_out(row) for row in rows]


@app.post("/messages", response_model=StudentMessageOut, status_code=status.HTTP_201_CREATED)
def student_send_message(
    payload: StudentMessageReplyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_admin or current_user.is_instructor:
        raise HTTPException(status_code=403, detail="Use o painel administrativo para enviar mensagens.")

    details = payload.details.strip()
    if not details:
        raise HTTPException(status_code=400, detail="Digite uma mensagem antes de enviar.")

    subject = (payload.subject or "Mensagem do aluno").strip()[:180] or "Mensagem do aluno"

    if payload.course_id is not None:
        course = db.query(Course).filter(Course.id == payload.course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Curso não encontrado.")
        enrolled = (
            db.query(Enrollment)
            .filter(Enrollment.user_id == current_user.id, Enrollment.course_id == payload.course_id)
            .first()
        )
        if not enrolled:
            raise HTTPException(status_code=403, detail="Você precisa estar matriculado neste curso.")

    message = StudentMessage(
        user_id=current_user.id,
        sent_by_admin_id=current_user.id,
        course_id=payload.course_id,
        subject=subject,
        details=details,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _message_to_out(message)


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


@app.get("/admin/instructors", response_model=list[UserOut])
def admin_list_instructors(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return (
        db.query(User)
        .filter(User.is_admin.is_(False), User.is_instructor.is_(True))
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
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

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

    purchase_ids = [
        row[0]
        for row in db.query(Purchase.id).filter(Purchase.course_id == course_id).all()
    ]
    if purchase_ids:
        db.query(PaymentEvent).filter(PaymentEvent.purchase_id.in_(purchase_ids)).delete(
            synchronize_session=False
        )
        db.query(Purchase).filter(Purchase.course_id == course_id).delete(synchronize_session=False)

    db.query(StudentMessage).filter(StudentMessage.course_id == course_id).update(
        {StudentMessage.course_id: None},
        synchronize_session=False,
    )
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
    return _message_to_out(message)


@app.get("/admin/messages", response_model=list[StudentMessageOut])
def admin_list_messages(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    rows = db.query(StudentMessage).order_by(StudentMessage.created_at.desc()).all()
    return [_message_to_out(row) for row in rows]


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
        pdf_url=(payload.pdf_url or "").strip() or None,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    ensure_lesson_quiz(db, lesson.id)
    return lesson


@app.get("/admin/lessons/{lesson_id}/quiz", response_model=LessonQuizAdminOut)
def admin_get_lesson_quiz(
    lesson_id: int,
    _: User = Depends(get_current_content_manager),
    db: Session = Depends(get_db),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Aula não encontrada.")
    rows = get_lesson_quiz_rows(db, lesson_id)
    return {
        "lesson_id": lesson_id,
        "questions": [question_to_admin_dict(row) for row in rows],
    }


def _persist_lesson_quiz(lesson_id: int, payload: LessonQuizSave, db: Session) -> dict:
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Aula não encontrada.")

    try:
        rows = save_lesson_quiz(
            db,
            lesson_id,
            [item.model_dump() for item in payload.questions],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "lesson_id": lesson_id,
        "questions": [question_to_admin_dict(row) for row in rows],
    }


@app.put("/admin/lessons/{lesson_id}/quiz", response_model=LessonQuizAdminOut)
def admin_save_lesson_quiz_put(
    lesson_id: int,
    payload: LessonQuizSave,
    _: User = Depends(get_current_content_manager),
    db: Session = Depends(get_db),
):
    return _persist_lesson_quiz(lesson_id, payload, db)


@app.post("/admin/lessons/{lesson_id}/quiz", response_model=LessonQuizAdminOut)
def admin_save_lesson_quiz_post(
    lesson_id: int,
    payload: LessonQuizSave,
    _: User = Depends(get_current_content_manager),
    db: Session = Depends(get_db),
):
    return _persist_lesson_quiz(lesson_id, payload, db)


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
    lesson.pdf_url = (payload.pdf_url or "").strip() or None
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


@app.post("/admin/lessons/upload-pdf")
async def admin_upload_lesson_pdf(
    file: UploadFile = File(...),
    _: User = Depends(get_current_content_manager),
):
    pdf_url = await _save_uploaded_pdf(file)
    return {"pdf_url": pdf_url}


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
        backend_root / "app" / "public",
        # Vercel pode realocar o entrypoint; tentamos também o caminho
        # "backend/app/public" relativo ao diretório que contenha `main.py`.
        backend_root / "backend" / "app" / "public",
        backend_root / "backend" / "public",
        task_root / "backend" / "app" / "public",
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
application.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
application.mount("/api", elite_api)


@application.on_event("startup")
def on_application_startup() -> None:
    # Mounted sub-apps do not always run their own startup handlers.
    _run_startup()


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


# Portal + API no mesmo app (Vercel routePrefix / e dev local na :8000).
app = application
