export type ChartType = 
  | 'bar' 
  | 'horizontalBar' 
  | 'line' 
  | 'doughnut' 
  | 'pie' 
  | 'scatter' 
  | 'radar' 
  | 'polarArea';

export type MetricType = 
  | 'sum' 
  | 'mean' 
  | 'median' 
  | 'min' 
  | 'max' 
  | 'count' 
  | 'nunique';

export interface ColumnMeta {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime';
  raw_type: string;
  null_count: number;
  unique_count: number;
  sample_values: any[];
  stats?: {
    min: number | null;
    max: number | null;
    mean: number | null;
    median: number | null;
  };
}

export interface CleaningReport {
  initial_rows: number;
  final_rows: number;
  duplicates_removed: number;
  columns: string[];
  type_conversions: Record<string, string>;
  missing_values: Record<string, number>;
}

export interface DatasetSchema {
  row_count: number;
  column_count: number;
  columns: ColumnMeta[];
  cleaning_report: CleaningReport;
}

export interface QueryParams {
  target_column?: string;
  group_by: string;
  secondary_group_by?: string;
  metric: MetricType;
  top_n: number;
  sort_order: 'desc' | 'asc';
  chart_type: ChartType;
  palette: 'indigo' | 'emerald' | 'amber' | 'cyberpunk' | 'monochrome';
}

export interface ChartDataset {
  label: string;
  data: any[];
  backgroundColor: string | string[];
  borderColor: string | string[];
  borderWidth?: number;
  borderRadius?: number;
  fill?: boolean;
  tension?: number;
  pointRadius?: number;
  pointHoverRadius?: number;
}

export interface ChartPayload {
  labels?: string[];
  datasets: ChartDataset[];
}

export interface QueryResult {
  chart: ChartPayload;
  summary: {
    group_by?: string;
    target_column?: string;
    metric?: string;
    total_groups?: number;
    top_category?: string | null;
    top_value?: number | null;
    aggregate_sum?: number;
    aggregate_mean?: number;
    chart_type?: string;
    total_points?: number;
    x_column?: string;
    y_column?: string;
  };
  ai_interpretation?: {
    understood_prompt: string;
    selected_group_by: string;
    selected_target_column?: string;
    selected_metric: string;
    selected_chart_type: string;
    top_n: number;
  };
}
