---
name: fastapi-structure-guide
description: "Trigger when the user wants to create a new FastAPI project, add new features, refactor code, or asks about architectural best practices. This skill enforces 2026 clean architecture with SQLModel, Repository Pattern, full async, and production-ready workflow."
---

# FastAPI Structure Guide (2026 Optimized Edition)

## Intent

Use this guide whenever generating code for a FastAPI project, specifically when:

1. **Scaffolding** a brand new project.
2. **Adding a new feature** (e.g., "Add an Order module").
3. **Refactoring** existing code to meet 2026 clean architecture standards.

You **must** strictly adhere to the **Core Principles**, **Project Structure**, **Development Workflow**, and **Coding Rules** defined below.

---

## I. Core Principles

Before writing any code, follow these six guiding principles:

1. **Separation of Concerns (Clean Architecture)**
   - **API Layer**: Only reception, validation, HTTP concerns.
   - **Service Layer**: Pure business logic and orchestration.
   - **Repository Layer**: All data access (SQL, caching, external services).
   - **DB/Model Layer**: Data definition (SQLModel).
   - **Rule**: Never put business logic or raw SQL in API routes or services.

2. **Full Async First**
   - All routes, services, repositories must be `async def` by default.
   - Use `async_sessionmaker` + `await` everywhere.
   - Only use sync when absolutely necessary (e.g., legacy libs).

3. **Repository Pattern + Dependency Injection**
   - Services never touch Session directly.
   - Use FastAPI `Depends` + `Annotated` for injection.
   - Flow: DB Session → Repository → Service → API Route.

4. **Mandatory Use of SQLModel**
   - All database models and base schemas **must** use SQLModel (Pydantic v2 + SQLAlchemy 2.0).
   - One class serves as both DB table (`table=True`) and API schema base.
   - Never use raw SQLAlchemy + separate Pydantic models.
   - Always consult `references/sqlmodel-reference.md` for exact syntax, schema variants, relationships, and FastAPI integration patterns.

5. **Config Centralization**
   - All config via Pydantic Settings v2 (`BaseSettings`).
   - Never hardcode secrets, URLs, or keys.

6. **Mirrored & Layered Testing**
   - `tests/` mirrors `app/` 1:1.
   - Separate `unit/`, `integration/`.
   - Use SQLite in-memory + dependency overrides + pytest-asyncio.

---

## II. Recommended Project Structure (2026 Standard)

```text
my-fastapi-project/
├── app/                          # Core Application
│   ├── __init__.py
│   ├── main.py                   # App factory + lifespan
│   ├── api/                      # 🌐 API Layer
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── api.py            # Router aggregation
│   │       └── endpoints/
│   │           ├── __init__.py
│   │           ├── users.py
│   │           └── items.py
│   ├── core/                     # ⚙️ Cross-cutting
│   │   ├── __init__.py
│   │   ├── config.py             # Settings
│   │   ├── logging.py
│   │   ├── security.py
│   │   └── exceptions.py         # Custom HTTP exceptions
│   ├── db/                       # 🗄️ Database
│   │   ├── __init__.py
│   │   ├── session.py            # async_sessionmaker
│   │   ├── models.py             # SQLModel definitions (table=True)
│   │   └── alembic/              # Migrations
│   ├── schemas/                  # 📝 API Schemas (DTOs)
│   │   ├── __init__.py
│   │   └── user.py               # UserCreate, UserResponse, etc.
│   ├── repositories/             # 🗃️ Data Access Layer (NEW)
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── user_repository.py
│   │   └── item_repository.py
│   ├── services/                 # 🧠 Business Logic
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── user_service.py
│   │   └── item_service.py
│   └── dependencies.py           # Centralized Depends functions
├── tests/                        # ✅ Tests (mirrored)
│   ├── __init__.py
│   ├── conftest.py
│   ├── unit/
│   └── integration/
│       └── api/
│           └── v1/
│               └── endpoints/
│                   └── test_users.py
├── .env                          # Gitignored
├── .env.example
├── .gitignore
├── docker-compose.yaml
├── Dockerfile
├── pyproject.toml                # uv + ruff + pyright + pytest-asyncio
└── README.md
```

### Directory Responsibilities (Updated)

- **`app/schemas/`**: API input/output models (inherits from SQLModel when possible).
- **`app/repositories/`**: All DB operations, caching, external API calls. Thin wrapper around SQLModel.
- **`app/services/`**: Business rules, orchestration, validation. Depends on repositories.
- **`app/db/models.py`**: SQLModel classes with `table=True`.
- **`app/core/exceptions.py`**: Custom exceptions + HTTPException handlers.

---

## III. Creation Rules (Development Workflow)

When adding a new feature, follow these **6 Standard Steps** in strict order:

**Before Step A**: Read `references/sqlmodel-reference.md`.

**Step A: Database Model**  
Add SQLModel class in `app/db/models.py` (or split file if large).

**Step B: API Schemas**  
Create `app/schemas/resource.py` (Create/Update/Response variants).

**Step C: Repository**  
Create `app/repositories/resource_repository.py` (CRUD methods).

**Step D: Service**  
Create `app/services/resource_service.py` (business logic using repository).

**Step E: API Endpoint**  
Create `app/api/v1/endpoints/resource.py` (thin routes).

**Step F: Registration & Testing**  
1. Register router in `app/api/v1/api.py`.  
2. Write mirrored tests in `tests/integration/`.

---

## IV. Coding Rules (2026 Modern Examples)

### Rule 0: SQLModel Strict Compliance
All SQLModel code **must** exactly match patterns in `references/sqlmodel-reference.md`. 
Any deviation must be rejected and corrected.

### Rule 1: API Routes Must Be Thin & Async

```python
# ✅ Correct
@router.post("/users", response_model=UserResponse)
async def create_user(
    user_in: UserCreate,
    service: UserService = Depends(get_user_service),
):
    return await service.create_user(user_in)
```

### Rule 2: Repository Pattern (Data Access)

```python
# app/repositories/user_repository.py
from sqlmodel.ext.async_session import AsyncSession
from sqlmodel import select
from app.db.models import User

class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        result = await self.session.exec(statement)
        return result.first()
```

### Rule 3: Service Layer (Business Logic)

```python
# app/services/user_service.py
class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def create_user(self, data: UserCreate) -> User:
        # Business rules here
        if await self.repo.get_by_email(data.email):
            raise UserAlreadyExists()
        user = User(**data.model_dump(exclude={"password"}))
        # hash password etc.
        return await self.repo.create(user)
```

### Rule 4: Dependencies (centralized)

```python
# app/dependencies.py
from fastapi import Depends
from sqlmodel.ext.async_session import async_sessionmaker

async def get_db() -> AsyncSession:
    async with sessionmaker() as session:   # from db/session.py
        yield session

def get_user_repository(db: AsyncSession = Depends(get_db)) -> UserRepository:
    return UserRepository(db)

def get_user_service(repo: UserRepository = Depends(get_user_repository)) -> UserService:
    return UserService(repo)
```

### Rule 5: SQLModel Usage

```python
# app/db/models.py
from sqlmodel import SQLModel, Field

class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
```