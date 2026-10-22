import Papa from 'papaparse';
import { ChartPayload, ColumnMeta, DatasetSchema, QueryParams, QueryResult } from '../types';

export const COLOR_PALETTES = {
  indigo: {
    bg: [
      'rgba(99, 102, 241, 0.85)',
      'rgba(16, 185, 129, 0.85)',
      'rgba(245, 158, 11, 0.85)',
      'rgba(239, 68, 68, 0.85)',
      'rgba(139, 92, 246, 0.85)',
      'rgba(14, 165, 233, 0.85)',
      'rgba(236, 72, 153, 0.85)',
      'rgba(20, 184, 166, 0.85)',
      'rgba(249, 115, 22, 0.85)',
      'rgba(107, 114, 128, 0.85)',
    ],
    border: [
      'rgb(99, 102, 241)',
      'rgb(16, 185, 129)',
      'rgb(245, 158, 11)',
      'rgb(239, 68, 68)',
      'rgb(139, 92, 246)',
      'rgb(14, 165, 233)',
      'rgb(236, 72, 153)',
      'rgb(20, 184, 166)',
      'rgb(249, 115, 22)',
      'rgb(107, 114, 128)',
    ],
  },
  emerald: {
    bg: [
      'rgba(16, 185, 129, 0.85)',
      'rgba(5, 150, 105, 0.85)',
      'rgba(52, 211, 153, 0.85)',
      'rgba(110, 231, 183, 0.85)',
      'rgba(6, 95, 70, 0.85)',
      'rgba(45, 212, 191, 0.85)',
      'rgba(13, 148, 136, 0.85)',
      'rgba(14, 165, 233, 0.85)',
    ],
    border: [
      'rgb(16, 185, 129)',
      'rgb(5, 150, 105)',
      'rgb(52, 211, 153)',
      'rgb(110, 231, 183)',
      'rgb(6, 95, 70)',
      'rgb(45, 212, 191)',
      'rgb(13, 148, 136)',
      'rgb(14, 165, 233)',
    ],
  },
  amber: {
    bg: [
      'rgba(245, 158, 11, 0.85)',
      'rgba(249, 115, 22, 0.85)',
      'rgba(239, 68, 68, 0.85)',
      'rgba(251, 191, 36, 0.85)',
      'rgba(217, 119, 6, 0.85)',
      'rgba(234, 88, 12, 0.85)',
      'rgba(225, 29, 72, 0.85)',
    ],
    border: [
      'rgb(245, 158, 11)',
      'rgb(249, 115, 22)',
      'rgb(239, 68, 68)',
      'rgb(251, 191, 36)',
      'rgb(217, 119, 6)',
      'rgb(234, 88, 12)',
      'rgb(225, 29, 72)',
    ],
  },
  cyberpunk: {
    bg: [
      'rgba(236, 72, 153, 0.85)',
      'rgba(168, 85, 247, 0.85)',
      'rgba(6, 182, 212, 0.85)',
      'rgba(234, 179, 8, 0.85)',
      'rgba(139, 92, 246, 0.85)',
      'rgba(244, 63, 94, 0.85)',
      'rgba(16, 185, 129, 0.85)',
    ],
    border: [
      'rgb(236, 72, 153)',
      'rgb(168, 85, 247)',
      'rgb(6, 182, 212)',
      'rgb(234, 179, 8)',
      'rgb(139, 92, 246)',
      'rgb(244, 63, 94)',
      'rgb(16, 185, 129)',
    ],
  },
  monochrome: {
    bg: [
      'rgba(30, 41, 59, 0.85)',
      'rgba(51, 65, 85, 0.85)',
      'rgba(71, 85, 105, 0.85)',
      'rgba(100, 116, 139, 0.85)',
      'rgba(148, 163, 184, 0.85)',
      'rgba(203, 213, 225, 0.85)',
    ],
    border: [
      'rgb(15, 23, 42)',
      'rgb(30, 41, 59)',
      'rgb(51, 65, 85)',
      'rgb(71, 85, 105)',
      'rgb(100, 116, 139)',
      'rgb(148, 163, 184)',
    ],
  },
};

const isDateValue = (value: string): boolean => {
  const trimmed = value.trim();
  const hasDateFormat =
    /^\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?(?:[T\s].*)?$/.test(trimmed) ||
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s.*)?$/.test(trimmed) ||
    /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(trimmed) ||
    /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(trimmed);

  return hasDateFormat && !Number.isNaN(Date.parse(trimmed));
};

export const getDefaultGroupColumn = (columns: ColumnMeta[], rowCount: number): ColumnMeta | undefined => {
  const candidates = [
    ...columns.filter((column) => column.type === 'categorical'),
    ...columns.filter((column) => column.type === 'datetime'),
  ];
  const isIdentifier = (column: ColumnMeta) => /(?:^|[_\s-])(id|uuid|key|number)(?:$|[_\s-])/i.test(column.name);
  const nonIdentifiers = candidates.filter((column) => !isIdentifier(column));
  const populated = nonIdentifiers.filter((column) => column.null_count === 0);
  const preferred = populated.length > 0 ? populated : nonIdentifiers;

  return preferred.find((column) => column.unique_count < rowCount)
    || preferred[0]
    || candidates[0]
    || columns[0];
};

export class ClientDataPipeline {
  rawRows: Record<string, any>[] = [];
  cleanedRows: Record<string, any>[] = [];
  schema: DatasetSchema | null = null;

  static parseCSV(text: string): ClientDataPipeline {
    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (parseResult.errors.length > 0) {
      throw new Error(`Unable to parse CSV: ${parseResult.errors[0].message}`);
    }

    const pipeline = new ClientDataPipeline();
    pipeline.rawRows = parseResult.data as Record<string, any>[];
    pipeline.clean();
    return pipeline;
  }

  static parseJSON(text: string): ClientDataPipeline {
    const parsedData: unknown = JSON.parse(text);
    let rows: unknown[];

    if (Array.isArray(parsedData)) {
      rows = parsedData;
    } else if (parsedData !== null && typeof parsedData === 'object') {
      const dataObject = parsedData as Record<string, unknown>;
      const candidateKeys = ['data', 'records', 'items', 'rows', 'results'];
      const nestedRows = candidateKeys
        .map((key) => dataObject[key])
        .find((value): value is unknown[] => Array.isArray(value));
      rows = nestedRows ?? [parsedData];
    } else {
      throw new Error('JSON data must be an array of records or an object containing records.');
    }

    if (!rows.every((row): row is Record<string, any> => row !== null && typeof row === 'object' && !Array.isArray(row))) {
      throw new Error('JSON records must all be objects.');
    }

    const pipeline = new ClientDataPipeline();
    pipeline.rawRows = rows;
    pipeline.clean();
    return pipeline;
  }

  clean(): void {
    if (!this.rawRows || this.rawRows.length === 0) {
      this.cleanedRows = [];
      this.schema = {
        row_count: 0,
        column_count: 0,
        columns: [],
        cleaning_report: {
          initial_rows: 0,
          final_rows: 0,
          duplicates_removed: 0,
          columns: [],
          type_conversions: {},
          missing_values: {},
        },
      };
      return;
    }

    const initialCount = this.rawRows.length;
    // 1. Normalize Column Names
    const rawKeys = Array.from(new Set(this.rawRows.flatMap((row) => Object.keys(row || {}))));
    const keyMap: Record<string, string> = {};
    for (const k of rawKeys) {
      keyMap[k] = k.trim().replace(/\s+/g, ' ');
    }

    // 2. Normalize and Deduplicate rows
    const seen = new Set<string>();
    const tempRows: Record<string, any>[] = [];

    for (const rawRow of this.rawRows) {
      const cleanRow: Record<string, any> = {};
      for (const [oldK, newK] of Object.entries(keyMap)) {
        cleanRow[newK] = rawRow[oldK];
      }
      const strRep = JSON.stringify(cleanRow);
      if (!seen.has(strRep)) {
        seen.add(strRep);
        tempRows.push(cleanRow);
      }
    }

    const finalCount = tempRows.length;
    const duplicatesRemoved = initialCount - finalCount;

    // 3. Type inference & sanitization
    const cols = Object.values(keyMap);
    const typeConversions: Record<string, string> = {};
    const missingCounts: Record<string, number> = {};

    for (const col of cols) {
      let nullCount = 0;
      let numericHits = 0;
      let dateHits = 0;
      let totalNonEmpty = 0;

      // Sample first 100
      const sample = tempRows.slice(0, 100);
      for (const r of sample) {
        let val = r[col];
        if (val === undefined || val === null || val === '' || String(val).toLowerCase() === 'nan' || String(val).toLowerCase() === 'null') {
          continue;
        }
        totalNonEmpty++;
        const sVal = String(val).trim();
        // check numeric
        const stripped = sVal.replace(/[\$,]/g, '').replace(/%$/, '');
        if (!isNaN(Number(stripped)) && stripped !== '') {
          numericHits++;
        }
        // check date
        if (isDateValue(sVal)) {
          dateHits++;
        }
      }

      const isNumeric = totalNonEmpty > 0 && numericHits / totalNonEmpty > 0.8;
      const isDate = !isNumeric && totalNonEmpty > 0 && dateHits / totalNonEmpty > 0.8;

      typeConversions[col] = isNumeric ? 'numeric' : isDate ? 'datetime' : 'categorical';

      // Transform rows
      for (const r of tempRows) {
        let val = r[col];
        if (val === undefined || val === null || val === '' || String(val).toLowerCase() === 'nan' || String(val).toLowerCase() === 'null' || String(val).trim() === '-') {
          r[col] = null;
          nullCount++;
        } else if (isNumeric) {
          const stripped = String(val).replace(/[\$,]/g, '').replace(/%$/, '');
          const n = Number(stripped);
          r[col] = isNaN(n) ? null : n;
          if (r[col] === null) nullCount++;
        } else if (typeof val === 'string') {
          r[col] = val.trim();
        }
      }
      missingCounts[col] = nullCount;
    }

    this.cleanedRows = tempRows;

    // Build Schema
    const columnsMeta = cols.map((col) => {
      const type = (typeConversions[col] as 'numeric' | 'categorical' | 'datetime') || 'categorical';
      const nonNulls = this.cleanedRows.map((r) => r[col]).filter((v) => v !== null && v !== undefined);
      const uniqueVals = Array.from(new Set(nonNulls));

      let stats = undefined;
      if (type === 'numeric') {
        const nums = nonNulls as number[];
        if (nums.length > 0) {
          nums.sort((a, b) => a - b);
          const min = nums[0];
          const max = nums[nums.length - 1];
          const sum = nums.reduce((a, b) => a + b, 0);
          const mean = sum / nums.length;
          const mid = Math.floor(nums.length / 2);
          const median = nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
          stats = {
            min: Math.round(min * 100) / 100,
            max: Math.round(max * 100) / 100,
            mean: Math.round(mean * 100) / 100,
            median: Math.round(median * 100) / 100,
          };
        }
      }

      return {
        name: col,
        type,
        raw_type: typeof (nonNulls[0] ?? 'string'),
        null_count: missingCounts[col] || 0,
        unique_count: uniqueVals.length,
        sample_values: uniqueVals.slice(0, 5),
        stats,
      };
    });

    this.schema = {
      row_count: this.cleanedRows.length,
      column_count: cols.length,
      columns: columnsMeta,
      cleaning_report: {
        initial_rows: initialCount,
        final_rows: finalCount,
        duplicates_removed: duplicatesRemoved,
        columns: cols,
        type_conversions: typeConversions,
        missing_values: missingCounts,
      },
    };
  }

  transform(params: QueryParams): QueryResult {
    const { group_by, target_column, metric, top_n, sort_order, chart_type, palette } = params;

    if (!this.cleanedRows || this.cleanedRows.length === 0) {
      throw new Error('Dataset is empty');
    }

    const paletteColors = COLOR_PALETTES[palette] || COLOR_PALETTES.indigo;

    // Scatter plot handling
    if (chart_type === 'scatter') {
      const xCol = group_by;
      const yCol = target_column;
      if (!xCol || !yCol) {
        throw new Error('Scatter chart requires both an X column and a Y column');
      }

      const points = this.cleanedRows
        .filter((r) => r[xCol] !== null && r[yCol] !== null && typeof r[xCol] === 'number' && typeof r[yCol] === 'number')
        .map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol]) }));

      const chart: ChartPayload = {
        datasets: [
          {
            label: `${yCol} vs ${xCol}`,
            data: points,
            backgroundColor: paletteColors.bg[0],
            borderColor: paletteColors.border[0],
            pointRadius: 6,
            pointHoverRadius: 8,
          },
        ],
      };

      return {
        chart,
        summary: {
          total_points: points.length,
          x_column: xCol,
          y_column: yCol,
          chart_type: 'scatter',
        },
      };
    }

    // Grouping & Aggregation
    const groups = new Map<string, Array<number | string>>();

    for (const row of this.cleanedRows) {
      const gVal = row[group_by] !== null && row[group_by] !== undefined ? String(row[group_by]) : '(Blank)';
      if (!groups.has(gVal)) {
        groups.set(gVal, []);
      }

      if (metric === 'count') {
        groups.get(gVal)!.push(1);
      } else if (metric === 'nunique') {
        const val = target_column ? row[target_column] : row[group_by];
        if (val !== null && val !== undefined) {
          groups.get(gVal)!.push(val);
        }
      } else {
        if (target_column && typeof row[target_column] === 'number') {
          groups.get(gVal)!.push(row[target_column]);
        }
      }
    }

    const aggregated: { label: string; value: number }[] = [];

    for (const [lbl, vals] of groups.entries()) {
      let computed = 0;
      if (metric === 'count') {
        computed = vals.length;
      } else if (metric === 'nunique') {
        computed = new Set(vals).size;
      } else if (vals.length === 0) {
        computed = 0;
      } else {
        const numericValues = vals.filter((value): value is number => typeof value === 'number');
        if (metric === 'sum') {
          computed = numericValues.reduce((a, b) => a + b, 0);
        } else if (metric === 'mean') {
          computed = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
        } else if (metric === 'median') {
          numericValues.sort((a, b) => a - b);
          const mid = Math.floor(numericValues.length / 2);
          computed = numericValues.length % 2 !== 0 ? numericValues[mid] : (numericValues[mid - 1] + numericValues[mid]) / 2;
        } else if (metric === 'min') {
          computed = Math.min(...numericValues);
        } else if (metric === 'max') {
          computed = Math.max(...numericValues);
        }
      }
      aggregated.push({ label: lbl, value: Math.round(computed * 100) / 100 });
    }

    // Sort
    if (sort_order === 'desc') {
      aggregated.sort((a, b) => b.value - a.value);
    } else {
      aggregated.sort((a, b) => a.value - b.value);
    }

    // Top N
    const totalGroups = aggregated.length;
    let finalItems = aggregated;
    if (top_n && top_n > 0 && aggregated.length > top_n) {
      const topItems = aggregated.slice(0, top_n);
      const remaining = aggregated.slice(top_n);
      const otherValues = remaining.flatMap((item) => groups.get(item.label) || []);
      const numericOtherValues = otherValues.filter((value): value is number => typeof value === 'number');
      let otherVal = 0;
      if (metric === 'count') {
        otherVal = otherValues.length;
      } else if (metric === 'nunique') {
        otherVal = new Set(otherValues).size;
      } else if (numericOtherValues.length > 0) {
        if (metric === 'sum') {
          otherVal = numericOtherValues.reduce((sum, value) => sum + value, 0);
        } else if (metric === 'mean') {
          otherVal = numericOtherValues.reduce((sum, value) => sum + value, 0) / numericOtherValues.length;
        } else if (metric === 'median') {
          numericOtherValues.sort((a, b) => a - b);
          const mid = Math.floor(numericOtherValues.length / 2);
          otherVal = numericOtherValues.length % 2 !== 0
            ? numericOtherValues[mid]
            : (numericOtherValues[mid - 1] + numericOtherValues[mid]) / 2;
        } else if (metric === 'min') {
          otherVal = Math.min(...numericOtherValues);
        } else if (metric === 'max') {
          otherVal = Math.max(...numericOtherValues);
        }
      }

      topItems.push({ label: 'Other', value: Math.round(otherVal * 100) / 100 });
      finalItems = topItems;
    }

    const labels = finalItems.map((item) => item.label);
    const dataVals = finalItems.map((item) => item.value);

    // Color palettes
    const bgList = labels.map((_, i) => paletteColors.bg[i % paletteColors.bg.length]);
    const borderList = labels.map((_, i) => paletteColors.border[i % paletteColors.border.length]);

    let datasetConfig: any = {
      label: metric === 'count' ? `Count of Records` : `${metric.toUpperCase()} of ${target_column}`,
      data: dataVals,
      backgroundColor: bgList,
      borderColor: borderList,
      borderWidth: 1.5,
      borderRadius: 6,
    };

    if (chart_type === 'line') {
      datasetConfig = {
        label: metric === 'count' ? `Count of Records` : `${metric.toUpperCase()} of ${target_column}`,
        data: dataVals,
        borderColor: paletteColors.border[0],
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    } else if (chart_type === 'doughnut' || chart_type === 'pie' || chart_type === 'polarArea') {
      datasetConfig.borderColor = '#ffffff';
      datasetConfig.borderWidth = 2;
    }

    const chart: ChartPayload = {
      labels,
      datasets: [datasetConfig],
    };

    const cleanNumbers = dataVals.filter((v) => !isNaN(v));
    const aggSum = cleanNumbers.reduce((a, b) => a + b, 0);
    const aggMean = cleanNumbers.length > 0 ? aggSum / cleanNumbers.length : 0;

    return {
      chart,
      summary: {
        group_by,
        target_column,
        metric,
        total_groups: totalGroups,
        top_category: finalItems[0]?.label || null,
        top_value: finalItems[0]?.value ?? null,
        aggregate_sum: Math.round(aggSum * 100) / 100,
        aggregate_mean: Math.round(aggMean * 100) / 100,
        chart_type,
      },
    };
  }
}
