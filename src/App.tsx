import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, BarChart3, Bell, ChevronRight, CircleHelp, Database, FileSpreadsheet,
  History, LayoutDashboard, Menu, Moon, Plus, Search, Settings, Sparkles, Upload,
  WandSparkles, X, Layers3, Table2, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { ChartCanvas } from './components/ChartCanvas';
import { DataPreview } from './components/DataPreview';
import { QueryBuilder } from './components/QueryBuilder';
import { ClientDataPipeline, getDefaultGroupColumn } from './utils/pipeline';
import { SAMPLE_DATASETS } from './utils/sampleData';
import { ChartType, DatasetSchema, QueryParams, QueryResult } from './types';

type Page = 'overview' | 'datasets' | 'ai' | 'visualizations' | 'query' | 'history' | 'settings';

interface LoadedDataset {
  id: string;
  name: string;
  pipeline: ClientDataPipeline;
  schema: DatasetSchema;
  uploadedAt: Date;
}

interface HistoryItem {
  id: number;
  prompt: string;
  dataset: string;
  createdAt: Date;
  result: QueryResult | null;
}

const navigation: { id: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'datasets', label: 'Datasets', icon: Database },
  { id: 'ai', label: 'AI Analysis', icon: WandSparkles },
  { id: 'visualizations', label: 'Visualizations', icon: BarChart3 },
  { id: 'query', label: 'Query Builder', icon: Table2 },
  { id: 'history', label: 'History', icon: History },
];

const pageTitles: Record<Page, string> = {
  overview: 'Overview',
  datasets: 'Datasets',
  ai: 'AI Analysis',
  visualizations: 'Visualizations',
  query: 'Query Builder',
  history: 'Analysis History',
  settings: 'Settings',
};

export default function App() {
  const [page, setPage] = useState<Page>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [datasets, setDatasets] = useState<LoadedDataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryParams, setQueryParams] = useState<QueryParams>({
    group_by: '', metric: 'count', top_n: 10, sort_order: 'desc', chart_type: 'bar', palette: 'indigo',
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDataset = datasets.find((dataset) => dataset.id === activeDatasetId) || datasets[0];
  const pipeline = activeDataset?.pipeline || null;
  const schema = activeDataset?.schema || null;
  const missingValues = schema?.columns.reduce((total, column) => total + (column.null_count || 0), 0) || 0;

  const configureQuery = (nextPipeline: ClientDataPipeline) => {
    const columns = nextPipeline.schema?.columns || [];
    const category = getDefaultGroupColumn(columns, nextPipeline.schema?.row_count || 0);
    const numeric = columns.find((column) => column.type === 'numeric');
    const nextParams: QueryParams = {
      group_by: category?.name || columns[0]?.name || '',
      target_column: numeric?.name,
      metric: numeric ? 'sum' : 'count',
      top_n: 10,
      sort_order: 'desc',
      chart_type: 'bar',
      palette: 'indigo',
    };
    setQueryParams(nextParams);
    try {
      setQueryResult(nextPipeline.transform(nextParams));
    } catch {
      setQueryResult(null);
    }
  };

  const loadDataset = (content: string, format: 'csv' | 'json', name: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const nextPipeline = format === 'csv'
        ? ClientDataPipeline.parseCSV(content)
        : ClientDataPipeline.parseJSON(content);
      if (!nextPipeline.schema || nextPipeline.schema.row_count === 0) {
        throw new Error('No valid records were found in the dataset.');
      }
      const id = `${Date.now()}-${name}`;
      const loaded: LoadedDataset = {
        id, name, pipeline: nextPipeline, schema: nextPipeline.schema, uploadedAt: new Date(),
      };
      setDatasets((current) => {
        const duplicate = current.find((item) => item.name === name);
        return duplicate ? current.map((item) => item.name === name ? loaded : item) : [...current, loaded];
      });
      setActiveDatasetId(id);
      configureQuery(nextPipeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest the dataset.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const sample = SAMPLE_DATASETS[0];
    loadDataset(sample.data, sample.format, sample.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = (file: File) => {
    const format = file.name.split('.').pop()?.toLowerCase();
    if (format !== 'csv' && format !== 'json') {
      setError('Only CSV and JSON files are supported.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => loadDataset(String(reader.result || ''), format, file.name);
    reader.onerror = () => setError('The selected file could not be read.');
    reader.readAsText(file);
  };

  const selectDataset = (dataset: LoadedDataset) => {
    setActiveDatasetId(dataset.id);
    configureQuery(dataset.pipeline);
  };

  const handleParamsChange = (nextParams: QueryParams) => {
    setQueryParams(nextParams);
    if (!pipeline) return;
    try {
      setError(null);
      setQueryResult(pipeline.transform(nextParams));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process the query.');
    }
  };

  const runNaturalLanguageQuery = (prompt: string) => {
    if (!pipeline || !schema) return;
    setIsLoading(true);
    setError(null);
    setAiNote(null);
    const normalized = prompt.toLowerCase();
    const columns = schema.columns;
    let metric: QueryParams['metric'] = 'count';
    const metricRules: [QueryParams['metric'], string[]][] = [
      ['sum', ['total', 'sum', 'overall', 'revenue', 'sales']],
      ['mean', ['average', 'avg', 'mean']],
      ['median', ['median']],
      ['min', ['minimum', 'lowest', 'least']],
      ['max', ['maximum', 'highest', 'peak', 'top']],
      ['count', ['number of', 'count', 'frequency', 'how many']],
    ];
    metricRules.find(([value, words]) => {
      if (words.some((word) => normalized.includes(word))) {
        metric = value;
        return true;
      }
      return false;
    });

    const matchedNumeric = columns.find((column) =>
      column.type === 'numeric' && normalized.includes(column.name.toLowerCase()));
    const matchedDimension = columns.find((column) =>
      normalized.includes(column.name.toLowerCase()));
    const fallbackDimension = columns.find((column) => column.type === 'categorical' || column.type === 'datetime')
      || columns[0];
    const fallbackNumeric = columns.find((column) => column.type === 'numeric');
    let chartType: ChartType = 'bar';
    if (['line', 'trend', 'over time', 'monthly', 'timeline'].some((word) => normalized.includes(word))) chartType = 'line';
    if (['pie', 'share', 'distribution', 'proportion'].some((word) => normalized.includes(word))) chartType = 'pie';
    if (['donut', 'doughnut'].some((word) => normalized.includes(word))) chartType = 'doughnut';
    if (['scatter', 'correlation', 'versus', ' vs '].some((word) => normalized.includes(word))) chartType = 'scatter';
    const topMatch = normalized.match(/top\s*(\d+)/);
    const nextParams: QueryParams = {
      ...queryParams,
      group_by: matchedDimension?.name || fallbackDimension?.name || '',
      target_column: matchedNumeric?.name || (metric === 'count' ? undefined : fallbackNumeric?.name),
      metric,
      chart_type: chartType,
      top_n: topMatch ? Number(topMatch[1]) : 10,
      sort_order: normalized.includes('ascending') || normalized.includes('lowest') ? 'asc' : 'desc',
    };
    try {
      const result = pipeline.transform(nextParams);
      setQueryParams(nextParams);
      setQueryResult(result);
      setAiNote(`Interpreted ${metric} by "${nextParams.group_by}" as a ${chartType} visualization.`);
      setHistory((items) => [{
        id: Date.now(), prompt, dataset: activeDataset?.name || 'Dataset', createdAt: new Date(), result,
      }, ...items]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The query could not be processed.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    setMobileOpen(false);
  };

  const suggestions = [
    'Show total sales by category',
    'Find the top five products',
    'Analyze monthly trends',
    'Identify missing values',
    'Compare average values between groups',
  ];

  const renderOverview = () => (
    <div className="page-stack">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">Analytics workspace</p>
          <h1>Welcome to AI Chart Builder</h1>
          <p>Turn your data into meaningful insights.</p>
        </div>
        <div className="welcome-actions">
          <button className="button secondary" onClick={() => fileInputRef.current?.click()}><Upload />Upload dataset</button>
          <button className="button primary" onClick={() => navigate('ai')}><Sparkles />Analyze with AI</button>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard icon={<Database />} label="Total Datasets" value={datasets.length.toLocaleString()} tone="indigo" />
        <MetricCard icon={<Layers3 />} label="Total Rows" value={(schema?.row_count || 0).toLocaleString()} tone="cyan" />
        <MetricCard icon={<Table2 />} label="Total Columns" value={(schema?.column_count || 0).toLocaleString()} tone="violet" />
        <MetricCard icon={<AlertCircle />} label="Missing Values" value={missingValues.toLocaleString()} tone="amber" />
      </section>

      <section className="overview-grid">
        <div className="panel chart-panel">
          <PanelHeader title="Current visualization" subtitle={activeDataset?.name || 'No active dataset'} action={<button className="text-button" onClick={() => navigate('visualizations')}>Open workspace <ChevronRight /></button>} />
          <ChartCanvas queryResult={queryResult} chartType={queryParams.chart_type} />
        </div>
        <div className="panel recent-panel">
          <PanelHeader title="Recent datasets" subtitle={`${datasets.length} loaded`} action={<button className="icon-button" onClick={() => navigate('datasets')}><Plus /></button>} />
          <div className="dataset-list">
            {datasets.slice().reverse().map((dataset) => (
              <button key={dataset.id} className={`dataset-row ${dataset.id === activeDataset?.id ? 'selected' : ''}`} onClick={() => selectDataset(dataset)}>
                <span className="dataset-icon"><FileSpreadsheet /></span>
                <span><strong>{dataset.name}</strong><small>{dataset.schema.row_count.toLocaleString()} rows · {dataset.schema.column_count} columns</small></span>
                <ChevronRight />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel activity-panel">
        <PanelHeader title="Recent activity" subtitle="Queries performed in this session" />
        {history.length === 0 ? (
          <div className="empty-inline"><History /><span>No analysis activity yet. Start with an AI query.</span></div>
        ) : history.slice(0, 4).map((item) => (
          <div className="activity-row" key={item.id}>
            <span className="activity-icon"><Sparkles /></span><span><strong>{item.prompt}</strong><small>{item.dataset} · {item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></span>
          </div>
        ))}
      </section>
    </div>
  );

  const renderDatasets = () => (
    <div className="page-stack">
      <PageHeading title="Datasets" subtitle="Upload, inspect, and manage your source data." action={<button className="button primary" onClick={() => fileInputRef.current?.click()}><Upload />Upload dataset</button>} />
      <div className={`upload-zone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files[0]) handleFile(event.dataTransfer.files[0]); }}>
        <span className="upload-icon"><Upload /></span>
        <div><strong>Drop a dataset here</strong><p>CSV and JSON files are supported</p></div>
        <button className="button secondary" onClick={() => fileInputRef.current?.click()}>Browse files</button>
      </div>
      <section className="dataset-card-grid">
        {datasets.map((dataset) => (
          <article className="dataset-card panel" key={dataset.id}>
            <div className="dataset-card-head"><span className="dataset-icon"><FileSpreadsheet /></span><span className="status-dot">Ready</span></div>
            <h3>{dataset.name}</h3>
            <div className="dataset-stats"><span><strong>{dataset.schema.row_count.toLocaleString()}</strong><small>Rows</small></span><span><strong>{dataset.schema.column_count}</strong><small>Columns</small></span></div>
            <p>Added {dataset.uploadedAt.toLocaleDateString()}</p>
            <button className="button secondary full" onClick={() => { selectDataset(dataset); navigate('visualizations'); }}>Open dataset</button>
          </article>
        ))}
      </section>
      {pipeline && <section className="panel"><DataPreview rows={pipeline.cleanedRows} schema={schema} /></section>}
    </div>
  );

  const renderAI = () => (
    <div className="page-stack ai-page">
      <PageHeading title="AI Analysis" subtitle="Ask questions about your active dataset in natural language." />
      {aiNote && <div className="notice success"><Sparkles />{aiNote}</div>}
      <section className="panel ai-composer">
        <div className="dataset-context"><span className="dataset-icon"><FileSpreadsheet /></span><span><small>Selected dataset</small><strong>{activeDataset?.name || 'No dataset selected'}</strong></span></div>
        <form onSubmit={(event) => event.preventDefault()} className="ai-input-shell">
          <textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Ask anything about your dataset..." rows={4} />
          <button type="button" className="button primary" disabled={!aiPrompt.trim() || isLoading} onClick={() => { runNaturalLanguageQuery(aiPrompt); }}>
            {isLoading ? <span className="spinner" /> : <Sparkles />} {isLoading ? 'Analyzing' : 'Run analysis'}
          </button>
        </form>
        <div className="suggestions">
          {suggestions.map((suggestion) => <button key={suggestion} onClick={() => { setAiPrompt(suggestion); runNaturalLanguageQuery(suggestion); }}>{suggestion}</button>)}
        </div>
      </section>
      <section className="panel ai-result">
        <PanelHeader title="Analysis result" subtitle={queryResult ? `${queryResult.summary.total_groups || queryResult.summary.total_points || 0} result elements` : 'Run a query to generate a result'} />
        <ChartCanvas queryResult={queryResult} chartType={queryParams.chart_type} />
      </section>
    </div>
  );

  const renderWorkspace = (mode: 'visualizations' | 'query') => (
    <div className="page-stack">
      <PageHeading title={mode === 'visualizations' ? 'Visualizations' : 'Query Builder'} subtitle={mode === 'visualizations' ? 'Shape and export insights from your dataset.' : 'Build precise filters, groups, and aggregations.'} />
      <div className="workspace-grid">
        <section className="panel controls-panel">
          <QueryBuilder schema={schema} params={queryParams} onChangeParams={handleParamsChange} onExecuteNaturalQuery={runNaturalLanguageQuery} isLoading={isLoading} />
        </section>
        <section className="panel chart-panel">
          <ChartCanvas queryResult={queryResult} chartType={queryParams.chart_type} />
        </section>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="page-stack">
      <PageHeading title="Analysis History" subtitle="Review queries performed during this session." />
      <section className="panel history-list">
        {history.length === 0 ? (
          <div className="empty-state"><History /><h3>No analysis history</h3><p>Your completed AI queries will appear here.</p><button className="button primary" onClick={() => navigate('ai')}>Ask AI a question</button></div>
        ) : history.map((item) => (
          <div className="history-row" key={item.id}>
            <span className="activity-icon"><Sparkles /></span>
            <span className="history-copy"><strong>{item.prompt}</strong><small>{item.dataset} · {item.createdAt.toLocaleString()}</small></span>
            <button className="button secondary" onClick={() => { setQueryResult(item.result); navigate('visualizations'); }}>View result</button>
          </div>
        ))}
      </section>
    </div>
  );

  const renderSettings = () => (
    <div className="page-stack">
      <PageHeading title="Settings" subtitle="Application preferences and status." />
      <div className="settings-grid">
        <section className="panel settings-card"><PanelHeader title="Appearance" subtitle="Dashboard display preferences" /><div className="setting-row"><span><strong>Dark appearance</strong><small>Charcoal and navy theme</small></span><span className="toggle on"><i /></span></div></section>
        <section className="panel settings-card"><PanelHeader title="Data processing" subtitle="Local client pipeline status" /><div className="status-line"><span className="status-dot" />Processing engine connected</div><div className="status-line"><span className="status-dot" />CSV and JSON ingestion enabled</div></section>
        <section className="panel settings-card"><PanelHeader title="About" subtitle="Application information" /><div className="about-copy"><strong>AI Chart Builder</strong><p>Data analytics and visualization workspace</p><small>Version 1.0 · Chart.js + React</small></div></section>
      </div>
    </div>
  );

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><BarChart3 /></span><span className="brand-copy"><strong>AI Chart Builder</strong><small>Analytics workspace</small></span></div>
        <nav>
          <p className="nav-label">Workspace</p>
          {navigation.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)} title={collapsed ? item.label : undefined}><Icon /><span>{item.label}</span>{page === item.id && <i />}</button>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings /><span>Settings</span></button>
          <button className="nav-item" onClick={() => window.open('https://github.com/ajay-malhotra05/AI-Chart-Builder-Data-Analytics-Visualization-Tool', '_blank')}><CircleHelp /><span>Help & Support</span></button>
          <div className="profile"><span className="avatar">AM</span><span><strong>Local workspace</strong><small>Personal account</small></span></div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)}><Menu /></button>
            <button className="icon-button collapse-button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight /><strong>{pageTitles[page]}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="global-search"><Search /><input placeholder="Search workspace..." /></label>
            <button className="icon-button notification"><Bell /><i /></button>
            <button className="icon-button"><Moon /></button>
          </div>
        </header>

        <main>
          <input ref={fileInputRef} className="hidden" type="file" accept=".csv,.json" onChange={(event) => { if (event.target.files?.[0]) handleFile(event.target.files[0]); event.target.value = ''; }} />
          {error && <div className="notice error"><AlertCircle /><span>{error}</span><button onClick={() => setError(null)}><X /></button></div>}
          {page === 'overview' && renderOverview()}
          {page === 'datasets' && renderDatasets()}
          {page === 'ai' && renderAI()}
          {page === 'visualizations' && renderWorkspace('visualizations')}
          {page === 'query' && renderWorkspace('query')}
          {page === 'history' && renderHistory()}
          {page === 'settings' && renderSettings()}
        </main>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return <article className="metric-card panel"><span className={`metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article>;
}

function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <section className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</section>;
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
