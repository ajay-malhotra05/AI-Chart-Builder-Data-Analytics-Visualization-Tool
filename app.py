"""
AI Chart Builder - Backend REST API
===================================
Architect: Principal Full-Stack Engineer & Data Architect
Module: app.py

FastAPI Application providing dataset ingestion, schema introspection,
dynamic Pandas transformations, and natural language analytics queries.
"""

from __future__ import annotations
import os
import uuid
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from pipeline import DataPipeline, PipelineError

# Initialize FastAPI App
app = FastAPI(
    title="AI Chart Builder API",
    description="High-performance data pipeline and Chart.js visualization engine",
    version="1.0.0"
)

# Enable CORS for frontend dashboard communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session dataset store (in production: Redis / S3 / PostgreSQL)
DATASET_STORE: Dict[str, DataPipeline] = {}
DATASET_META: Dict[str, Dict[str, Any]] = {}


# =============================================================================
# PYDANTIC SCHEMAS
# =============================================================================

class FilterCondition(BaseModel):
    column: str
    operator: str = Field(default="==", description="==, !=, >, >=, <, <=, contains")
    value: Any


class QueryRequest(BaseModel):
    dataset_id: str
    target_column: Optional[str] = None
    group_by: str
    secondary_group_by: Optional[str] = None
    metric: str = Field(default="sum", description="sum, mean, median, min, max, count, nunique")
    top_n: Optional[int] = Field(default=10, description="Top N categories to display")
    sort_order: str = Field(default="desc", description="desc or asc")
    chart_type: str = Field(default="bar", description="bar, line, doughnut, pie, scatter, radar, polarArea")
    filters: Optional[List[FilterCondition]] = None


class NaturalLanguageQueryRequest(BaseModel):
    dataset_id: str
    prompt: str


class UploadResponse(BaseModel):
    dataset_id: str
    filename: str
    row_count: int
    column_count: int
    schema: Dict[str, Any]
    preview_data: List[Dict[str, Any]]
    cleaning_report: Dict[str, Any]


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "AI Chart Builder Backend API",
        "version": "1.0.0",
        "docs_url": "/docs"
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "loaded_datasets": len(DATASET_STORE)}


@app.post("/api/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    """
    Ingests and validates CSV or JSON files:
    1. Checks file extension and MIME type
    2. Runs automated Pandas sanitization & type inference
    3. Caches dataset in memory with unique dataset_id
    4. Returns schema overview, cleaning metrics, and preview rows
    """
    filename = file.filename or "dataset.csv"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in [".csv", ".json"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Please upload .csv or .json files."
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    try:
        if ext == ".csv":
            pipeline = DataPipeline.from_csv_bytes(content)
        else:
            pipeline = DataPipeline.from_json_bytes(content)

        dataset_id = str(uuid.uuid4())
        DATASET_STORE[dataset_id] = pipeline

        schema = pipeline.get_schema()
        # Extract first 15 rows for UI table preview
        preview_rows = pipeline.cleaned_df.head(15).to_dict(orient="records")

        # Sanitize NaN/None values for JSON serialization
        sanitized_preview = []
        for row in preview_rows:
            clean_row = {}
            for k, v in row.items():
                if v is None or (isinstance(v, float) and (v != v or abs(v) == float("inf"))):
                    clean_row[k] = None
                else:
                    clean_row[k] = v
            sanitized_preview.append(clean_row)

        DATASET_META[dataset_id] = {
            "filename": filename,
            "row_count": schema["row_count"],
            "column_count": schema["column_count"],
        }

        return UploadResponse(
            dataset_id=dataset_id,
            filename=filename,
            row_count=schema["row_count"],
            column_count=schema["column_count"],
            schema=schema,
            preview_data=sanitized_preview,
            cleaning_report=pipeline.cleaning_report
        )

    except PipelineError as pe:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Pipeline error: {str(e)}")


@app.post("/api/query")
def execute_query(payload: QueryRequest):
    """
    Accepts structured analytical parameters, triggers Pandas transformation,
    and returns Chart.js payload + summary metrics.
    """
    dataset_id = payload.dataset_id
    if dataset_id not in DATASET_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found. Please upload a file first."
        )

    pipeline = DATASET_STORE[dataset_id]

    filters_list = [f.dict() for f in payload.filters] if payload.filters else None

    try:
        result = pipeline.transform_and_format(
            target_column=payload.target_column,
            group_by=payload.group_by,
            secondary_group_by=payload.secondary_group_by,
            metric=payload.metric,
            top_n=payload.top_n,
            sort_order=payload.sort_order,
            chart_type=payload.chart_type,
            filters=filters_list
        )
        return result
    except PipelineError as pe:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/api/ai-query")
def execute_ai_query(payload: NaturalLanguageQueryRequest):
    """
    Translates Natural Language queries (e.g. 'Show total sales by category sorted by highest')
    into dynamic Pandas parameters and returns Chart.js visualizations.
    """
    dataset_id = payload.dataset_id
    if dataset_id not in DATASET_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found."
        )

    pipeline = DATASET_STORE[dataset_id]
    schema = pipeline.get_schema()
    columns = [col["name"] for col in schema["columns"]]
    prompt_lower = payload.prompt.lower()

    # Rule-based and intent heuristic matching for robust zero-dependency execution
    # 1. Infer metric
    metric = "count"
    for m, kw in [
        ("sum", ["total", "sum", "overall", "aggregate"]),
        ("mean", ["average", "avg", "mean"]),
        ("median", ["median"]),
        ("min", ["minimum", "lowest", "least", "min"]),
        ("max", ["maximum", "highest", "peak", "max"]),
        ("count", ["number of", "count", "frequency", "how many"])
    ]:
        if any(w in prompt_lower for w in kw):
            metric = m
            break

    # 2. Identify target numerical column & group categorical column
    target_col = None
    group_col = None

    for col_info in schema["columns"]:
        cname = col_info["name"].lower()
        if cname in prompt_lower:
            if col_info["type"] == "numeric" and not target_col:
                target_col = col_info["name"]
            elif not group_col:
                group_col = col_info["name"]

    # Fallbacks if not matched by exact name
    if not group_col:
        for c in schema["columns"]:
            if c["type"] == "categorical":
                group_col = c["name"]
                break
        if not group_col and columns:
            group_col = columns[0]

    if not target_col and metric != "count":
        for c in schema["columns"]:
            if c["type"] == "numeric":
                target_col = c["name"]
                break

    # 3. Infer chart type
    chart_type = "bar"
    if any(k in prompt_lower for k in ["line", "trend", "over time", "monthly"]):
        chart_type = "line"
    elif any(k in prompt_lower for k in ["doughnut", "donut", "pie", "share", "proportion"]):
        chart_type = "doughnut"
    elif any(k in prompt_lower for k in ["scatter", "correlation", "relationship"]):
        chart_type = "scatter"

    # 4. Infer top N
    top_n = 10
    import re
    top_match = re.search(r"top\s*(\d+)", prompt_lower)
    if top_match:
        top_n = int(top_match.group(1))

    # Execute pipeline
    result = pipeline.transform_and_format(
        target_column=target_col,
        group_by=group_col,
        metric=metric,
        top_n=top_n,
        sort_order="desc",
        chart_type=chart_type
    )

    result["ai_interpretation"] = {
        "understood_prompt": payload.prompt,
        "selected_group_by": group_col,
        "selected_target_column": target_col,
        "selected_metric": metric,
        "selected_chart_type": chart_type,
        "top_n": top_n
    }
    return result


@app.get("/api/datasets/{dataset_id}")
def get_dataset_details(dataset_id: str):
    """Retrieves schema, column profiles, and sample rows for an active dataset."""
    if dataset_id not in DATASET_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    pipeline = DATASET_STORE[dataset_id]
    schema = pipeline.get_schema()
    preview = pipeline.cleaned_df.head(20).to_dict(orient="records")

    return {
        "dataset_id": dataset_id,
        "schema": schema,
        "preview_data": preview
    }


if __name__ == "__main__":
    import uvicorn
    # Default local development port
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
