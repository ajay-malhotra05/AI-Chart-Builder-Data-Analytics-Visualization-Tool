/**
 * AI Chart Builder - Frontend JavaScript Application
 * Interacts with FastAPI backend endpoints: /api/upload, /api/query, /api/ai-query
 */

// Application State
const state = {
  apiBase: 'http://localhost:8000',
  datasetId: null,
  schema: null,
  chartInstance: null,
  activeChartType: 'bar',
  activeSortOrder: 'desc'
};

// DOM References
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-upload');
const selectGroupBy = document.getElementById('select-group-by');
const selectTargetColumn = document.getElementById('select-target-column');
const selectMetric = document.getElementById('select-metric');
const selectTopN = document.getElementById('select-top-n');
const runQueryBtn = document.getElementById('run-query-btn');
const aiPromptInput = document.getElementById('ai-prompt-input');
const aiQueryBtn = document.getElementById('ai-query-btn');
const sortDescBtn = document.getElementById('sort-desc-btn');
const sortAscBtn = document.getElementById('sort-asc-btn');
const chartCanvas = document.getElementById('main-chart');
const chartHeading = document.getElementById('chart-heading');
const chartSubheading = document.getElementById('chart-subheading');
const exportBtn = document.getElementById('export-chart-btn');
const statusBanner = document.getElementById('status-banner');
const statusMessage = document.getElementById('status-message');
const closeStatus = document.getElementById('close-status');
const datasetFilename = document.getElementById('dataset-filename');
const datasetStats = document.getElementById('dataset-stats');
const previewThead = document.getElementById('preview-thead');
const previewTbody = document.getElementById('preview-tbody');
const loadSampleBtn = document.getElementById('load-sample-btn');

// Sample dataset in case backend is offline or for instant mock test
const sampleCSV = `order_id,category,region,sales,profit
ORD-1,Technology,North,1250,320
ORD-2,Furniture,South,420,65
ORD-3,Office Supplies,West,85,28
ORD-4,Technology,East,2100,540
ORD-5,Furniture,North,890,-45
ORD-6,Office Supplies,South,64,22
ORD-7,Technology,East,310,95
ORD-8,Furniture,West,620,110
ORD-9,Technology,South,1580,410
ORD-10,Office Supplies,North,340,78`;

// Helper: Show Banner Alert
function showAlert(message, type = 'error') {
  statusBanner.className = type === 'error'
    ? 'rounded-xl p-3 text-xs flex items-center justify-between bg-rose-50 border border-rose-200 text-rose-800'
    : 'rounded-xl p-3 text-xs flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800';
  statusMessage.textContent = message;
  statusBanner.classList.remove('hidden');
}

closeStatus.addEventListener('click', () => {
  statusBanner.classList.add('hidden');
});

// Event Listeners for Controls
document.querySelectorAll('.chart-type-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeChartType = btn.dataset.type;
    executeQuery();
  });
});

sortDescBtn.addEventListener('click', () => {
  sortDescBtn.classList.add('active');
  sortAscBtn.classList.remove('active');
  state.activeSortOrder = 'desc';
  executeQuery();
});

sortAscBtn.addEventListener('click', () => {
  sortAscBtn.classList.add('active');
  sortDescBtn.classList.remove('active');
  state.activeSortOrder = 'asc';
  executeQuery();
});

selectMetric.addEventListener('change', () => {
  const isCount = selectMetric.value === 'count';
  document.getElementById('target-col-container').style.display = isCount ? 'none' : 'block';
  executeQuery();
});

selectGroupBy.addEventListener('change', () => executeQuery());
selectTargetColumn.addEventListener('change', () => executeQuery());
selectTopN.addEventListener('change', () => executeQuery());
runQueryBtn.addEventListener('click', () => executeQuery());

// File Upload Handling
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    uploadFile(e.target.files[0]);
  }
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('border-indigo-500', 'bg-indigo-50/50');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/50');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/50');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    uploadFile(e.dataTransfer.files[0]);
  }
});

loadSampleBtn.addEventListener('click', () => {
  const blob = new Blob([sampleCSV], { type: 'text/csv' });
  const file = new File([blob], 'sample_sales.csv', { type: 'text/csv' });
  uploadFile(file);
});

// Upload API Call
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    showAlert('Uploading and sanitizing dataset with Pandas pipeline...', 'info');
    const res = await fetch(`${state.apiBase}/api/upload`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Upload failed');
    }

    const data = await res.json();
    state.datasetId = data.dataset_id;
    state.schema = data.schema;

    datasetFilename.textContent = data.filename;
    datasetStats.textContent = `${data.row_count} rows • ${data.column_count} columns • ${data.cleaning_report.duplicates_removed} duplicates removed`;

    populateDropdowns(data.schema);
    renderTablePreview(data.schema.columns, data.preview_data);
    showAlert(`Successfully ingested "${data.filename}"`, 'success');

    // Auto trigger initial query
    executeQuery();
  } catch (err) {
    showAlert(`Backend connection notice: ${err.message}. (Ensure uvicorn app:app is running).`);
  }
}

// Populate Control Dropdowns
function populateDropdowns(schema) {
  selectGroupBy.innerHTML = '';
  selectTargetColumn.innerHTML = '';

  schema.columns.forEach(col => {
    const optGroup = document.createElement('option');
    optGroup.value = col.name;
    optGroup.textContent = `${col.name} (${col.type})`;
    selectGroupBy.appendChild(optGroup);

    if (col.type === 'numeric') {
      const optTarget = document.createElement('option');
      optTarget.value = col.name;
      optTarget.textContent = `${col.name} (numeric)`;
      selectTargetColumn.appendChild(optTarget);
    }
  });
}

// Render Preview Table
function renderTablePreview(columns, rows) {
  previewThead.innerHTML = `
    <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
      <th class="p-2 w-10 text-center">#</th>
      ${columns.map(c => `<th class="p-2 whitespace-nowrap">${c.name}</th>`).join('')}
    </tr>
  `;

  previewTbody.innerHTML = rows.map((row, idx) => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="p-2 text-center text-slate-400">${idx + 1}</td>
      ${columns.map(c => `<td class="p-2 whitespace-nowrap">${row[c.name] ?? '-'}</td>`).join('')}
    </tr>
  `).join('');
}

// Execute Query API Call
async function executeQuery() {
  if (!state.datasetId) return;

  const payload = {
    dataset_id: state.datasetId,
    group_by: selectGroupBy.value,
    target_column: selectTargetColumn.value || undefined,
    metric: selectMetric.value,
    top_n: parseInt(selectTopN.value, 10),
    sort_order: state.activeSortOrder,
    chart_type: state.activeChartType
  };

  try {
    const res = await fetch(`${state.apiBase}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Query execution failed');
    }

    const data = await res.json();
    renderChart(data.chart, data.summary);
  } catch (err) {
    showAlert(err.message);
  }
}

// Natural Language AI Query
aiQueryBtn.addEventListener('click', async () => {
  const prompt = aiPromptInput.value.trim();
  if (!prompt || !state.datasetId) return;

  try {
    showAlert('Interpreting natural language query...', 'info');
    const res = await fetch(`${state.apiBase}/api/ai-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: state.datasetId, prompt })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'AI query failed');
    }

    const data = await res.json();
    renderChart(data.chart, data.summary);
    if (data.ai_interpretation) {
      showAlert(`Interpreted: ${data.ai_interpretation.selected_metric.toUpperCase()} of ${data.ai_interpretation.selected_target_column || 'Rows'} grouped by "${data.ai_interpretation.selected_group_by}"`, 'success');
    }
  } catch (err) {
    showAlert(err.message);
  }
});

// Render Dynamic Chart.js
function renderChart(chartPayload, summary) {
  if (state.chartInstance) {
    state.chartInstance.destroy();
    state.chartInstance = null;
  }

  chartHeading.textContent = `${summary.metric ? summary.metric.toUpperCase() : 'VISUALIZATION'} OF ${summary.target_column || 'RECORDS'} BY ${summary.group_by}`;
  chartSubheading.textContent = `Top Category: ${summary.top_category || 'N/A'} • Total: ${summary.aggregate_sum?.toLocaleString() || 'N/A'}`;

  const ctx = chartCanvas.getContext('2d');
  state.chartInstance = new Chart(ctx, {
    type: state.activeChartType,
    data: {
      labels: chartPayload.labels || [],
      datasets: chartPayload.datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: ['doughnut', 'pie'].includes(state.activeChartType)
        }
      }
    }
  });
}

// Export Chart Image
exportBtn.addEventListener('click', () => {
  if (!chartCanvas) return;
  const link = document.createElement('a');
  link.download = `chart-${Date.now()}.png`;
  link.href = chartCanvas.toDataURL('image/png', 1.0);
  link.click();
});
