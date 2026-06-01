from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    student_level: Mapped[str] = mapped_column(String(80), default="Gold Scholar")
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_instructor: Mapped[bool] = mapped_column(Boolean, default=False)

    enrollments = relationship("Enrollment", back_populates="user", cascade="all,delete-orphan")
    tickets = relationship("Ticket", back_populates="user", cascade="all,delete-orphan")
    student_messages = relationship(
        "StudentMessage",
        back_populates="student",
        foreign_keys="StudentMessage.user_id",
        cascade="all,delete-orphan",
    )
    admin_sent_messages = relationship(
        "StudentMessage",
        back_populates="admin_sender",
        foreign_keys="StudentMessage.sent_by_admin_id",
    )


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    rating: Mapped[float] = mapped_column(Float, nullable=False, default=4.8)
    hero_image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    lessons = relationship("Lesson", back_populates="course", cascade="all,delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all,delete-orphan")


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    module_name: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    video_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    content_md: Mapped[str] = mapped_column(Text, nullable=False)

    course = relationship("Course", back_populates="lessons")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0)
    last_accessed: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String(180), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="tickets")


class StudentMessage(Base):
    __tablename__ = "student_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    sent_by_admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"), nullable=True)
    subject: Mapped[str] = mapped_column(String(180), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    student = relationship("User", foreign_keys=[user_id], back_populates="student_messages")
    admin_sender = relationship("User", foreign_keys=[sent_by_admin_id], back_populates="admin_sent_messages")
