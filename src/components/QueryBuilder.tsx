import React, { useState } from 'react';
import { ChartType, DatasetSchema, MetricType, QueryParams } from '../types';
import { getDefaultGroupColumn } from '../utils/pipeline';
import {
  Sparkles,
  BarChart,
  LineChart,
  PieChart,
  CircleDot,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  ArrowDownWideNarrow,
  Palette,
  Layers,
} from 'lucide-react';

interface QueryBuilderProps {
  schema: DatasetSchema | null;
  params: QueryParams;
  onChangeParams: (newParams: QueryParams) => void;
  onExecuteNaturalQuery: (prompt: string) => void;
  isLoading: boolean;
}

export const QueryBuilder: React.FC<QueryBuilderProps> = ({
  schema,
  params,
  onChangeParams,
  onExecuteNaturalQuery,
  isLoading,
}) => {
  const [nlPrompt, setNlPrompt] = useState('');

  const numericCols = schema?.columns.filter((c) => c.type === 'numeric') || [];
  const allCols = schema?.columns || [];
  const dimensionCols = params.chart_type === 'scatter' ? numericCols : allCols;
  const suggestedGroup = getDefaultGroupColumn(allCols, schema?.row_count || 0)?.name || 'category';

  const chartOptions: { type: ChartType; label: string; icon: React.ReactNode }[] = [
    { type: 'bar', label: 'Bar', icon: <BarChart className="w-4 h-4" /> },
    { type: 'horizontalBar', label: 'H-Bar', icon: <BarChart className="w-4 h-4 rotate-90" /> },
    { type: 'line', label: 'Line', icon: <LineChart className="w-4 h-4" /> },
    { type: 'doughnut', label: 'Donut', icon: <CircleDot className="w-4 h-4" /> },
    { type: 'pie', label: 'Pie', icon: <PieChart className="w-4 h-4" /> },
    { type: 'scatter', label: 'Scatter', icon: <Radio className="w-4 h-4" /> },
    { type: 'polarArea', label: 'Polar', icon: <Layers className="w-4 h-4" /> },
  ];

  const samplePrompts = [
    `Total ${numericCols[0]?.name || 'value'} by ${suggestedGroup}`,
    `Average ${numericCols[0]?.name || 'value'} for top 5 ${suggestedGroup}`,
    `Distribution of records by ${suggestedGroup}`,
  ];

  const handleNlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlPrompt.trim() || isLoading) return;
    onExecuteNaturalQuery(nlPrompt);
  };

  const updateParam = <K extends keyof QueryParams>(key: K, value: QueryParams[K]) => {
    onChangeParams({
      ...params,
      [key]: value,
    });
  };

  const handleChartTypeChange = (chartType: ChartType) => {
    const updatedParams = { ...params, chart_type: chartType };

    if (chartType === 'scatter') {
      const xColumn = numericCols.some((column) => column.name === params.group_by)
        ? params.group_by
        : numericCols[0]?.name || '';
      updatedParams.group_by = xColumn;

      if (!numericCols.some((column) => column.name === params.target_column) || params.target_column === xColumn) {
        updatedParams.target_column = numericCols.find((column) => column.name !== xColumn)?.name || xColumn;
      }
    }

    onChangeParams(updatedParams);
  };

  return (
    <div className="flex flex-col gap-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      {/* Natural Language AI Section */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 rounded-md bg-indigo-600 text-white shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
            AI Natural Language Query
          </span>
        </div>

        <form onSubmit={handleNlSubmit} className="relative mt-2">
          <input
            type="text"
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            placeholder="e.g. Total sales by product category sorted descending..."
            className="w-full text-sm bg-white border border-slate-200 rounded-xl pl-3.5 pr-20 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition shadow-2xs"
          />
          <button
            type="submit"
            disabled={isLoading || !nlPrompt.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 shadow-2xs cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? 'Parsing...' : 'Ask AI'}
          </button>
        </form>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {samplePrompts.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setNlPrompt(p);
                onExecuteNaturalQuery(p);
              }}
              className="text-[11px] px-2.5 py-1 rounded-md bg-white border border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer text-left truncate max-w-full"
            >
              "{p}"
            </button>
          ))}
        </div>
      </div>

      {/* Visual Structured Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Structured Query Controls
          </h3>
          <span className="text-[11px] text-slate-400">Reactive Pipeline</span>
        </div>

        {/* Chart Type Selector Grid */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Chart Type</label>
          <div className="grid grid-cols-4 gap-1.5">
            {chartOptions.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleChartTypeChange(opt.type)}
                disabled={opt.type === 'scatter' && numericCols.length === 0}
                title={opt.type === 'scatter' && numericCols.length === 0 ? 'Scatter charts require a numeric column.' : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                  params.chart_type === opt.type
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {opt.icon}
                <span className="text-[11px]">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dimension (Group By) */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            {params.chart_type === 'scatter' ? 'X Axis Dimension (Numeric)' : 'Group By Dimension (Category / Date)'}
          </label>
          <div className="relative">
            <select
              value={params.group_by}
              onChange={(e) => updateParam('group_by', e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            >
              {dimensionCols.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Target Column (Metric Value) */}
        {params.metric !== 'count' && (
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              {params.chart_type === 'scatter' ? 'Y Axis Value (Numeric)' : 'Target Metric Column'}
            </label>
            <div className="relative">
              <select
                value={params.target_column || ''}
                onChange={(e) => updateParam('target_column', e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              >
                {numericCols.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} (Numeric)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Metric Aggregation Function */}
        {params.chart_type !== 'scatter' && (
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Aggregation Metric</label>
              <div className="relative">
                <select
                  value={params.metric}
                  onChange={(e) => updateParam('metric', e.target.value as MetricType)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                >
                  <option value="sum">Sum (Total)</option>
                  <option value="mean">Average (Mean)</option>
                  <option value="median">Median</option>
                  <option value="min">Minimum</option>
                  <option value="max">Maximum</option>
                  <option value="count">Count of Records</option>
                  <option value="nunique">Unique Values Count</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Top N Slicing</label>
              <div className="relative">
                <select
                  value={params.top_n}
                  onChange={(e) => updateParam('top_n', Number(e.target.value))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                >
                  <option value="5">Top 5 Items</option>
                  <option value="10">Top 10 Items</option>
                  <option value="15">Top 15 Items</option>
                  <option value="25">Top 25 Items</option>
                  <option value="0">All Items (No Limit)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {/* Sort and Theme Settings */}
        <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-100">
          <div>
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1">
              <ArrowDownWideNarrow className="w-3 h-3 text-slate-400" />
              Sort Order
            </label>
            <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => updateParam('sort_order', 'desc')}
                className={`flex-1 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  params.sort_order === 'desc' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                High to Low
              </button>
              <button
                type="button"
                onClick={() => updateParam('sort_order', 'asc')}
                className={`flex-1 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  params.sort_order === 'asc' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Low to High
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1">
              <Palette className="w-3 h-3 text-slate-400" />
              Palette
            </label>
            <div className="relative">
              <select
                value={params.palette}
                onChange={(e) => updateParam('palette', e.target.value as any)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              >
                <option value="indigo">Modern Indigo</option>
                <option value="emerald">Emerald Mint</option>
                <option value="amber">Warm Amber</option>
                <option value="cyberpunk">Cyber Neon</option>
                <option value="monochrome">Monochrome Slate</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
