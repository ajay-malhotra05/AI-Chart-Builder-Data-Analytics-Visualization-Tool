import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Code2,
  Sparkles,
  Database,
  BarChart2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { ClientDataPipeline, getDefaultGroupColumn } from './utils/pipeline';
import { SAMPLE_DATASETS } from './utils/sampleData';
import { ChartType, DatasetSchema, QueryParams, QueryResult } from './types';
import { ChartCanvas } from './components/ChartCanvas';
import { QueryBuilder } from './components/QueryBuilder';
import { DataPreview } from './components/DataPreview';
import { CodeInspector } from './components/CodeInspector';

export default function App() {
  const [pipeline, setPipeline] = useState<ClientDataPipeline | null>(null);
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [currentDatasetName, setCurrentDatasetName] = useState<string>('E-Commerce Orders & Profits');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<'preview' | 'code'>('preview');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Default query parameters
  const [queryParams, setQueryParams] = useState<QueryParams>({
    group_by: 'category',
    target_column: 'sales',
    metric: 'sum',
    top_n: 10,
    sort_order: 'desc',
    chart_type: 'bar',
    palette: 'indigo',
  });

  // Load initial sample dataset on mount
  useEffect(() => {
    loadDatasetFromText(SAMPLE_DATASETS[0].data, 'csv', SAMPLE_DATASETS[0].name);
  }, []);

  const loadDatasetFromText = (content: string, format: 'csv' | 'json', name: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      setAiNote(null);

      const newPipeline = format === 'csv'
        ? ClientDataPipeline.parseCSV(content)
        : ClientDataPipeline.parseJSON(content);

      if (!newPipeline.schema || newPipeline.schema.row_count === 0) {
        throw new Error('No valid records found in the uploaded data.');
      }

      setPipeline(newPipeline);
      setSchema(newPipeline.schema);
      setCurrentDatasetName(name);

      // Auto-configure default query parameters based on schema
      const cols = newPipeline.schema.columns;
      const firstCat = getDefaultGroupColumn(cols, newPipeline.schema.row_count);
      const firstNum = cols.find((c) => c.type === 'numeric');

      const initialParams: QueryParams = {
        group_by: firstCat?.name || (cols[0] ? cols[0].name : ''),
        target_column: firstNum?.name,
        metric: firstNum ? 'sum' : 'count',
        top_n: 10,
        sort_order: 'desc',
        chart_type: 'bar',
        palette: 'indigo',
      };

      setQueryParams(initialParams);

      // Execute initial visualization
      const res = newPipeline.transform(initialParams);
      setQueryResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to ingest data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'json') {
      setErrorMessage('Please upload a valid .csv or .json file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        loadDatasetFromText(text, ext as 'csv' | 'json', file.name);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Error reading uploaded file.');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Re-run transformation when query parameters change
  const handleParamsChange = (newParams: QueryParams) => {
    setQueryParams(newParams);
    if (!pipeline) return;

    try {
      setErrorMessage(null);
      const res = pipeline.transform(newParams);
      setQueryResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing query parameters.');
    }
  };

  // Handle Natural Language query
  const handleNaturalLanguageQuery = (prompt: string) => {
    if (!pipeline || !schema) return;
    setIsLoading(true);
    setErrorMessage(null);

    const promptLower = prompt.toLowerCase();
    const cols = schema.columns;

    // 1. Identify metric
    let detectedMetric: QueryParams['metric'] = 'count';
    const metricKeywords: [QueryParams['metric'], string[]][] = [
      ['sum', ['total', 'sum', 'overall', 'gross', 'revenue', 'amount']],
      ['mean', ['average', 'avg', 'mean', 'per']],
      ['median', ['median', 'middle']],
      ['min', ['minimum', 'min', 'lowest', 'least']],
      ['max', ['maximum', 'max', 'highest', 'peak', 'top']],
      ['count', ['number of', 'count', 'frequency', 'volume', 'how many']],
    ];

    for (const [m, keywords] of metricKeywords) {
      if (keywords.some((k) => promptLower.includes(k))) {
        detectedMetric = m;
        break;
      }
    }

    // 2. Identify target numerical column & group dimension
    let matchedTarget: string | undefined = undefined;
    let matchedGroup: string | undefined = undefined;

    for (const c of cols) {
      const cLower = c.name.toLowerCase();
      if (promptLower.includes(cLower)) {
        if (c.type === 'numeric' && !matchedTarget) {
          matchedTarget = c.name;
        } else if (!matchedGroup) {
          matchedGroup = c.name;
        }
      }
    }

    // Fallbacks
    if (!matchedGroup) {
      const firstCat = cols.find((c) => c.type === 'categorical' || c.type === 'datetime');
      matchedGroup = firstCat?.name || cols[0]?.name || '';
    }
    if (!matchedTarget && detectedMetric !== 'count') {
      const firstNum = cols.find((c) => c.type === 'numeric');
      matchedTarget = firstNum?.name;
    }

    // 3. Infer Chart Type
    let detectedChartType: ChartType = 'bar';
    if (['line', 'trend', 'over time', 'timeline', 'monthly'].some((w) => promptLower.includes(w))) {
      detectedChartType = 'line';
    } else if (['doughnut', 'donut', 'pie', 'share', 'distribution', 'proportion'].some((w) => promptLower.includes(w))) {
      detectedChartType = promptLower.includes('donut') || promptLower.includes('doughnut') ? 'doughnut' : 'pie';
    } else if (['scatter', 'correlation', 'versus', 'vs'].some((w) => promptLower.includes(w))) {
      detectedChartType = 'scatter';
    }

    // 4. Infer Top N
    let topN = 10;
    const topMatch = promptLower.match(/top\s*(\d+)/);
    if (topMatch && topMatch[1]) {
      topN = parseInt(topMatch[1], 10);
    }

    const updatedParams: QueryParams = {
      ...queryParams,
      group_by: matchedGroup,
      target_column: matchedTarget,
      metric: detectedMetric,
      chart_type: detectedChartType,
      top_n: topN,
      sort_order: 'desc',
    };

    try {
      const res = pipeline.transform(updatedParams);
      setQueryParams(updatedParams);
      setQueryResult(res);
      setAiNote(`Interpreted: ${detectedMetric.toUpperCase()} of ${matchedTarget || 'Records'} grouped by "${matchedGroup}" (Top ${topN}, ${detectedChartType} chart)`);
    } catch (err: any) {
      setErrorMessage(`Failed to execute parsed query: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Top Application Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">AI Chart Builder</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-full">
                  Pandas + Chart.js
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Full-Stack Ingestion Pipeline, Dynamic Aggregations & AI Visualizations
              </p>
            </div>
          </div>

          {/* Quick Sample Selector & File Upload */}
          <div className="flex items-center flex-wrap gap-2.5">
            <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
              <span className="text-[11px] font-medium text-slate-400 pl-2 pr-1">Sample Data:</span>
              {SAMPLE_DATASETS.map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => loadDatasetFromText(ds.data, ds.format, ds.name)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    currentDatasetName === ds.name
                      ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {ds.name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.json"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
                e.target.value = '';
              }}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload CSV / JSON
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Dataset Header Pill / Dropzone Notice */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 rounded-2xl border transition-all ${
            isDragging
              ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/30'
              : 'bg-white border-slate-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Dataset
                </span>
                <span className="text-sm font-bold text-slate-900">{currentDatasetName}</span>
              </div>
              <p className="text-xs text-slate-500">
                {schema?.row_count} sanitized records • {schema?.column_count} validated columns • Drag & drop any CSV/JSON here to switch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveBottomTab(activeBottomTab === 'code' ? 'preview' : 'code')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                activeBottomTab === 'code'
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              {activeBottomTab === 'code' ? 'Hide Code' : 'View Python Code'}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* AI Interpretation Banner */}
        {aiNote && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-indigo-50/80 border border-indigo-200 text-indigo-900 rounded-xl text-xs">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="font-medium">{aiNote}</span>
          </div>
        )}

        {/* Core Interactive Grid: Query Panel (Left) & Dynamic Canvas (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Query Control Panel */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <QueryBuilder
              schema={schema}
              params={queryParams}
              onChangeParams={handleParamsChange}
              onExecuteNaturalQuery={handleNaturalLanguageQuery}
              isLoading={isLoading}
            />
          </div>

          {/* Dynamic Chart Canvas */}
          <div className="lg:col-span-7 flex flex-col min-h-[500px]">
            <ChartCanvas
              queryResult={queryResult}
              chartType={queryParams.chart_type}
            />
          </div>
        </div>

        {/* Bottom Inspection Section: Data Preview or Python Code Inspector */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveBottomTab('preview')}
                className={`flex items-center gap-1.5 pb-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 -mb-2.5 ${
                  activeBottomTab === 'preview'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                Data Sanitization & Table Preview
              </button>
              <button
                onClick={() => setActiveBottomTab('code')}
                className={`flex items-center gap-1.5 pb-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 -mb-2.5 ${
                  activeBottomTab === 'code'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                Backend Python Architecture (pipeline.py, app.py)
              </button>
            </div>
          </div>

          {activeBottomTab === 'preview' ? (
            <DataPreview
              rows={pipeline?.cleanedRows || []}
              schema={schema}
            />
          ) : (
            <CodeInspector />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-400">
        AI Chart Builder • Full-Stack Data Pipeline & Chart.js Architecture • Powered by Google AI Studio
      </footer>
    </div>
  );
}
