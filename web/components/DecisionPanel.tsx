'use client';

import { useState } from 'react';
import Chart from './Chart';
import { cost, fixed, integer, money, percent, precision, recall, type Prepared } from '@/lib/analytics';
import type { Summary } from '@/lib/types';

type Props = {
  prepared: Prepared;
  summary: Summary;
  costFP: number;
  costFN: number;
  threshold: number;
  exploring: boolean;
  onExploring: (value: boolean) => void;
  onCostFP: (value: number) => void;
  onCostFN: (value: number) => void;
  onThreshold: (value: number) => void;
  onEvidence: () => void;
};

export default function DecisionPanel({ prepared, summary, costFP, costFN, threshold, exploring, onExploring, onCostFP, onCostFN, onThreshold, onEvidence }: Props) {
  const [showMobileControls, setShowMobileControls] = useState(false);
  const reference = prepared.counts(0.5);
  const selected = prepared.counts(threshold);
  const referenceCost = cost(reference, costFP, costFN);
  const selectedCost = cost(selected, costFP, costFN);
  const difference = referenceCost - selectedCost;
  const referrals = selected.fp + selected.vp;
  const series = prepared.curve.map(point => cost(point.counts, costFP, costFN));
  const chartLimit = Math.max(...series);
  const theoretical = costFP / (costFP + costFN);
  const originalCosts = costFP === summary.c_fp && costFN === summary.c_fn;

  return <section className="decision" aria-labelledby="decision-title">
    <header className="decision-heading">
      <div>
        <span className="eyebrow">CARDIOINSIGHT / TABLERO DE DECISIÓN</span>
        <h1 id="decision-title">Decisión de derivación</h1>
        <p>Compare escenarios de detección y costo. Resultados retrospectivos sobre test, no decisiones clínicas.</p>
      </div>
      <div className="decision-context"><span>BASE DE ANÁLISIS</span><strong>{integer(summary.n_test)} respuestas</strong><small>BRFSS 2015 · EE. UU. · F1 test {fixed(summary.mejor_f1_test)}</small></div>
    </header>

    <div className="decision-workspace">
      <button type="button" className="mobile-controls-toggle" aria-controls="decision-controls" aria-expanded={showMobileControls} onClick={() => setShowMobileControls(current => !current)}>
        <span><strong>Escenario · corte {fixed(threshold, 2)}</strong><small>FP {money(costFP)} · FN {money(costFN)}</small></span><span aria-hidden="true">{showMobileControls ? 'Cerrar −' : 'Ajustar +'}</span>
      </button>
      <aside id="decision-controls" className={showMobileControls ? 'decision-controls mobile-open' : 'decision-controls'} aria-label="Controles del escenario">
        <div className="controls-heading"><span className="eyebrow">AJUSTES DEL ESCENARIO</span><h2>Simulador</h2></div>
        <div className="policy-options" role="group" aria-label="Origen del umbral">
          <button type="button" className={!exploring ? 'policy-option selected' : 'policy-option'} aria-pressed={!exploring} onClick={() => { onExploring(false); onThreshold(summary.umbral_empirico); }}>
            <strong>Corte train/CV</strong><span>{fixed(summary.umbral_empirico, 2)} · resultado del experimento</span>
          </button>
          <button type="button" className={exploring ? 'policy-option selected' : 'policy-option'} aria-pressed={exploring} onClick={() => onExploring(true)}>
            <strong>Explorar corte</strong><span>Retrospectivo en test</span>
          </button>
        </div>
        <div className="range-control">
          <label htmlFor="decision-threshold">Umbral <strong>{fixed(threshold, 2)}</strong></label>
          <input id="decision-threshold" type="range" min={0} max={1} step={0.01} value={threshold} onChange={event => { onExploring(true); onThreshold(Number(event.target.value)); }} />
          <div className="range-ends"><span>0 · derivar más</span><span>1 · derivar menos</span></div>
        </div>
        <div className="controls-divider" />
        <div className="range-control">
          <label htmlFor="cost-fp">Costo falso positivo <strong>{money(costFP)}</strong></label>
          <input id="cost-fp" type="range" min={25000} max={300000} step={5000} value={costFP} onChange={event => onCostFP(Number(event.target.value))} />
          <div className="range-ends"><span>25 mil</span><span>300 mil</span></div>
        </div>
        <div className="range-control">
          <label htmlFor="cost-fn">Costo falso negativo <strong>{money(costFN)}</strong></label>
          <input id="cost-fn" type="range" min={200000} max={10000000} step={50000} value={costFN} onChange={event => onCostFN(Number(event.target.value))} />
          <div className="range-ends"><span>200 mil</span><span>10 millones</span></div>
        </div>
        <div className="theoretical-cut"><span>Umbral teórico p*</span><strong>{fixed(theoretical)}</strong><small>Supone probabilidades calibradas; no reemplaza train/CV.</small></div>
        <p className="controls-note">FP aproxima consulta y exámenes; FN es un supuesto gerencial. Cambiar costos no selecciona ni valida un nuevo umbral.</p>
      </aside>

      <div className="decision-data">
        <div className="data-heading"><div><span className="eyebrow">RESULTADO EN TEST</span><h2>Escenario actual</h2></div><span className="scenario-badge">Corte {fixed(threshold, 2)} · {exploring ? 'exploración' : 'train/CV'}</span></div>
        <div className="decision-kpis" aria-live="polite">
          <div className="decision-kpi primary"><span>Costo total hipotético</span><strong>{money(selectedCost)}</strong><small>FP × {money(costFP)} + FN × {money(costFN)}</small></div>
          <div className={difference < 0 ? 'decision-kpi adverse' : 'decision-kpi'}><span>{difference === 0 ? 'Sin diferencia vs. 0,50' : difference > 0 ? 'Menor costo vs. 0,50' : 'Mayor costo vs. 0,50'}</span><strong>{money(Math.abs(difference))}</strong><small>Solo en {integer(summary.n_test)} respuestas de prueba</small></div>
          <div className="decision-kpi"><span>Recall · casos detectados</span><strong>{percent(recall(selected))}</strong><small>{integer(selected.vp)} de {integer(prepared.positive)} positivos</small></div>
          <div className="decision-kpi"><span>Precisión · derivaciones</span><strong>{percent(precision(selected))}</strong><small>{integer(referrals)} derivaciones en test</small></div>
        </div>

        <div className="decision-charts">
          <div className="analysis-card curve-card">
            <div className="card-heading"><div><span className="eyebrow">COSTO Y UMBRAL</span><h2>¿Qué cambia al mover el corte?</h2></div></div>
            <Chart title="Costo hipotético según umbral" description="Curva retrospectiva en test; el diamante marca train/CV, el punto naranja el escenario y la línea punteada el corte 0,50." xTitle="Umbral" yTitle="Costo hipotético (CLP)" height={305} layout={{ showlegend: false, margin: { l: 80, r: 12, t: 38, b: 46 }, hovermode: 'x unified' }} traces={[
              { type: 'scatter', mode: 'lines', x: prepared.curve.map(point => point.threshold), y: series, line: { color: '#13786f', width: 3 }, hovertemplate: 'Umbral %{x:.2f}<br>CLP %{y:,.0f}<extra></extra>' },
              { type: 'scatter', mode: 'lines', x: [0.5, 0.5], y: [0, chartLimit], line: { color: '#9dafaa', dash: 'dash', width: 2 }, hoverinfo: 'skip' },
              { type: 'scatter', mode: 'markers', x: [summary.umbral_empirico], y: [cost(prepared.counts(summary.umbral_empirico), costFP, costFN)], marker: { color: '#173633', size: 11, symbol: 'diamond' }, hovertemplate: 'Train/CV %{x:.2f}<br>CLP %{y:,.0f}<extra></extra>' },
              { type: 'scatter', mode: 'markers', x: [threshold], y: [selectedCost], marker: { color: '#e39b4c', size: 15, line: { color: '#fff', width: 2 } }, hovertemplate: 'Escenario %{x:.2f}<br>CLP %{y:,.0f}<extra></extra>' },
            ]} />
          </div>
          <div className="analysis-card matrix-card">
            <div className="card-heading"><div><span className="eyebrow">ERRORES Y ACIERTOS</span><h2>Matriz de confusión</h2></div></div>
            <div className="matrix" role="table" aria-label={`Matriz de confusión con corte ${fixed(threshold, 2)}`}>
              <span className="matrix-corner" role="columnheader">Real ↓ / Señal →</span><span role="columnheader">No derivar</span><span role="columnheader">Derivar</span>
              <span role="rowheader">Sin evento</span><div className="matrix-cell" role="cell"><strong>VN · {integer(selected.vn)}</strong><small>Sin costo directo</small></div><div className="matrix-cell matrix-error" role="cell"><strong>FP · {integer(selected.fp)}</strong><small>{money(costFP * selected.fp)}</small></div>
              <span role="rowheader">Con evento</span><div className="matrix-cell matrix-error" role="cell"><strong>FN · {integer(selected.fn)}</strong><small>{money(costFN * selected.fn)}</small></div><div className="matrix-cell" role="cell"><strong>VP · {integer(selected.vp)}</strong><small>Casos detectados</small></div>
            </div>
            <p className="card-footnote">FP: derivación sin evento registrado. FN: positivo no detectado. Son conteos en test, no resultados clínicos prospectivos.</p>
          </div>
        </div>

        <div className="analysis-card policy-comparison">
          <div className="card-heading"><div><span className="eyebrow">COMPARACIÓN</span><h2>Referencia 0,50 vs. escenario actual</h2></div></div>
          <div className="comparison" role="table" aria-label="Comparación en test entre referencia y escenario">
            <div className="comparison-row comparison-head" role="row"><span role="columnheader">Indicador</span><span role="columnheader">0,50</span><span role="columnheader">{fixed(threshold, 2)}</span></div>
            <div className="comparison-row" role="row"><span role="cell">Costo hipotético</span><strong role="cell">{money(referenceCost)}</strong><strong role="cell">{money(selectedCost)}</strong></div>
            <div className="comparison-row" role="row"><span role="cell">Recall</span><strong role="cell">{percent(recall(reference))}</strong><strong role="cell">{percent(recall(selected))}</strong></div>
            <div className="comparison-row" role="row"><span role="cell">Precisión</span><strong role="cell">{percent(precision(reference))}</strong><strong role="cell">{percent(precision(selected))}</strong></div>
            <div className="comparison-row" role="row"><span role="cell">Falsos positivos</span><strong role="cell">{integer(reference.fp)}</strong><strong role="cell">{integer(selected.fp)}</strong></div>
            <div className="comparison-row" role="row"><span role="cell">Falsos negativos</span><strong role="cell">{integer(reference.fn)}</strong><strong role="cell">{integer(selected.fn)}</strong></div>
            <div className="comparison-row" role="row"><span role="cell">Derivaciones</span><strong role="cell">{integer(reference.fp + reference.vp)}</strong><strong role="cell">{integer(referrals)}</strong></div>
          </div>
        </div>

        <div className="decision-end"><div><span className="eyebrow">LECTURA RESPONSABLE</span><h2>{exploring ? 'Corte exploratorio: no es una política validada.' : originalCosts ? 'Más detección exige capacidad para más derivaciones.' : 'Nuevos costos exigen volver a seleccionar el corte.'}</h2><p>{exploring ? 'La exploración utiliza test de forma retrospectiva. Nunca elija el umbral reportable por el mínimo de esta curva.' : originalCosts ? `El corte train/CV detecta ${integer(selected.vp - reference.vp)} positivos más que 0,50, pero produce ${integer(referrals - reference.fp - reference.vp)} derivaciones adicionales en test.` : 'El corte 0,10 fue seleccionado con los costos originales. Con otros supuestos hay que seleccionar otra política usando solo entrenamiento.'} Ninguna cifra equivale a ahorro proyectado ni autoriza una derivación automática.</p></div><button type="button" onClick={onEvidence}>Ver evidencia del certamen ↗</button></div>
      </div>
    </div>
    <p className="disclaimer">Prototipo académico · BRFSS 2015 (EE. UU.) · Sin validación clínica ni representatividad de Chile · Decisión final siempre humana.</p>
  </section>;
}
