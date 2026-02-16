import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from app import models  # noqa: F401
from app.db import Base, SessionLocal, engine


def parse_dt(value: str) -> datetime:
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def ensure_location(db, location_id: int) -> None:
    location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if location:
        return
    db.add(
        models.Location(
            id=location_id,
            name=f"Location {location_id}",
            place_id=f"seed-location-{location_id}",
            is_active=True,
        )
    )
    db.flush()


def import_reviews(path: Path) -> None:
    rows = json.loads(path.read_text(encoding="utf-8"))
    db = SessionLocal()
    inserted = 0
    skipped = 0
    try:
        Base.metadata.create_all(bind=engine)
        for row in rows:
            existing = (
                db.query(models.Review)
                .filter(models.Review.google_review_id == row["google_review_id"])
                .first()
            )
            if existing:
                skipped += 1
                continue
            location_id = int(row["location_id"])
            ensure_location(db, location_id)
            created_at = parse_dt(row["created_at"])
            db.add(
                models.Review(
                    location_id=location_id,
                    google_review_id=row["google_review_id"],
                    reviewer_name=row["reviewer_name"],
                    rating=float(row["rating"]),
                    review_text=row["review_text"],
                    review_date=created_at,
                    created_at=created_at,
                )
            )
            inserted += 1
        db.commit()
        print(f"Imported reviews: inserted={inserted}, skipped={skipped}")
    finally:
        db.close()


def parse_active(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "y"}


def import_employees(path: Path) -> None:
    db = SessionLocal()
    inserted = 0
    skipped = 0
    try:
        Base.metadata.create_all(bind=engine)
        ensure_location(db, 1)
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                full_name = (row.get("full_name") or "").strip()
                if not full_name:
                    continue
                existing = (
                    db.query(models.Employee)
                    .filter(
                        models.Employee.full_name == full_name,
                        models.Employee.location_id == 1,
                    )
                    .first()
                )
                if existing:
                    skipped += 1
                    continue
                db.add(
                    models.Employee(
                        location_id=1,
                        full_name=full_name,
                        is_active=parse_active(row.get("active", "true")),
                    )
                )
                inserted += 1
        db.commit()
        print(f"Imported employees: inserted={inserted}, skipped={skipped}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import seed data into SQLite DB.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    reviews_parser = subparsers.add_parser("reviews", help="Import reviews JSON.")
    reviews_parser.add_argument("--file", default="sample_reviews.json")

    employees_parser = subparsers.add_parser("employees", help="Import employees CSV.")
    employees_parser.add_argument("--file", default="employees.csv")

    args = parser.parse_args()
    if args.command == "reviews":
        import_reviews(Path(args.file))
    elif args.command == "employees":
        import_employees(Path(args.file))


if __name__ == "__main__":
    main()
