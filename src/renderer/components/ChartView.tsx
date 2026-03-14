import React, { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartConfig } from '@shared/types';
import { Download, Maximize2 } from 'lucide-react';

// ─── Color Palette ───────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#36adf6', // forge blue
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

interface ChartViewProps {
  config: ChartConfig;
  data: Record<string, unknown>[];
}

export function ChartView({ config, data }: ChartViewProps) {
  const colors = config.colors?.length ? config.colors : CHART_COLORS;

  const chartData = useMemo(() => {
    return data.map(row => {
      const mapped: Record<string, unknown> = {};
      mapped[config.xAxis] = row[config.xAxis];
      for (const y of config.yAxis) {
        const val = row[y];
        mapped[y] = typeof val === 'number' ? val : Number(val) || 0;
      }
      return mapped;
    });
  }, [data, config]);

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--text-faint)' }}>
        No data to chart.
      </div>
    );
  }

  const showGrid = config.showGrid !== false;
  const showLegend = config.showLegend !== false && config.yAxis.length > 1;

  const tooltipStyle = {
    backgroundColor: 'var(--surface-2)',
    border: '1px solid var(--surface-4)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '12px',
  };

  const axisStyle = {
    fontSize: 11,
    fill: 'var(--text-muted)',
    fontFamily: '"DM Sans", sans-serif',
  };

  return (
    <div className="animate-in">
      {/* Chart header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
          {config.title}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => downloadChartAsCSV(config, data)}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--text-faint)' }}
            title="Download CSV"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Chart body */}
      <div style={{ backgroundColor: 'var(--surface-0)', border: '1px solid var(--surface-3)' }}
        className="rounded-xl p-4">
        <ResponsiveContainer width="100%" height={320}>
          {renderChart(config, chartData, colors, showGrid, showLegend, tooltipStyle, axisStyle)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Chart Renderers ─────────────────────────────────────────────────────────

function renderChart(
  config: ChartConfig,
  data: Record<string, unknown>[],
  colors: string[],
  showGrid: boolean,
  showLegend: boolean,
  tooltipStyle: React.CSSProperties,
  axisStyle: Record<string, unknown>,
): React.ReactElement {
  switch (config.type) {
    case 'bar':
    case 'horizontal_bar':
      return (
        <BarChart data={data} layout={config.type === 'horizontal_bar' ? 'vertical' : 'horizontal'}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />}
          {config.type === 'horizontal_bar' ? (
            <>
              <XAxis type="number" tick={axisStyle} />
              <YAxis dataKey={config.xAxis} type="category" tick={axisStyle} width={120} />
            </>
          ) : (
            <>
              <XAxis dataKey={config.xAxis} tick={axisStyle} />
              <YAxis tick={axisStyle} />
            </>
          )}
          <Tooltip contentStyle={tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {config.yAxis.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              fill={colors[i % colors.length]}
              radius={[4, 4, 0, 0]}
              stackId={config.stacked ? 'stack' : undefined}
            />
          ))}
        </BarChart>
      );

    case 'line':
      return (
        <LineChart data={data}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />}
          <XAxis dataKey={config.xAxis} tick={axisStyle} />
          <YAxis tick={axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {config.yAxis.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: colors[i % colors.length] }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      );

    case 'area':
      return (
        <AreaChart data={data}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />}
          <XAxis dataKey={config.xAxis} tick={axisStyle} />
          <YAxis tick={axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {config.yAxis.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.15}
              strokeWidth={2}
              stackId={config.stacked ? 'stack' : undefined}
            />
          ))}
        </AreaChart>
      );

    case 'pie':
      return (
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Pie
            data={data}
            dataKey={config.yAxis[0]}
            nameKey={config.xAxis}
            cx="50%"
            cy="50%"
            outerRadius={120}
            innerRadius={50}
            paddingAngle={2}
            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={{ stroke: 'var(--text-faint)' }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      );

    case 'scatter':
      return (
        <ScatterChart>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />}
          <XAxis dataKey={config.xAxis} name={config.xAxis} tick={axisStyle} />
          <YAxis dataKey={config.yAxis[0]} name={config.yAxis[0]} tick={axisStyle} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data} fill={colors[0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Scatter>
        </ScatterChart>
      );

    default:
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
          <XAxis dataKey={config.xAxis} tick={axisStyle} />
          <YAxis tick={axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          {config.yAxis.map((key, i) => (
            <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadChartAsCSV(config: ChartConfig, data: Record<string, unknown>[]) {
  const cols = [config.xAxis, ...config.yAxis];
  const header = cols.join(',');
  const rows = data.map(row => cols.map(c => {
    const v = row[c];
    const s = String(v ?? '');
    return s.includes(',') ? `"${s}"` : s;
  }).join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dbeer-chart-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
