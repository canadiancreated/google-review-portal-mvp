import os
import smtplib
from email.message import EmailMessage

from sqlalchemy.orm import Session

from app import models

try:
    from dotenv import load_dotenv

    load_dotenv(".env")
except Exception:
    pass

ALERT_TYPE_NEGATIVE_REVIEW = "negative_review"
ALERT_RECIPIENTS = ["kyle@fireflysolar.ca", "c.anderson@fireflysolar.ca"]


def get_or_create_negative_rule(db: Session, location_id: int) -> models.AlertRule:
    rule = (
        db.query(models.AlertRule)
        .filter(
            models.AlertRule.location_id == location_id,
            models.AlertRule.name == ALERT_TYPE_NEGATIVE_REVIEW,
        )
        .first()
    )
    if rule:
        return rule

    rule = models.AlertRule(
        location_id=location_id,
        name=ALERT_TYPE_NEGATIVE_REVIEW,
        condition_json='{"rating_lte":2}',
        is_enabled=True,
    )
    db.add(rule)
    db.flush()
    return rule


def has_existing_alert(db: Session, review_id: int, alert_type: str) -> bool:
    existing = (
        db.query(models.AlertLog)
        .join(models.AlertRule, models.AlertLog.alert_rule_id == models.AlertRule.id)
        .filter(
            models.AlertLog.review_id == review_id,
            models.AlertRule.name == alert_type,
        )
        .first()
    )
    return existing is not None


def smtp_config() -> dict[str, str]:
    return {
        "host": os.getenv("SMTP_HOST", "").strip(),
        "port": os.getenv("SMTP_PORT", "").strip(),
        "username": os.getenv("SMTP_USERNAME", "").strip(),
        "password": os.getenv("SMTP_PASSWORD", "").strip(),
        "from": os.getenv("SMTP_FROM", "").strip(),
        "use_tls": os.getenv("SMTP_USE_TLS", "true").strip().lower(),
    }


def smtp_is_configured(config: dict[str, str]) -> bool:
    return bool(config["host"] and config["port"] and config["from"])


def send_or_log_alert(review: models.Review, location: models.Location) -> str:
    config = smtp_config()
    subject = f"Negative Review Alert: {review.reviewer_name} ({review.rating})"
    body = (
        "Negative review detected\n"
        f"Reviewer: {review.reviewer_name}\n"
        f"Location: {location.name}\n"
        f"Rating: {review.rating}\n"
        f"Review ID: {review.google_review_id}\n"
        f"Review text: {review.review_text}\n"
    )

    if smtp_is_configured(config):
        try:
            message = EmailMessage()
            message["Subject"] = subject
            message["From"] = config["from"]
            message["To"] = ", ".join(ALERT_RECIPIENTS)
            message.set_content(body)

            with smtplib.SMTP(config["host"], int(config["port"])) as smtp:
                if config["use_tls"] in {"1", "true", "yes"}:
                    smtp.starttls()
                if config["username"]:
                    smtp.login(config["username"], config["password"])
                smtp.send_message(message)
            return "sent"
        except Exception as exc:
            print(f"SMTP send failed, logging alert instead: {exc}")

    print("ALERT (console):")
    print(subject)
    print(body)
    return "logged"


def run_negative_review_scan(db: Session) -> int:
    created_alerts = 0
    negative_reviews = (
        db.query(models.Review, models.Location)
        .join(models.Location, models.Review.location_id == models.Location.id)
        .filter(models.Review.rating <= 2)
        .all()
    )

    for review, location in negative_reviews:
        if has_existing_alert(db, review.id, ALERT_TYPE_NEGATIVE_REVIEW):
            continue

        rule = get_or_create_negative_rule(db, review.location_id)
        status = send_or_log_alert(review, location)
        db.add(
            models.AlertLog(
                alert_rule_id=rule.id,
                review_id=review.id,
                status=status,
            )
        )
        created_alerts += 1

    db.commit()
    return created_alerts
