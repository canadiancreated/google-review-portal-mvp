from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.alerts import run_negative_review_scan
from app.db import Base, SessionLocal, engine, ensure_employee_mentions_schema
from app.mentions import run_employee_mention_detection
from app import models  # noqa: F401

app = FastAPI(title="Google Review Portal MVP")
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_employee_mentions_schema()


@app.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"title": "Google Review Portal MVP"},
    )


@app.get("/health")
def health() -> dict[str, str]:
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except SQLAlchemyError:
        return {"status": "ok", "db": "error"}
    finally:
        db.close()


@app.get("/reviews", response_class=HTMLResponse)
def reviews_page(request: Request) -> HTMLResponse:
    db: Session = SessionLocal()
    try:
        reviews = db.query(models.Review).order_by(models.Review.created_at.desc()).all()
        return templates.TemplateResponse(
            request=request,
            name="reviews.html",
            context={"reviews": reviews, "title": "Reviews"},
        )
    finally:
        db.close()


@app.get("/reviews/{review_id}", response_class=HTMLResponse)
def review_detail_page(request: Request, review_id: int) -> HTMLResponse:
    db: Session = SessionLocal()
    try:
        row = (
            db.query(models.Review, models.Location)
            .join(models.Location, models.Review.location_id == models.Location.id)
            .filter(models.Review.id == review_id)
            .first()
        )
        if row is None:
            return HTMLResponse(status_code=404, content="Review not found")

        review, location = row

        manual_mentions = (
            db.query(models.EmployeeMention)
            .filter(models.EmployeeMention.review_id == review.id)
            .filter(models.EmployeeMention.detection_method == "manual")
            .order_by(models.EmployeeMention.created_at.desc())
            .all()
        )
        if manual_mentions:
            mention_rows = manual_mentions
        else:
            mention_rows = (
                db.query(models.EmployeeMention)
                .filter(models.EmployeeMention.review_id == review.id)
                .order_by(models.EmployeeMention.created_at.desc())
                .all()
            )

        mentions = []
        for mention in mention_rows:
            employee_name = "Ambiguous"
            if mention.employee_id is not None:
                employee = db.query(models.Employee).filter(models.Employee.id == mention.employee_id).first()
                if employee:
                    employee_name = employee.full_name
            mentions.append(
                {
                    "id": mention.id,
                    "employee_name": employee_name,
                    "ambiguity_flag": mention.ambiguity_flag,
                    "detection_method": mention.detection_method,
                    "created_at": mention.created_at,
                }
            )

        employees = db.query(models.Employee).order_by(models.Employee.full_name.asc()).all()
        return templates.TemplateResponse(
            request=request,
            name="review_detail.html",
            context={
                "title": f"Review {review.id}",
                "review": review,
                "location": location,
                "mentions": mentions,
                "employees": employees,
            },
        )
    finally:
        db.close()


@app.post("/reviews/{review_id}/mentions")
def attach_employee_mention(review_id: int, employee_id: int = Form(...)) -> RedirectResponse:
    db: Session = SessionLocal()
    try:
        review = db.query(models.Review).filter(models.Review.id == review_id).first()
        if review is None:
            return RedirectResponse(url="/reviews", status_code=303)

        employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
        if employee is None:
            return RedirectResponse(url=f"/reviews/{review_id}", status_code=303)

        # Manual override takes precedence: remove auto mentions for this review.
        db.query(models.EmployeeMention).filter(
            models.EmployeeMention.review_id == review_id,
            models.EmployeeMention.detection_method == "auto",
        ).delete()

        existing = (
            db.query(models.EmployeeMention)
            .filter(models.EmployeeMention.review_id == review_id)
            .filter(models.EmployeeMention.employee_id == employee_id)
            .filter(models.EmployeeMention.detection_method == "manual")
            .first()
        )
        if existing is None:
            upsert_target = (
                db.query(models.EmployeeMention)
                .filter(models.EmployeeMention.review_id == review_id)
                .filter(models.EmployeeMention.employee_id == employee_id)
                .first()
            )
            if upsert_target is None:
                db.add(
                    models.EmployeeMention(
                        review_id=review_id,
                        employee_id=employee_id,
                        detection_method="manual",
                        ambiguity_flag=False,
                        confidence_score=None,
                    )
                )
            else:
                upsert_target.detection_method = "manual"
                upsert_target.ambiguity_flag = False
                upsert_target.confidence_score = None

        db.commit()
        return RedirectResponse(url=f"/reviews/{review_id}", status_code=303)
    finally:
        db.close()


@app.post("/reviews/{review_id}/mentions/{mention_id}/remove")
def remove_mention(review_id: int, mention_id: int) -> RedirectResponse:
    db: Session = SessionLocal()
    try:
        mention = (
            db.query(models.EmployeeMention)
            .filter(models.EmployeeMention.id == mention_id)
            .filter(models.EmployeeMention.review_id == review_id)
            .first()
        )
        if mention is not None:
            db.delete(mention)
            db.commit()
        return RedirectResponse(url=f"/reviews/{review_id}", status_code=303)
    finally:
        db.close()


@app.get("/alerts", response_class=HTMLResponse)
def alerts_page(request: Request) -> HTMLResponse:
    db: Session = SessionLocal()
    try:
        rows = (
            db.query(models.AlertLog, models.Review, models.Location, models.AlertRule)
            .join(models.Review, models.AlertLog.review_id == models.Review.id)
            .join(models.Location, models.Review.location_id == models.Location.id)
            .join(models.AlertRule, models.AlertLog.alert_rule_id == models.AlertRule.id)
            .order_by(models.AlertLog.triggered_at.desc())
            .all()
        )
        alerts = []
        for alert_log, review, location, alert_rule in rows:
            alerts.append(
                {
                    "sent_at": alert_log.triggered_at,
                    "reviewer_name": review.reviewer_name,
                    "location": location.name,
                    "rating": review.rating,
                    "alert_type": alert_rule.name,
                    "status": alert_log.status,
                }
            )
        return templates.TemplateResponse(
            request=request,
            name="alerts.html",
            context={"alerts": alerts, "title": "Alerts"},
        )
    finally:
        db.close()


@app.post("/alerts/run")
def run_alerts_once() -> dict[str, int | str]:
    db: Session = SessionLocal()
    try:
        created = run_negative_review_scan(db)
        return {"status": "ok", "created_alerts": created}
    finally:
        db.close()


@app.post("/mentions/run")
def run_mentions_once() -> dict[str, int | str]:
    db: Session = SessionLocal()
    try:
        created = run_employee_mention_detection(db)
        return {"status": "ok", "created_mentions": created}
    finally:
        db.close()


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard_page(
    request: Request,
    location_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> HTMLResponse:
    db: Session = SessionLocal()
    try:
        parsed_start_date: Optional[date] = None
        parsed_end_date: Optional[date] = None
        normalized_start_date = (start_date or "").strip()
        normalized_end_date = (end_date or "").strip()
        if normalized_start_date:
            try:
                parsed_start_date = date.fromisoformat(normalized_start_date)
            except ValueError:
                normalized_start_date = ""
        if normalized_end_date:
            try:
                parsed_end_date = date.fromisoformat(normalized_end_date)
            except ValueError:
                normalized_end_date = ""

        review_filters = []
        selected_location_id = location_id or "all"
        if location_id not in (None, "all"):
            try:
                location_id_int = int(location_id)
                review_filters.append(models.Review.location_id == location_id_int)
            except ValueError:
                selected_location_id = "all"
        if parsed_start_date is not None:
            review_filters.append(models.Review.created_at >= datetime.combine(parsed_start_date, time.min))
        if parsed_end_date is not None:
            end_next_day = parsed_end_date + timedelta(days=1)
            review_filters.append(models.Review.created_at < datetime.combine(end_next_day, time.min))

        total_reviews = db.query(func.count(models.Review.id)).filter(*review_filters).scalar() or 0
        avg_rating = db.query(func.avg(models.Review.rating)).filter(*review_filters).scalar()
        negative_reviews = (
            db.query(func.count(models.Review.id))
            .filter(*review_filters)
            .filter(models.Review.rating <= 2)
            .scalar()
            or 0
        )
        positive_reviews = (
            db.query(func.count(models.Review.id))
            .filter(*review_filters)
            .filter(models.Review.rating >= 3)
            .scalar()
            or 0
        )

        reviews_by_day_raw = (
            db.query(
                func.date(models.Review.created_at).label("day"),
                func.count(models.Review.id).label("count"),
            )
            .filter(*review_filters)
            .group_by(func.date(models.Review.created_at))
            .order_by(func.date(models.Review.created_at).desc())
            .all()
        )
        reviews_by_day = [{"day": row.day, "count": row.count} for row in reviews_by_day_raw]
        locations = db.query(models.Location).order_by(models.Location.name.asc()).all()

        return templates.TemplateResponse(
            request=request,
            name="dashboard.html",
            context={
                "title": "Dashboard",
                "total_reviews": total_reviews,
                "average_rating": round(float(avg_rating), 2) if avg_rating is not None else 0,
                "negative_reviews": negative_reviews,
                "positive_reviews": positive_reviews,
                "reviews_by_day": reviews_by_day,
                "locations": locations,
                "selected_location_id": selected_location_id,
                "selected_start_date": normalized_start_date,
                "selected_end_date": normalized_end_date,
            },
        )
    finally:
        db.close()


@app.get("/employees", response_class=HTMLResponse)
def employees_page(request: Request, active_only: Optional[str] = "1") -> HTMLResponse:
    db: Session = SessionLocal()
    try:
        active_only_flag = active_only != "0"
        employees_query = db.query(models.Employee).order_by(models.Employee.full_name.asc())
        if active_only_flag:
            employees_query = employees_query.filter(models.Employee.is_active.is_(True))
        employees = employees_query.all()

        rows = []
        for employee in employees:
            base_query = (
                db.query(models.Review)
                .join(models.EmployeeMention, models.EmployeeMention.review_id == models.Review.id)
                .filter(models.EmployeeMention.employee_id == employee.id)
                .filter(models.EmployeeMention.ambiguity_flag.is_(False))
            )
            mentions_count = base_query.count()
            avg_rating = base_query.with_entities(func.avg(models.Review.rating)).scalar()
            low_count = base_query.filter(models.Review.rating <= 2).count()
            high_count = base_query.filter(models.Review.rating >= 3).count()
            rows.append(
                {
                    "id": employee.id,
                    "full_name": employee.full_name,
                    "mentions": mentions_count,
                    "avg_rating": round(float(avg_rating), 2) if avg_rating is not None else 0,
                    "low_count": low_count,
                    "high_count": high_count,
                    "is_active": employee.is_active,
                }
            )

        return templates.TemplateResponse(
            request=request,
            name="employees.html",
            context={
                "title": "Employees",
                "rows": rows,
                "active_only": "1" if active_only_flag else "0",
            },
        )
    finally:
        db.close()


@app.get("/employees/{employee_id}", response_class=HTMLResponse)
def employee_detail_page(request: Request, employee_id: int) -> HTMLResponse:
    db: Session = SessionLocal()
    try:
        employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
        if employee is None:
            return HTMLResponse(status_code=404, content="Employee not found")

        review_rows = (
            db.query(models.Review)
            .join(models.EmployeeMention, models.EmployeeMention.review_id == models.Review.id)
            .filter(models.EmployeeMention.employee_id == employee_id)
            .filter(models.EmployeeMention.ambiguity_flag.is_(False))
            .order_by(models.Review.created_at.desc())
            .all()
        )

        reviews = []
        for review in review_rows:
            snippet = review.review_text[:180] if review.review_text else ""
            if review.review_text and len(review.review_text) > 180:
                snippet += "..."
            reviews.append(
                {
                    "rating": review.rating,
                    "reviewer_name": review.reviewer_name,
                    "created_at": review.created_at,
                    "snippet": snippet,
                }
            )

        return templates.TemplateResponse(
            request=request,
            name="employee_detail.html",
            context={
                "title": employee.full_name,
                "employee": employee,
                "reviews": reviews,
            },
        )
    finally:
        db.close()
