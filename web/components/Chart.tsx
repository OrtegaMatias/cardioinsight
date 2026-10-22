'use client';

import dynamic from 'next/dynamic';
import type { Data, Layout } from 'plotly.js';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export default function Chart({ title, description, traces, xTitle, yTitle, height = 390, layout = {} }: {
  title: string; description: string; traces: Data[]; xTitle?: string; yTitle?: string;
  height?: number; layout?: Partial<Layout>;
}) {
  return <div className="chart" role="img" aria-label={`${title}. ${description}`}>
    <Plot
      data={traces}
      layout={{
        title: { text: title, font: { color: '#0c2c4a', size: 17 } },
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Avenir Next, Arial, sans-serif', color: '#5d6e7b', size: 12 },
        margin: { l: 60, r: 25, t: 68, b: 65 },
        xaxis: { title: { text: xTitle }, gridcolor: '#e8edf3', zeroline: false },
        yaxis: { title: { text: yTitle }, gridcolor: '#e8edf3', zeroline: false },
        legend: { orientation: 'h', y: 1.12, x: 0 },
        hovermode: 'closest', autosize: true, height,
        ...layout,
      }}
      config={{ responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] }}
      useResizeHandler
      style={{ width: '100%', height }}
    />
    <p className="chart-caption">{description} Los valores exactos se presentan en la tabla o indicadores adyacentes. Usa el gráfico para acercar y explorar puntos con el cursor.</p>
  </div>;
}
