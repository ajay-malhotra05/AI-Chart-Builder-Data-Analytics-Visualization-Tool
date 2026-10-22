"""
AI Chart Builder - Data Processing Pipeline
===========================================
Architect: Principal Full-Stack Engineer & Data Architect
Module: pipeline.py

This module contains the enterprise-grade Pandas ingestion, automated cleaning,
dynamic transformation, and Chart.js JSON formatting engine.
"""

from __future__ import annotations
import io
import json
import re
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd


class PipelineError(Exception):
    """Custom exception raised for errors within the data pipeline."""
    pass


class OutputFormatter:
    """
    Formats transformed Pandas DataFrames into standard Chart.js 4.x compatible structures.
    Supports: Bar, Horizontal Bar, Line, Doughnut, Pie, Scatter, Radar, Polar Area.
    """

    DEFAULT_PALETTES = {
        "modern": [
            "rgba(99, 102, 241, 0.85)",   # Indigo
            "rgba(16, 185, 129, 0.85)",  # Emerald
            "rgba(245, 158, 11, 0.85)",  # Amber
            "rgba(239, 68, 68, 0.85)",   # Rose
            "rgba(139, 92, 246, 0.85)",  # Purple
            "rgba(14, 165, 233, 0.85)",  # Sky Blue
            "rgba(236, 72, 153, 0.85)",  # Pink
            "rgba(20, 184, 166, 0.85)",  # Teal
            "rgba(249, 115, 22, 0.85)",  # Orange
            "rgba(107, 114, 128, 0.85)"  # Slate Gray
        ],
        "borders": [
            "rgb(99, 102, 241)",
            "rgb(16, 185, 129)",
            "rgb(245, 158, 11)",
            "rgb(239, 68, 68)",
            "rgb(139, 92, 246)",
            "rgb(14, 165, 233)",
            "rgb(236, 72, 153)",
            "rgb(20, 184, 166)",
            "rgb(249, 115, 22)",
            "rgb(107, 114, 128)"
        ]
    }

    @classmethod
    def get_colors(cls, count: int) -> Tuple[List[str], List[str]]:
        """Generate repeating palette colors for N labels."""
        bg = cls.DEFAULT_PALETTES["modern"]
        borders = cls.DEFAULT_PALETTES["borders"]
        bg_colors = [bg[i % len(bg)] for i in range(count)]
        border_colors = [borders[i % len(borders)] for i in range(count)]
        return bg_colors, border_colors

    @classmethod
    def format_single_series(
        cls,
        df: pd.DataFrame,
        label_col: str,
        value_col: str,
        chart_type: str = "bar",
        dataset_label: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Formats single-dimension aggregation into Chart.js payload:
        {
            "labels": [...],
            "datasets": [{
                "label": "Metric Name",
                "data": [...],
                "backgroundColor": [...],
                "borderColor": [...]
            }]
        }
        """
        # Ensure values are JSON serializable
        clean_df = df.copy()
        clean_df[value_col] = clean_df[value_col].apply(
            lambda v: None if pd.isna(v) or np.isinf(v) else round(float(v), 2) if isinstance(v, (float, np.floating)) else v
        )

        labels = [str(lbl) if not pd.isna(lbl) else "(Blank)" for lbl in clean_df[label_col].tolist()]
        values = clean_df[value_col].tolist()
        num_items = len(labels)

        bg_colors, border_colors = cls.get_colors(num_items)

        # For line charts, single unified background and fill is cleaner
        if chart_type in ["line"]:
            dataset_cfg = {
                "label": dataset_label or value_col,
                "data": values,
                "borderColor": border_colors[0],
                "backgroundColor": "rgba(99, 102, 241, 0.15)",
                "fill": True,
                "tension": 0.35,
                "pointRadius": 4,
                "pointHoverRadius": 6
            }
        elif chart_type in ["pie", "doughnut", "polarArea"]:
            dataset_cfg = {
                "label": dataset_label or value_col,
                "data": values,
                "backgroundColor": bg_colors,
                "borderColor": "#ffffff",
                "borderWidth": 2
            }
        else:
            # Bar / Horizontal Bar / Radar
            dataset_cfg = {
                "label": dataset_label or value_col,
                "data": values,
                "backgroundColor": bg_colors,
                "borderColor": border_colors,
                "borderWidth": 1.5,
                "borderRadius": 6
            }

        return {
            "labels": labels,
            "datasets": [dataset_cfg]
        }

    @classmethod
    def format_multi_series(
        cls,
        pivoted_df: pd.DataFrame,
        group_col: str,
        series_col: str,
        value_col: str,
        chart_type: str = "bar"
    ) -> Dict[str, Any]:
        """
        Formats 2-dimensional cross-tabulated aggregation (e.g. Sales by Region per Quarter).
        """
        labels = [str(idx) for idx in pivoted_df.index.tolist()]
        datasets = []
        series_names = list(pivoted_df.columns)

        for i, s_name in enumerate(series_names):
            color_idx = i % len(cls.DEFAULT_PALETTES["modern"])
            bg = cls.DEFAULT_PALETTES["modern"][color_idx]
            border = cls.DEFAULT_PALETTES["borders"][color_idx]

            raw_vals = pivoted_df[s_name].tolist()
            clean_vals = [
                None if pd.isna(v) or np.isinf(v) else round(float(v), 2) if isinstance(v, (float, np.floating)) else v
                for v in raw_vals
            ]

            datasets.append({
                "label": str(s_name),
                "data": clean_vals,
                "backgroundColor": bg,
                "borderColor": border,
                "borderWidth": 1.5,
                "borderRadius": 4,
                "tension": 0.35 if chart_type == "line" else 0
            })

        return {
            "labels": labels,
            "datasets": datasets
        }

    @classmethod
    def format_scatter(
        cls,
        df: pd.DataFrame,
        x_col: str,
        y_col: str,
        category_col: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Formats two continuous numerical columns into a Chart.js scatter dataset:
        { "datasets": [{ "label": "...", "data": [{ "x": 10, "y": 20 }, ...] }] }
        """
        clean_df = df.dropna(subset=[x_col, y_col]).copy()

        if category_col and category_col in clean_df.columns:
            categories = clean_df[category_col].unique()
            datasets = []
            for i, cat in enumerate(categories):
                sub_df = clean_df[clean_df[category_col] == cat]
                data_points = [
                    {"x": round(float(row[x_col]), 2), "y": round(float(row[y_col]), 2)}
                    for _, row in sub_df.iterrows()
                ]
                color_idx = i % len(cls.DEFAULT_PALETTES["modern"])
                datasets.append({
                    "label": str(cat),
                    "data": data_points,
                    "backgroundColor": cls.DEFAULT_PALETTES["modern"][color_idx],
                    "borderColor": cls.DEFAULT_PALETTES["borders"][color_idx],
                    "pointRadius": 5,
                    "pointHoverRadius": 7
                })
            return {"datasets": datasets}
        else:
            data_points = [
                {"x": round(float(row[x_col]), 2), "y": round(float(row[y_col]), 2)}
                for _, row in clean_df.iterrows()
            ]
            return {
                "datasets": [{
                    "label": f"{y_col} vs {x_col}",
                    "data": data_points,
                    "backgroundColor": cls.DEFAULT_PALETTES["modern"][0],
                    "borderColor": cls.DEFAULT_PALETTES["borders"][0],
                    "pointRadius": 5,
                    "pointHoverRadius": 7
                }]
            }


class DataPipeline:
    """
    Robust Data Ingestion, Automated Cleaning, and Dynamic Aggregation Pipeline.
    """

    def __init__(self, raw_data: Optional[pd.DataFrame] = None):
        self.raw_df: pd.DataFrame = raw_data if raw_data is not None else pd.DataFrame()
        self.cleaned_df: pd.DataFrame = pd.DataFrame()
        self.cleaning_report: Dict[str, Any] = {}

    # =========================================================================
    # 1. INGESTION ENGINE
    # =========================================================================

    @classmethod
    def from_csv_bytes(cls, content: bytes, encoding_candidates: Optional[List[str]] = None) -> "DataPipeline":
        """
        Safely parses CSV bytes with fallback encodings, delimiter sniffing,
        and malformed line resilience.
        """
        encodings = encoding_candidates or ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
        df: Optional[pd.DataFrame] = None
        last_error = None

        for enc in encodings:
            try:
                # Delimiter detection: sniff comma, semicolon, tab
                sample = content[:4096].decode(enc, errors="ignore")
                delimiters = [",", ";", "\t", "|"]
                best_delim = max(delimiters, key=lambda d: sample.count(d))
                if sample.count(best_delim) == 0:
                    best_delim = ","

                df = pd.read_csv(
                    io.BytesIO(content),
                    encoding=enc,
                    sep=best_delim,
                    engine="python",
                    on_bad_lines="skip"
                )
                break
            except Exception as e:
                last_error = e
                continue

        if df is None:
            raise PipelineError(f"Failed to parse CSV file: {last_error}")

        pipeline = cls(raw_data=df)
        pipeline.clean()
        return pipeline

    @classmethod
    def from_json_bytes(cls, content: bytes) -> "DataPipeline":
        """
        Safely parses JSON data from bytes. Handles standard array of objects,
        split orientation, or single nested objects.
        """
        try:
            text = content.decode("utf-8")
            data = json.loads(text)

            if isinstance(data, list):
                df = pd.json_normalize(data)
            elif isinstance(data, dict):
                # Check for standard nested structures like data or records
                for key in ["data", "records", "items", "results", "rows"]:
                    if key in data and isinstance(data[key], list):
                        df = pd.json_normalize(data[key])
                        break
                else:
                    df = pd.json_normalize([data])
            else:
                raise PipelineError("JSON content must be an array of objects or key-value dictionary.")

            pipeline = cls(raw_data=df)
            pipeline.clean()
            return pipeline
        except Exception as e:
            raise PipelineError(f"Failed to parse JSON file: {e}")

    # =========================================================================
    # 2. DATA CLEANING & TYPE NORMALIZATION
    # =========================================================================

    def clean(self) -> pd.DataFrame:
        """
        Executes end-to-end data sanitization:
        - Normalizes column names (strips whitespace, replaces special symbols)
        - Removes 100% duplicate rows
        - Cleans string columns (trims whitespace, converts empty strings to NaN)
        - Infers and parses numeric columns (strips $, %, commas)
        - Infers ISO/common datetime formats
        """
        if self.raw_df.empty:
            self.cleaned_df = pd.DataFrame()
            return self.cleaned_df

        df = self.raw_df.copy()
        initial_row_count = len(df)

        # 1. Normalize Column Names
        cleaned_columns = []
        for col in df.columns:
            clean_col = str(col).strip()
            # Replace whitespace sequences with a single underscore or clean space
            clean_col = re.sub(r"\s+", " ", clean_col)
            cleaned_columns.append(clean_col)
        df.columns = cleaned_columns

        # 2. Deduplicate rows
        df = df.drop_duplicates().reset_index(drop=True)
        dropped_duplicates = initial_row_count - len(df)

        # 3. String & Null Normalization
        type_conversions: Dict[str, str] = {}
        missing_counts: Dict[str, int] = {}

        for col in df.columns:
            # If object or string type
            if df[col].dtype == "object":
                # Trim whitespace and replace empty string with NaN
                s = df[col].astype(str).str.strip()
                s = s.replace({"": np.nan, "null": np.nan, "None": np.nan, "NaN": np.nan, "nan": np.nan, "-": np.nan})

                # Try numeric conversion (handle $1,250.50 or 45%)
                sample_non_null = s.dropna()
                if len(sample_non_null) > 0:
                    # Test if column resembles numeric currency / percentage
                    numeric_candidate = sample_non_null.str.replace(r"[\$,]", "", regex=True)
                    numeric_candidate = numeric_candidate.str.rstrip("%")
                    
                    is_numeric = pd.to_numeric(numeric_candidate, errors="coerce").notna().mean() > 0.85
                    if is_numeric:
                        df[col] = pd.to_numeric(
                            s.str.replace(r"[\$,]", "", regex=True).str.rstrip("%"),
                            errors="coerce"
                        )
                        type_conversions[col] = "numeric"
                        continue

                    # Test datetime candidate
                    date_candidate = pd.to_datetime(sample_non_null.iloc[:50], errors="coerce")
                    if date_candidate.notna().mean() > 0.85:
                        df[col] = pd.to_datetime(s, errors="coerce")
                        type_conversions[col] = "datetime"
                        continue

                df[col] = s
                type_conversions[col] = "string"
            elif pd.api.types.is_numeric_dtype(df[col]):
                type_conversions[col] = "numeric"
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                type_conversions[col] = "datetime"
            else:
                type_conversions[col] = str(df[col].dtype)

            missing_counts[col] = int(df[col].isna().sum())

        self.cleaned_df = df
        self.cleaning_report = {
            "initial_rows": initial_row_count,
            "final_rows": len(df),
            "duplicates_removed": dropped_duplicates,
            "columns": list(df.columns),
            "type_conversions": type_conversions,
            "missing_values": missing_counts
        }
        return self.cleaned_df

    # =========================================================================
    # 3. SCHEMA & METRICS DISCOVERY
    # =========================================================================

    def get_schema(self) -> Dict[str, Any]:
        """Returns column data types, unique counts, sample values, and numeric summaries."""
        if self.cleaned_df.empty:
            return {"columns": [], "row_count": 0}

        df = self.cleaned_df
        columns_info = []

        for col in df.columns:
            dtype = str(df[col].dtype)
            is_numeric = pd.api.types.is_numeric_dtype(df[col])
            is_date = pd.api.types.is_datetime64_any_dtype(df[col])

            col_meta: Dict[str, Any] = {
                "name": col,
                "type": "numeric" if is_numeric else "datetime" if is_date else "categorical",
                "raw_type": dtype,
                "null_count": int(df[col].isna().sum()),
                "unique_count": int(df[col].nunique(dropna=True)),
                "sample_values": df[col].dropna().unique()[:5].tolist()
            }

            if is_numeric:
                col_meta["stats"] = {
                    "min": round(float(df[col].min()), 2) if not pd.isna(df[col].min()) else None,
                    "max": round(float(df[col].max()), 2) if not pd.isna(df[col].max()) else None,
                    "mean": round(float(df[col].mean()), 2) if not pd.isna(df[col].mean()) else None,
                    "median": round(float(df[col].median()), 2) if not pd.isna(df[col].median()) else None,
                }

            columns_info.append(col_meta)

        return {
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": columns_info,
            "cleaning_report": self.cleaning_report
        }

    # =========================================================================
    # 4. DYNAMIC TRANSFORMATION & AGGREGATION ENGINE
    # =========================================================================

    def transform_and_format(
        self,
        target_column: Optional[str] = None,
        group_by: Optional[str] = None,
        secondary_group_by: Optional[str] = None,
        metric: str = "sum",
        top_n: Optional[int] = 10,
        sort_order: str = "desc",
        chart_type: str = "bar",
        filters: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Executes parameter-driven aggregation:
        - Filters data
        - Groups by primary (and secondary) column
        - Computes metric: sum, mean, median, min, max, count, nunique
        - Sorts results & extracts top N
        - Generates Chart.js specification via OutputFormatter
        """
        if self.cleaned_df.empty:
            raise PipelineError("DataFrame is empty. Please upload or ingest data first.")

        df = self.cleaned_df.copy()

        # 1. Apply user filters
        if filters:
            for f in filters:
                col = f.get("column")
                op = f.get("operator", "==")
                val = f.get("value")

                if col not in df.columns or val is None:
                    continue

                if op == "==":
                    df = df[df[col].astype(str) == str(val)]
                elif op == "!=":
                    df = df[df[col].astype(str) != str(val)]
                elif op == ">":
                    df = df[pd.to_numeric(df[col], errors="coerce") > float(val)]
                elif op == ">=":
                    df = df[pd.to_numeric(df[col], errors="coerce") >= float(val)]
                elif op == "<":
                    df = df[pd.to_numeric(df[col], errors="coerce") < float(val)]
                elif op == "<=":
                    df = df[pd.to_numeric(df[col], errors="coerce") <= float(val)]
                elif op == "contains":
                    df = df[df[col].astype(str).str.contains(str(val), case=False, na=False)]

        # 2. Handle Scatter Plot (Two numerical columns)
        if chart_type == "scatter":
            x_col = group_by
            y_col = target_column
            if not x_col or not y_col:
                raise PipelineError("Scatter chart requires both an X column (group_by) and Y column (target_column).")
            if x_col not in df.columns or y_col not in df.columns:
                raise PipelineError(f"Columns '{x_col}' or '{y_col}' not found in dataset.")

            chart_payload = OutputFormatter.format_scatter(
                df=df,
                x_col=x_col,
                y_col=y_col,
                category_col=secondary_group_by
            )
            return {
                "chart": chart_payload,
                "summary": {
                    "total_points": len(df.dropna(subset=[x_col, y_col])),
                    "x_column": x_col,
                    "y_column": y_col,
                    "chart_type": "scatter"
                }
            }

        # 3. Handle Aggregation Queries
        if not group_by or group_by not in df.columns:
            raise PipelineError(f"Valid group_by column required. Available: {list(df.columns)}")

        # Validation for metric & target column
        metric_fn = metric.lower()
        valid_metrics = ["sum", "mean", "median", "min", "max", "count", "nunique"]
        if metric_fn not in valid_metrics:
            metric_fn = "count"

        if metric_fn != "count" and metric_fn != "nunique":
            if not target_column or target_column not in df.columns:
                raise PipelineError(f"Target column '{target_column}' is required for metric '{metric_fn}'.")
            if not pd.api.types.is_numeric_dtype(df[target_column]):
                # Attempt conversion
                df[target_column] = pd.to_numeric(df[target_column], errors="coerce")

        # 4. Multi-Series (Stacked / Grouped Bar or Multi-Line)
        if secondary_group_by and secondary_group_by in df.columns and secondary_group_by != group_by:
            agg_col = target_column if metric_fn not in ["count", "nunique"] else df.columns[0]
            pivoted = df.pivot_table(
                index=group_by,
                columns=secondary_group_by,
                values=agg_col,
                aggfunc=metric_fn,
                fill_value=0
            )

            # Sort by total row sum if requested
            if sort_order == "desc":
                pivoted = pivoted.loc[pivoted.sum(axis=1).sort_values(ascending=False).index]
            elif sort_order == "asc":
                pivoted = pivoted.loc[pivoted.sum(axis=1).sort_values(ascending=True).index]

            if top_n and len(pivoted) > top_n:
                pivoted = pivoted.iloc[:top_n]

            chart_payload = OutputFormatter.format_multi_series(
                pivoted_df=pivoted,
                group_col=group_by,
                series_col=secondary_group_by,
                value_col=target_column or "Count",
                chart_type=chart_type
            )
            return {
                "chart": chart_payload,
                "summary": {
                    "primary_group": group_by,
                    "secondary_group": secondary_group_by,
                    "metric": metric_fn,
                    "total_categories": len(pivoted),
                    "chart_type": chart_type
                }
            }

        # 5. Single Dimension Aggregation
        if metric_fn in ["count", "nunique"]:
            agg_col = target_column if target_column and target_column in df.columns else group_by
            agg_series = df.groupby(group_by)[agg_col].agg(metric_fn)
            metric_label = f"{metric_fn.title()} of {agg_col}"
        else:
            agg_series = df.groupby(group_by)[target_column].agg(metric_fn)
            metric_label = f"{metric_fn.title()} of {target_column}"

        # Clean NaN index
        agg_df = agg_series.reset_index()
        agg_df.columns = [group_by, "value"]

        # Sort
        if sort_order == "desc":
            agg_df = agg_df.sort_values(by="value", ascending=False)
        elif sort_order == "asc":
            agg_df = agg_df.sort_values(by="value", ascending=True)

        # Top N handling with clean slicing
        total_unique_groups = len(agg_df)
        if top_n and top_n > 0 and len(agg_df) > top_n:
            top_df = agg_df.iloc[:top_n].copy()
            # Group remainder into "Other" if applicable
            other_val = agg_df.iloc[top_n:]["value"].sum() if metric_fn == "sum" else agg_df.iloc[top_n:]["value"].mean()
            if not pd.isna(other_val) and other_val > 0:
                other_row = pd.DataFrame([{group_by: "Other", "value": round(float(other_val), 2)}])
                agg_df = pd.concat([top_df, other_row], ignore_index=True)
            else:
                agg_df = top_df

        chart_payload = OutputFormatter.format_single_series(
            df=agg_df,
            label_col=group_by,
            value_col="value",
            chart_type=chart_type,
            dataset_label=metric_label
        )

        # Summary statistics
        clean_values = [v for v in agg_df["value"].dropna() if isinstance(v, (int, float))]
        summary_stats = {
            "group_by": group_by,
            "target_column": target_column,
            "metric": metric_fn,
            "total_groups": total_unique_groups,
            "top_category": str(agg_df.iloc[0][group_by]) if not agg_df.empty else None,
            "top_value": round(float(agg_df.iloc[0]["value"]), 2) if not agg_df.empty and pd.notna(agg_df.iloc[0]["value"]) else None,
            "aggregate_sum": round(float(sum(clean_values)), 2) if clean_values else 0,
            "aggregate_mean": round(float(np.mean(clean_values)), 2) if clean_values else 0,
            "chart_type": chart_type
        }

        return {
            "chart": chart_payload,
            "summary": summary_stats
        }
