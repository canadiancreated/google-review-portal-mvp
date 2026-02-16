from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.alerts import run_negative_review_scan
from app.db import Base, SessionLocal, engine
from app import models  # noqa: F401

app = FastAPI(title="Google Review Portal MVP")
templates = Jinja2Templates(directory="app/templates")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


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


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard_page(request: Request) -> HTMLResponse:
    db: Session = SessionLocal()
    try:
        total_reviews = db.query(func.count(models.Review.id)).scalar() or 0
        avg_rating = db.query(func.avg(models.Review.rating)).scalar()
        negative_reviews = (
            db.query(func.count(models.Review.id))
            .filter(models.Review.rating <= 2)
            .scalar()
            or 0
        )
        positive_reviews = (
            db.query(func.count(models.Review.id))
            .filter(models.Review.rating >= 3)
            .scalar()
            or 0
        )

        reviews_by_day_raw = (
            db.query(
                func.date(models.Review.created_at).label("day"),
                func.count(models.Review.id).label("count"),
            )
            .group_by(func.date(models.Review.created_at))
            .order_by(func.date(models.Review.created_at).desc())
            .all()
        )
        reviews_by_day = [{"day": row.day, "count": row.count} for row in reviews_by_day_raw]

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
            },
        )
    finally:
        db.close()
