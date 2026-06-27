from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path

from .database import engine, Base
from .routers import departments, roles, employees, categories, locations, tickets

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Complaint & Ticketing Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

upload_dir = Path(os.getenv("UPLOAD_DIR", "uploads"))
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

app.include_router(departments.router)
app.include_router(roles.router)
app.include_router(employees.router)
app.include_router(categories.router)
app.include_router(locations.router)
app.include_router(tickets.router)

static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

    @app.get("/")
    def serve_app():
        return FileResponse(static_dir / "index.html")
