from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from datetime import datetime, timezone
from typing import Any

from .config import DATA_DIR, DATABASE_PATH


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    try:
        with get_connection() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS recommendation_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    location_name TEXT,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    demand_kw REAL NOT NULL,
                    best_source TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    summary TEXT NOT NULL,
                    estimated_features_json TEXT NOT NULL,
                    rankings_json TEXT NOT NULL,
                    data_source TEXT NOT NULL,
                    fetched_at TEXT NOT NULL
                )
                """
            )
    except sqlite3.Error:
        return


def save_recommendation(record: dict[str, Any]) -> int:
    payload = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "location_name": record.get("location_name"),
        "latitude": record["location"]["latitude"],
        "longitude": record["location"]["longitude"],
        "demand_kw": record["demand_kw"],
        "best_source": record["best_source"],
        "confidence": record["confidence"],
        "summary": record["summary"],
        "estimated_features_json": json.dumps(record["estimated_features"]),
        "rankings_json": json.dumps(record["rankings"]),
        "data_source": record["data_source"],
        "fetched_at": record["fetched_at"],
    }
    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO recommendation_history (
                    created_at,
                    location_name,
                    latitude,
                    longitude,
                    demand_kw,
                    best_source,
                    confidence,
                    summary,
                    estimated_features_json,
                    rankings_json,
                    data_source,
                    fetched_at
                ) VALUES (
                    :created_at,
                    :location_name,
                    :latitude,
                    :longitude,
                    :demand_kw,
                    :best_source,
                    :confidence,
                    :summary,
                    :estimated_features_json,
                    :rankings_json,
                    :data_source,
                    :fetched_at
                )
                """,
                payload,
            )
            return int(cursor.lastrowid)
    except sqlite3.Error:
        return 0


def load_recent_recommendations(limit: int = 10) -> list[dict[str, Any]]:
    try:
        with get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    id,
                    created_at,
                    location_name,
                    latitude,
                    longitude,
                    demand_kw,
                    best_source,
                    confidence,
                    summary,
                    estimated_features_json,
                    rankings_json,
                    data_source,
                    fetched_at
                FROM recommendation_history
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    except sqlite3.Error:
        return []
    return [_hydrate_row(row) for row in rows]


def _hydrate_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "location_name": row["location_name"],
        "location": {
            "latitude": row["latitude"],
            "longitude": row["longitude"],
        },
        "demand_kw": row["demand_kw"],
        "best_source": row["best_source"],
        "confidence": row["confidence"],
        "summary": row["summary"],
        "estimated_features": json.loads(row["estimated_features_json"]),
        "rankings": json.loads(row["rankings_json"]),
        "data_source": row["data_source"],
        "fetched_at": row["fetched_at"],
    }


def save_many(records: Iterable[dict[str, Any]]) -> list[int]:
    return [save_recommendation(record) for record in records]
