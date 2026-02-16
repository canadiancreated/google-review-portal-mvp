from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_employee_mentions_schema() -> None:
    required_columns = {
        "id",
        "review_id",
        "employee_id",
        "detection_method",
        "ambiguity_flag",
        "confidence_score",
        "mention_text",
        "created_at",
    }
    with engine.begin() as conn:
        table_info = conn.execute(text("PRAGMA table_info(employee_mentions)")).mappings().all()
        if not table_info:
            return

        existing_columns = {row["name"] for row in table_info}
        if required_columns.issubset(existing_columns):
            return

        conn.execute(text("ALTER TABLE employee_mentions RENAME TO employee_mentions_old"))
        conn.execute(
            text(
                """
                CREATE TABLE employee_mentions (
                    id INTEGER PRIMARY KEY,
                    review_id INTEGER NOT NULL,
                    employee_id INTEGER NULL,
                    detection_method VARCHAR(32) NOT NULL DEFAULT 'auto',
                    ambiguity_flag BOOLEAN NOT NULL DEFAULT 0,
                    confidence_score FLOAT NULL,
                    mention_text TEXT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(review_id) REFERENCES reviews(id),
                    FOREIGN KEY(employee_id) REFERENCES employees(id)
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO employee_mentions (
                    id, review_id, employee_id, detection_method, ambiguity_flag, confidence_score, mention_text, created_at
                )
                SELECT
                    id,
                    review_id,
                    employee_id,
                    'auto',
                    0,
                    NULL,
                    NULL,
                    COALESCE(created_at, CURRENT_TIMESTAMP)
                FROM employee_mentions_old
                """
            )
        )
        conn.execute(text("DROP TABLE employee_mentions_old"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_employee_mentions_id ON employee_mentions (id)"))
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_employee_mentions_review_id ON employee_mentions (review_id)")
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_employee_mentions_employee_id ON employee_mentions (employee_id)")
        )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
