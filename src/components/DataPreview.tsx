import React, { useState } from 'react';
import { DatasetSchema } from '../types';
import { Table, CheckCircle2, Search, ChevronLeft, ChevronRight, Hash, Calendar, Type } from 'lucide-react';

interface DataPreviewProps {
  rows: Record<string, any>[];
  schema: DatasetSchema | null;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ rows, schema }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  if (!schema || rows.length === 0) {
    return null;
  }

  const { cleaning_report } = schema;

  // Filter rows by search term
  const filteredRows = rows.filter((r) => {
    if (!searchTerm.trim()) return true;
    return Object.values(r).some((val) =>
      String(val ?? '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'numeric':
        return <Hash className="w-3 h-3 text-emerald-500" />;
      case 'datetime':
        return <Calendar className="w-3 h-3 text-amber-500" />;
      default:
        return <Type className="w-3 h-3 text-indigo-500" />;
    }
  };

  return (
    <div className="flex flex-col gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
      {/* Cleaning Report Badge Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Pipeline Sanitization Report</h3>
            <p className="text-xs text-slate-500">
              Cleaned & normalized via Pandas ingestion pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
            Rows: <strong>{schema.row_count}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
            Columns: <strong>{schema.column_count}</strong>
          </span>
          {cleaning_report.duplicates_removed > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
              Duplicates purged: <strong>{cleaning_report.duplicates_removed}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Column Schema Badges */}
      <div className="flex flex-wrap gap-2">
        {schema.columns.map((col) => (
          <div
            key={col.name}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs"
          >
            {getTypeIcon(col.type)}
            <span className="font-semibold text-slate-700">{col.name}</span>
            <span className="text-[10px] text-slate-400 capitalize">({col.type})</span>
            {col.null_count > 0 && (
              <span className="text-[10px] text-rose-500">({col.null_count} nulls)</span>
            )}
          </div>
        ))}
      </div>

      {/* Search and Table Navigation */}
      <div className="flex items-center justify-between gap-4 mt-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search dataset rows..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>
            Page {currentPage} of {totalPages} ({filteredRows.length} rows)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabular View */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
              <th className="py-2.5 px-3 w-12 text-center text-slate-400 font-mono">#</th>
              {schema.columns.map((col) => (
                <th key={col.name} className="py-2.5 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {getTypeIcon(col.type)}
                    <span>{col.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {paginatedRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                <td className="py-2 px-3 text-center text-slate-400">
                  {(currentPage - 1) * pageSize + idx + 1}
                </td>
                {schema.columns.map((col) => {
                  const val = row[col.name];
                  const isNull = val === null || val === undefined;
                  return (
                    <td key={col.name} className="py-2 px-3 whitespace-nowrap text-slate-700">
                      {isNull ? (
                        <span className="text-slate-300 italic">null</span>
                      ) : typeof val === 'number' ? (
                        val.toLocaleString()
                      ) : (
                        String(val)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
