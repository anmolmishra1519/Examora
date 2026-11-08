from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_faculty
from app.database import get_db
from app.models.models import Course, Enrollment, RoleEnum, User
from app.schemas.schemas import CourseCreate, CourseOut
from app.services.audit import log_action

router = APIRouter(prefix="/courses", tags=["courses"])


@router.post("", response_model=CourseOut)
def create_course(payload: CourseCreate, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    course = Course(name=payload.name, code=payload.code, semester=payload.semester, faculty_id=user.id)
    db.add(course)
    db.commit()
    db.refresh(course)
    log_action(db, user, "Course Created", "Course", course.id)
    return CourseOut(id=course.id, name=course.name, code=course.code, semester=course.semester, student_count=0)


@router.get("", response_model=list[CourseOut])
def list_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role.value == "student":
        enrollments = db.query(Enrollment).filter(Enrollment.student_id == user.id).all()
        courses = [e.course for e in enrollments]
    else:
        courses = db.query(Course).filter(Course.faculty_id == user.id).all()

    return [
        CourseOut(id=c.id, name=c.name, code=c.code, semester=c.semester, student_count=len(c.enrollments))
        for c in courses
    ]


@router.post("/{course_id}/enroll")
def enroll_student(course_id: str, student_email: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.faculty_id == user.id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    student = db.query(User).filter(User.email == student_email, User.role == RoleEnum.student).first()
    if not student:
        raise HTTPException(status_code=404, detail="No student account found with that email")
    if db.query(Enrollment).filter(Enrollment.course_id == course_id, Enrollment.student_id == student.id).first():
        raise HTTPException(status_code=400, detail="Student is already enrolled in this course")

    db.add(Enrollment(course_id=course_id, student_id=student.id))
    db.commit()
    log_action(db, user, "Student Enrolled", "Course", course_id, {"student_email": student_email})
    return {"detail": f"{student.full_name} enrolled in {course.name}"}


@router.get("/{course_id}/students")
def list_course_students(course_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.faculty_id == user.id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return [
        {"id": e.student.id, "full_name": e.student.full_name, "email": e.student.email}
        for e in course.enrollments
    ]
