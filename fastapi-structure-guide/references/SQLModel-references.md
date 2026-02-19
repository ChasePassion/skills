# SQLModel Reference (2026-02-19 High-Density Dictionary)
Zero fluff. All information. Read before any code generation.

## 0. SQLModel Overview
SQLModel (v0.0.34, released 2026-02-16) by tiangolo:
- Thin glue layer: Pydantic v2 (validation + JSON) + SQLAlchemy 2.0 (ORM + async + Alembic).
- Core rule: **One class = DB table + base schema** (`table=True`).
- Replaces: raw SQLAlchemy + separate Pydantic models.
- Benefits in FastAPI 0.129+: 50% less boilerplate, full type safety, seamless `response_model`, native async.
- Official in tiangolo/full-stack-fastapi-template v0.10.0+.
- Never mix with raw SQLAlchemy unless legacy migration.

## 1. Installation (uv)
uv add "sqlmodel>=0.0.34"
# Implicit: pydantic>=2.10, sqlalchemy>=2.0.46, fastapi>=0.129

## 2. Core Declaration
class Model(SQLModel, table=True):          # DB table + schema
    ...
class PureSchema(SQLModel, table=False):    # schema only (no table)

## 3. Field Definition (All Variants 2026)
from sqlmodel import SQLModel, Field
from datetime import datetime, timezone
from typing import Optional, Annotated
from pydantic import AfterValidator

id: int | None = Field(default=None, primary_key=True)
email: str = Field(index=True, unique=True, max_length=255, min_length=5)
age: Optional[int] = Field(default=None, ge=0, le=150)
created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
is_active: bool = Field(default=True, sa_column_kwargs={"server_default": "true"})
password: Annotated[str, AfterValidator(lambda v: v.strip())] = Field(min_length=8)

## 4. Relationships (2026 Recommended)
class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    items: list["Item"] = Relationship(
        back_populates="owner",
        sa_relationship_kwargs={"lazy": "selectin"}   # async safe
    )

class Item(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int | None = Field(default=None, foreign_key="user.id")
    owner: User | None = Relationship(back_populates="items")

## 5. Schema Variants (Strict 2026 Pattern)
class UserBase(SQLModel):
    email: str

class UserCreate(UserBase):
    password: str

class UserPublic(UserBase):
    id: int
    created_at: datetime
    is_active: bool
    model_config = {"from_attributes": True}   # Required for ORM → response_model

class User(UserBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

## 6. Async Repository CRUD (Standard)
from sqlmodel.ext.async_session import AsyncSession
from sqlmodel import select, delete, update
from sqlalchemy import func

async def create(db: AsyncSession, obj: SQLModel) -> SQLModel:
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

async def get_by_id(db: AsyncSession, Model: type[SQLModel], id: int):
    stmt = select(Model).where(Model.id == id)
    result = await db.exec(stmt)
    return result.first()

async def get_all(db: AsyncSession, Model: type[SQLModel], offset: int = 0, limit: int = 100):
    stmt = select(Model).offset(offset).limit(limit)
    result = await db.exec(stmt)
    return result.all()

async def delete_by_id(db: AsyncSession, Model: type[SQLModel], id: int):
    stmt = delete(Model).where(Model.id == id)
    await db.exec(stmt)
    await db.commit()

## 7. FastAPI Integration (Correct)
from fastapi import APIRouter, Depends, status
router = APIRouter()

@router.post("/", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    repo: UserRepository = Depends(get_user_repo)
):
    return await repo.create(user_in)   # repo handles hashing

## 8. ❌ Common Pitfalls vs ✅ Correct

❌ response_model=User                  # leaks hashed_password
✅ response_model=UserPublic

❌ class UserCreate(BaseModel): + class UserDB(SQLAlchemy)  # two classes
✅ One class inheritance pattern above

❌ user = User(**user_in.model_dump())  # plain password saved
✅ hashed = get_password_hash(user_in.password)
   user = User(email=..., hashed_password=hashed)

❌ session.add(); session.commit()      # sync in async route
✅ await db.commit(); await db.refresh()

❌ model_config missing                  # ORM cannot convert to response
✅ model_config = {"from_attributes": True}

❌ table=False on DB model              # no table created
✅ table=True on actual DB class

## 9. Alembic Migration (2026)
alembic revision --autogenerate -m "add user table"
alembic upgrade head
# Always run after changing models

## 10. Advanced Quick Reference
- JSON column: Field(sa_column=Column(JSONB))   # PostgreSQL
- Hybrid property: @hybrid_property + @hybrid_method
- Unique constraint across fields: __table_args__ = (UniqueConstraint("email", "tenant_id"),)
- Default in DB only: sa_column_kwargs={"server_default": text("now()")}
- Selectinload for relationships: select(User).options(selectinload(User.items))

End of reference. Follow exactly. No deviations.