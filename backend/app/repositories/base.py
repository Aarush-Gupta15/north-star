"""Generic repository — the only place CRUD queries are constructed.

A typed ``BaseRepository[ModelT]`` removes boilerplate (DRY) while concrete
subclasses add intention-revealing reads. Services depend on these methods, not
on SQLAlchemy, which keeps query logic in one swappable place (Dependency
Inversion).
"""
from __future__ import annotations

import uuid
from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, id_: uuid.UUID) -> ModelT | None:
        return self.db.get(self.model, id_)

    def list(self, limit: int = 100, offset: int = 0) -> list[ModelT]:
        stmt = select(self.model).limit(limit).offset(offset)
        return list(self.db.scalars(stmt).all())

    def add(self, obj: ModelT) -> ModelT:
        self.db.add(obj)
        self.db.flush()  # assign PK / defaults without committing the txn
        self.db.refresh(obj)
        return obj

    def delete(self, obj: ModelT) -> None:
        self.db.delete(obj)
        self.db.flush()
