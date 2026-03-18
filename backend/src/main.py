# main.py — FastAPI entry point for the SpecFlow pipeline

import os
import sys

# Ensure imports resolve from this directory
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Optional

from services.pipeline import Pipeline

app = FastAPI(title="SpecFlow Pipeline API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    input_data: dict[str, Any]
    project_id: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "specflow-pipeline"}


@app.post("/run")
async def run_pipeline(req: RunRequest):
    try:
        print(f"[pipeline] Starting run | project_id={req.project_id}")
        pipeline = Pipeline()
        result = await pipeline.run(req.input_data, req.project_id)
        print(f"[pipeline] Run complete | keys={list(result.keys())}")
        return {"success": True, "data": result}
    except Exception as e:
        import traceback
        print(f"[pipeline] Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
