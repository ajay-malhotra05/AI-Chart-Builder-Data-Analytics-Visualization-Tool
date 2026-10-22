import React, { useState } from 'react';
import { Copy, Check, Terminal, FileCode2, FolderTree, Code } from 'lucide-react';

interface CodeInspectorProps {
  onClose?: () => void;
}

export const CodeInspector: React.FC<CodeInspectorProps> = () => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'app' | 'tree' | 'curl'>('pipeline');
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const fileTree = `ai-chart-builder/
├── pipeline.py            # Robust Pandas Ingestion, Sanitization & Chart.js Formatter
├── app.py                 # FastAPI Application with Upload, Query & AI endpoints
├── requirements.txt       # Dependencies (fastapi, pandas, uvicorn, pydantic)
├── sample_data/
│   ├── sales_revenue.csv  # Sample E-Commerce transactional dataset
│   └── tech_salaries.json # Sample Engineering compensation JSON
├── frontend/
│   ├── index.html         # Analytics dashboard canvas & controls
│   ├── styles.css         # Styling & responsive layout
│   └── app.js             # Chart.js lifecycle management & state
└── README.md              # Architectural documentation`;

  const curlExample = `# 1. Install dependencies & run backend
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# 2. Upload dataset (CSV or JSON)
curl -X POST "http://localhost:8000/api/upload" \\
  -F "file=@sample_data/sales_revenue.csv"

# Response returns: { "dataset_id": "...", "schema": {...}, "preview_data": [...] }

# 3. Query dataset with structured parameters
curl -X POST "http://localhost:8000/api/query" \\
  -H "Content-Type: application/json" \\
  -d '{
    "dataset_id": "<YOUR_DATASET_ID>",
    "target_column": "sales",
    "group_by": "category",
    "metric": "sum",
    "top_n": 10,
    "sort_order": "desc",
    "chart_type": "bar"
  }'

# 4. Natural language query
curl -X POST "http://localhost:8000/api/ai-query" \\
  -H "Content-Type: application/json" \\
  -d '{
    "dataset_id": "<YOUR_DATASET_ID>",
    "prompt": "Show total sales by category sorted by highest"
  }'`;

  return (
    <div className="flex flex-col bg-slate-900 rounded-2xl border border-slate-800 text-slate-200 overflow-hidden shadow-xl">
      {/* Tab Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Backend Python Architecture & Code
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'pipeline'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            pipeline.py
          </button>
          <button
            onClick={() => setActiveTab('app')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'app'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            app.py
          </button>
          <button
            onClick={() => setActiveTab('tree')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'tree'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            File Tree
          </button>
          <button
            onClick={() => setActiveTab('curl')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'curl'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            API & cURL
          </button>
        </div>
      </div>

      {/* Code Content Body */}
      <div className="p-6 relative">
        {activeTab === 'pipeline' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-mono">
                pipeline.py • Pandas Cleaning, Transformation & Chart.js OutputFormatter
              </span>
              <button
                onClick={() => copyToClipboard('cat /pipeline.py', 'pipeline')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {copied === 'pipeline' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'pipeline' ? 'Copied' : 'Copy Full File'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto max-h-[380px] leading-relaxed border border-slate-800/80">
{`# Sample snippet from /pipeline.py
class DataPipeline:
    @classmethod
    def from_csv_bytes(cls, content: bytes) -> "DataPipeline":
        # Sniff delimiter, resilient bad-lines skip & encoding fallback
        ...

    def clean(self) -> pd.DataFrame:
        # 1. Normalize column names (whitespace, special chars)
        # 2. Drop duplicates
        # 3. Currency / percentage string to numeric inference
        # 4. Datetime detection & null handling
        ...

    def transform_and_format(
        self,
        target_column: Optional[str] = None,
        group_by: Optional[str] = None,
        metric: str = "sum",
        top_n: Optional[int] = 10,
        sort_order: str = "desc",
        chart_type: str = "bar"
    ) -> Dict[str, Any]:
        # Dynamic group_by, agg metric, sorting & OutputFormatter
        ...`}
            </pre>
          </div>
        )}

        {activeTab === 'app' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-mono">
                app.py • FastAPI REST Endpoints (/api/upload, /api/query, /api/ai-query)
              </span>
              <button
                onClick={() => copyToClipboard('cat /app.py', 'app')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {copied === 'app' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'app' ? 'Copied' : 'Copy Full File'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto max-h-[380px] leading-relaxed border border-slate-800/80">
{`# Sample snippet from /app.py
@app.post("/api/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    # Ingests, sanitizes via DataPipeline, caches dataset in-memory
    ...

@app.post("/api/query")
def execute_query(payload: QueryRequest):
    # Runs Pandas aggregation & returns Chart.js payload + summary
    ...

@app.post("/api/ai-query")
def execute_ai_query(payload: NaturalLanguageQueryRequest):
    # Translates natural language prompt into dynamic pipeline parameters
    ...`}
            </pre>
          </div>
        )}

        {activeTab === 'tree' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-mono">
                Full-Stack Architecture File Structure
              </span>
              <button
                onClick={() => copyToClipboard(fileTree, 'tree')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {copied === 'tree' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'tree' ? 'Copied' : 'Copy Tree'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-indigo-300 overflow-x-auto max-h-[380px] leading-relaxed border border-slate-800/80">
              {fileTree}
            </pre>
          </div>
        )}

        {activeTab === 'curl' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-mono">
                CLI Startup & cURL API Testing Guide
              </span>
              <button
                onClick={() => copyToClipboard(curlExample, 'curl')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {copied === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'curl' ? 'Copied' : 'Copy Commands'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto max-h-[380px] leading-relaxed border border-slate-800/80">
              {curlExample}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
