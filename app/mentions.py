import re

from sqlalchemy.orm import Session

from app import models


def _contains_phrase(text_lower: str, phrase: str) -> bool:
    phrase = phrase.strip().lower()
    if not phrase:
        return False
    pattern = r"\b" + re.escape(phrase).replace(r"\ ", r"\s+") + r"\b"
    return re.search(pattern, text_lower) is not None


def _contains_word(text_lower: str, word: str) -> bool:
    word = word.strip().lower()
    if not word:
        return False
    pattern = r"\b" + re.escape(word) + r"\b"
    return re.search(pattern, text_lower) is not None


def run_employee_mention_detection(db: Session) -> int:
    employees = db.query(models.Employee).all()
    reviews = db.query(models.Review).all()

    existing_rows = (
        db.query(
            models.EmployeeMention.review_id,
            models.EmployeeMention.employee_id,
            models.EmployeeMention.ambiguity_flag,
            models.EmployeeMention.detection_method,
        )
        .filter(models.EmployeeMention.detection_method == "auto")
        .all()
    )
    existing = {
        (row.review_id, row.employee_id, bool(row.ambiguity_flag), row.detection_method)
        for row in existing_rows
    }

    created = 0
    for review in reviews:
        has_manual_override = (
            db.query(models.EmployeeMention.id)
            .filter(models.EmployeeMention.review_id == review.id)
            .filter(models.EmployeeMention.detection_method == "manual")
            .first()
            is not None
        )
        if has_manual_override:
            continue

        text_lower = (review.review_text or "").lower()
        if not text_lower.strip():
            continue

        full_name_matches = [
            employee for employee in employees if _contains_phrase(text_lower, employee.full_name)
        ]
        if full_name_matches:
            unique_ids = sorted({employee.id for employee in full_name_matches})
            for employee_id in unique_ids:
                key = (review.id, employee_id, False, "auto")
                if key in existing:
                    continue
                db.add(
                    models.EmployeeMention(
                        review_id=review.id,
                        employee_id=employee_id,
                        detection_method="auto",
                        ambiguity_flag=False,
                        confidence_score=None,
                    )
                )
                existing.add(key)
                created += 1
            continue

        first_name_hits: dict[str, list[models.Employee]] = {}
        for employee in employees:
            first_name = employee.full_name.split()[0].strip().lower()
            if _contains_word(text_lower, first_name):
                first_name_hits.setdefault(first_name, []).append(employee)

        if not first_name_hits:
            continue

        has_ambiguous_first_name = any(len(matches) > 1 for matches in first_name_hits.values())
        if has_ambiguous_first_name:
            key = (review.id, None, True, "auto")
            if key not in existing:
                db.add(
                    models.EmployeeMention(
                        review_id=review.id,
                        employee_id=None,
                        detection_method="auto",
                        ambiguity_flag=True,
                        confidence_score=None,
                    )
                )
                existing.add(key)
                created += 1
            continue

        unique_ids = sorted({matches[0].id for matches in first_name_hits.values()})
        for employee_id in unique_ids:
            key = (review.id, employee_id, False, "auto")
            if key in existing:
                continue
            db.add(
                models.EmployeeMention(
                    review_id=review.id,
                    employee_id=employee_id,
                    detection_method="auto",
                    ambiguity_flag=False,
                    confidence_score=None,
                )
            )
            existing.add(key)
            created += 1

    db.commit()
    return created
