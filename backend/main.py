from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os

from backend.database import init_db, get_db
from backend.services.sample_generator import seed_sample_database

# Import all routers
from backend.routes.dashboard import router as dashboard_router
from backend.routes.consumers import router as consumers_router
from backend.routes.monitoring import router as monitoring_router
from backend.routes.feeders import router as feeders_router
from backend.routes.transformers import router as transformers_router
from backend.routes.uploads import router as uploads_router
from backend.routes.detection import router as detection_router
from backend.routes.alerts import router as alerts_router
from backend.routes.analytics import router as analytics_router
from backend.routes.reports import router as reports_router
from backend.routes.simulation import router as simulation_router
from backend.routes.settings import router as settings_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables
    print("Initializing VoltGuard AI SQLite Database...")
    init_db()
    with get_db() as conn:
        seed_sample_database(conn)
    yield

app = FastAPI(
    title="VoltGuard AI Backend",
    description="Intelligent Electricity Consumption Monitoring, Anomaly Detection & Unauthorized Usage Investigation API",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(dashboard_router)
app.include_router(consumers_router)
app.include_router(monitoring_router)
app.include_router(feeders_router)
app.include_router(transformers_router)
app.include_router(uploads_router)
app.include_router(detection_router)
app.include_router(alerts_router)
app.include_router(analytics_router)
app.include_router(reports_router)
app.include_router(simulation_router)
app.include_router(settings_router)

@app.get("/")
def root_info():
    return {
        "system": "VoltGuard AI",
        "description": "Smart Power Theft Detection and Anomaly Monitoring System",
        "status": "online",
        "mode": "Research & Demonstration Prototype",
        "database": "SQLite",
        "ml_engine": "Isolation Forest & Random Forest (Scikit-Learn)",
        "disclaimer": "VoltGuard AI is a software prototype. Discrepancies and anomaly scores represent investigation priorities, not definitive proof of theft."
    }

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
