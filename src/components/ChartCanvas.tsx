import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  registerables,
  ChartConfiguration,
} from 'chart.js';
import { ChartType, QueryResult } from '../types';
import { Download, Copy, Check, BarChart3 } from 'lucide-react';

// Register all Chart.js controllers, elements, scales, and plugins
ChartJS.register(...registerables);

interface ChartCanvasProps {
  queryResult: QueryResult | null;
  chartType: ChartType;
  title?: string;
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({ queryResult, chartType, title }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    if (!canvasRef.current || !queryResult || !queryResult.chart) {
      return;
    }

    // Safely destroy any previous instance to avoid canvas reuse bugs
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let mappedType: any = chartType;
    let indexAxis: 'x' | 'y' = 'x';

    if (chartType === 'horizontalBar') {
      mappedType = 'bar';
      indexAxis = 'y';
    }

    const isCircular = ['doughnut', 'pie', 'polarArea'].includes(mappedType);
    const isScatter = mappedType === 'scatter';

    const config: ChartConfiguration = {
      type: mappedType,
      data: {
        labels: queryResult.chart.labels || [],
        datasets: queryResult.chart.datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: indexAxis,
        animation: {
          duration: 650,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            display: isCircular || queryResult.chart.datasets.length > 1,
            position: isCircular ? 'right' : 'top',
            labels: {
              boxWidth: 14,
              boxHeight: 14,
              padding: 16,
              font: {
                family: 'system-ui, -apple-system, sans-serif',
                size: 12,
                weight: 500,
              },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            boxPadding: 6,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                if (isScatter) {
                  const pt = context.raw as { x: number; y: number };
                  return `${label}: (${pt.x}, ${pt.y})`;
                }
                const val = typeof context.raw === 'number' 
                  ? context.raw.toLocaleString() 
                  : context.raw;
                return ` ${label ? label + ': ' : ''}${val}`;
              },
            },
          },
        },
        scales: !isCircular && mappedType !== 'radar'
          ? {
              x: {
                grid: {
                  color: 'rgba(226, 232, 240, 0.6)',
                },
                ticks: {
                  font: { size: 11 },
                  maxRotation: 45,
                  minRotation: 0,
                },
              },
              y: {
                grid: {
                  color: 'rgba(226, 232, 240, 0.6)',
                },
                ticks: {
                  font: { size: 11 },
                },
                beginAtZero: true,
              },
            }
          : undefined,
      },
    };

    chartInstanceRef.current = new ChartJS(ctx, config);

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [queryResult, chartType]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `chart-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png', 1.0);
    link.click();
  };

  const handleCopyJSON = () => {
    if (!queryResult) return;
    navigator.clipboard.writeText(JSON.stringify(queryResult.chart, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!queryResult) {
    return (
      <div className="h-full min-h-[380px] flex flex-col items-center justify-center p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3 shadow-sm">
          <BarChart3 className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">No Chart Generated Yet</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-1">
          Select dimensions in the query panel or ask in natural language to construct interactive visualizations.
        </p>
      </div>
    );
  }

  const { summary } = queryResult;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header with Title and Actions */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {title || (summary.group_by ? `${summary.metric?.toUpperCase()} of ${summary.target_column || 'Records'} by ${summary.group_by}` : 'Visualization')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Rendered with dynamic Chart.js engine • {summary.total_groups || summary.total_points || 0} distinct elements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyJSON}
            title="Copy Chart.js JSON Specification"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied JSON' : 'Copy JSON'}
          </button>
          <button
            onClick={handleDownload}
            title="Download PNG Snapshot"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export PNG
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      {summary.group_by && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-3 bg-slate-50/80 border-b border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Top Category</span>
            <span className="font-semibold text-slate-800 text-sm truncate block mt-0.5" title={summary.top_category || 'N/A'}>
              {summary.top_category || 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Top Value</span>
            <span className="font-semibold text-indigo-600 text-sm block mt-0.5">
              {summary.top_value != null ? summary.top_value.toLocaleString() : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Total Aggregated</span>
            <span className="font-semibold text-slate-800 text-sm block mt-0.5">
              {summary.aggregate_sum != null ? summary.aggregate_sum.toLocaleString() : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Category Count</span>
            <span className="font-semibold text-slate-800 text-sm block mt-0.5">
              {summary.total_groups || 'N/A'}
            </span>
          </div>
        </div>
      )}

      {/* Chart Canvas Area */}
      <div className="relative flex-1 p-6 min-h-[360px] flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
};
