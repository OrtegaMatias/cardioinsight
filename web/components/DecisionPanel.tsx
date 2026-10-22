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

const scenarios = [
  { label: 'Caso base · 10×', fp: 100000, fn: 1000000 },
  { label: 'Costos iguales · 1×', fp: 200000, fn: 200000 },
  { label: 'Omitir es caro · 20×', fp: 100000, fn: 2000000 },
] as const;
const analyses = ['Costo vs. umbral', 'Matriz', 'Costos por error', 'Curva ROC', 'Cómo leerlo'];

export default function DecisionPanel({ prepared, summary, costFP, costFN, threshold, exploring, onExploring, onCostFP, onCostFN, onThreshold, onEvidence }: Props) {
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [analysis, setAnalysis] = useState(0);
  const reference = prepared.counts(0.5);
  const selected = prepared.counts(threshold);
  const referenceCost = cost(reference, costFP, costFN);
  const selectedCost = cost(selected, costFP, costFN);
  const difference = referenceCost - selectedCost;
  const referrals = selected.fp + selected.vp;
  const originalCosts = costFP === summary.c_fp && costFN === summary.c_fn;
  const theoretical = costFP / (costFP + costFN);
  const costFPObserved = selected.fp * costFP;
  const costFNObserved = selected.fn * costFN;
  const series = analysis === 0 ? prepared.curve.map(point => cost(point.counts, costFP, costFN)) : [];

  return <section className="decision" aria-labelledby="decision-title">
    <div className="decision-workspace">
      <button type="button" className="mobile-controls-toggle" aria-controls="decision-controls" aria-expanded={showMobileControls} onClick={() => setShowMobileControls(open => !open)}>
        <span><strong>Escenario · corte {fixed(threshold, 2)}</strong><small>FP {money(costFP)} · FN {money(costFN)}</small></span><span aria-hidden="true">{showMobileControls ? 'Cerrar −' : 'Ajustar +'}</span>
      </button>
      <aside id="decision-controls" className={showMobileControls ? 'decision-controls mobile-open' : 'decision-controls'} aria-label="Controles del escenario">
        <div className="controls-heading"><span aria-hidden="true">↔</span><h2>Panel de control</h2><small>Derivación cardiovascular</small></div>
        <div className="preset-group"><span className="eyebrow">ESCENARIOS RÁPIDOS</span>
          {scenarios.map((scenario, index) => <button type="button" key={scenario.label} className={costFP === scenario.fp && costFN === scenario.fn ? 'preset active' : 'preset'} aria-pressed={costFP === scenario.fp && costFN === scenario.fn} onClick={() => { onCostFP(scenario.fp); onCostFN(scenario.fn); }}>
            <span className="preset-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{scenario.label}
          </button>)}
        </div>
        <div className="range-control"><label htmlFor="cost-fp">Falso positivo · FP <strong>{money(costFP)}</strong></label><input id="cost-fp" type="range" min={25000} max={300000} step={5000} value={costFP} onChange={event => onCostFP(Number(event.target.value))} /><div className="range-ends"><span>CLP 25 mil</span><span>CLP 300 mil</span></div></div>
        <div className="range-control"><label htmlFor="cost-fn">Falso negativo · FN <strong>{money(costFN)}</strong></label><input id="cost-fn" type="range" min={200000} max={10000000} step={50000} value={costFN} onChange={event => onCostFN(Number(event.target.value))} /><div className="range-ends"><span>CLP 200 mil</span><span>CLP 10 millones</span></div></div>
        <div className="threshold-group"><span className="eyebrow">UMBRAL DE DECISIÓN</span>
          <div className="policy-options" role="group" aria-label="Origen del umbral">
            <button type="button" className={!exploring ? 'policy-option selected' : 'policy-option'} aria-pressed={!exploring} onClick={() => { onExploring(false); onThreshold(summary.umbral_empirico); }}>Train/CV · {fixed(summary.umbral_empirico, 2)}</button>
            <button type="button" className={exploring ? 'policy-option selected' : 'policy-option'} aria-pressed={exploring} onClick={() => onExploring(true)}>Explorar</button>
          </div>
          <div className="range-control"><label htmlFor="decision-threshold">Corte <strong>{fixed(threshold, 2)}</strong></label><input id="decision-threshold" type="range" min={0} max={1} step={0.01} value={threshold} onChange={event => { onExploring(true); onThreshold(Number(event.target.value)); }} /><div className="range-ends"><span>Derivar más</span><span>Derivar menos</span></div></div>
        </div>
        <div className="theoretical-cut"><span>Umbral teórico p*</span><strong>{fixed(theoretical)}</strong><small>Supone puntuaciones calibradas; no es el corte seleccionado.</small></div>
      </aside>

      <div className="decision-data">
        <header className="decision-hero">
          <span className="eyebrow">CARDIOINSIGHT · GRUPO 14</span>
          <h1 id="decision-title">Decidir a quién derivar.</h1>
          <p>Resultados retrospectivos para explorar el costo de cada error.</p>
          <div className="hero-facts"><span>Random Forest · inferencia</span><span>{integer(summary.n_test)} respuestas de prueba</span><span>{percent(summary.prop_minoritaria, 2)} con evento</span><span>AUC test {fixed(prepared.auc)}</span></div>
        </header>

        <div className="data-heading"><h2>Resultados · umbral {fixed(threshold, 2)}</h2><span className={exploring || !originalCosts ? 'scenario-badge caution' : 'scenario-badge'}>{exploring ? 'Corte exploratorio' : originalCosts ? 'Corte train/CV' : 'Costos nuevos · revalidar'}</span></div>
        <div className="decision-kpis" aria-live="polite">
          <div className="decision-kpi"><span aria-hidden="true">◉</span><small>Umbral evaluado</small><strong>{fixed(threshold, 2)}</strong><em>{exploring ? 'Exploración en test' : originalCosts ? 'Elegido con train/CV' : 'Revalidar para nuevos costos'}</em></div>
          <div className="decision-kpi"><span aria-hidden="true">◎</span><small>Recall</small><strong>{percent(recall(selected))}</strong><em>{integer(selected.vp)} de {integer(prepared.positive)} casos</em></div>
          <div className="decision-kpi"><span aria-hidden="true">↗</span><small>Precisión</small><strong>{percent(precision(selected))}</strong><em>{integer(referrals)} derivaciones</em></div>
          <div className="decision-kpi"><span aria-hidden="true">$</span><small>Costo total</small><strong>{money(selectedCost)}</strong><em>Con 0,50: {money(referenceCost)}</em></div>
          <div className={difference < 0 ? 'decision-kpi adverse' : 'decision-kpi'}><span aria-hidden="true">✓</span><small>{difference === 0 ? 'Diferencia vs. 0,50' : difference > 0 ? 'Menor costo vs. 0,50' : 'Mayor costo vs. 0,50'}</small><strong>{money(Math.abs(difference))}</strong><em>{difference === 0 ? 'Mismo costo en test' : `${percent(Math.abs(difference) / referenceCost)} ${difference > 0 ? 'menos' : 'más'} en test`}</em></div>
        </div>

        <div className={exploring || !originalCosts ? 'decision-insight caution' : 'decision-insight'} role="note">
          <span aria-hidden="true">◎</span>
          <p>{exploring ? 'Corte exploratorio: test solo ilustra, no elige el umbral.' : !originalCosts ? 'Los costos cambiaron: seleccione de nuevo el corte con train/CV antes de decidir.' : `Con este corte se detectan ${integer(selected.vp - reference.vp)} casos más, con ${integer(referrals - reference.fp - reference.vp)} derivaciones adicionales frente a 0,50.`}</p>
        </div>

        <div className="analysis-heading"><h2>Análisis</h2><span>Datos de prueba · BRFSS 2015</span></div>
        <div className="analysis-tabs" role="tablist" aria-label="Análisis de la decisión">
          {analyses.map((name, index) => <button type="button" key={name} role="tab" id={`analysis-tab-${index}`} aria-controls="decision-analysis" aria-selected={analysis === index} className={analysis === index ? 'active' : ''} onClick={() => setAnalysis(index)}>{name}</button>)}
        </div>
        <div className="analysis-card analysis-view" id="decision-analysis" role="tabpanel" aria-labelledby={`analysis-tab-${analysis}`}>
          {analysis === 0 && <Chart title="Costo hipotético según umbral" description="Curva retrospectiva en test; diamante azul: corte train/CV, punto coral: escenario, línea punteada: 0,50. No seleccionar el mínimo en test." xTitle="Umbral de decisión" yTitle="Costo hipotético (CLP)" height={350} layout={{ showlegend: false, margin: { l: 84, r: 22, t: 60, b: 54 }, hovermode: 'x unified' }} traces={[
            { type: 'scatter', mode: 'lines', x: prepared.curve.map(point => point.threshold), y: series, line: { color: '#00a199', width: 3 }, hovertemplate: 'Umbral %{x:.2f}<br>CLP %{y:,.0f}<extra></extra>' },
            { type: 'scatter', mode: 'lines', x: [0.5, 0.5], y: [0, Math.max(...series)], line: { color: '#8595a1', dash: 'dash', width: 2 }, hoverinfo: 'skip' },
            { type: 'scatter', mode: 'markers', x: [summary.umbral_empirico], y: [cost(prepared.counts(summary.umbral_empirico), costFP, costFN)], marker: { color: '#0e64b4', size: 12, symbol: 'diamond' }, hovertemplate: 'Train/CV %{x:.2f}<br>CLP %{y:,.0f}<extra></extra>' },
            { type: 'scatter', mode: 'markers', x: [threshold], y: [selectedCost], marker: { color: '#e07a5f', size: 15, line: { color: '#fff', width: 2 } }, hovertemplate: 'Escenario %{x:.2f}<br>CLP %{y:,.0f}<extra></extra>' },
          ]} />}
          {analysis === 1 && <><h3>Matriz de confusión · corte {fixed(threshold, 2)}</h3><div className="matrix" role="group" aria-label="Matriz de confusión">
            <span>Real ↓ / Señal →</span><span>No derivar</span><span>Derivar</span>
            <span>Sin evento</span><div className="matrix-cell"><strong>VN · {integer(selected.vn)}</strong><small>Sin costo directo</small></div><div className="matrix-cell matrix-error"><strong>FP · {integer(selected.fp)}</strong><small>{money(costFPObserved)}</small></div>
            <span>Con evento</span><div className="matrix-cell matrix-error"><strong>FN · {integer(selected.fn)}</strong><small>{money(costFNObserved)}</small></div><div className="matrix-cell"><strong>VP · {integer(selected.vp)}</strong><small>Detectados</small></div>
          </div></>}
          {analysis === 2 && <><h3>Desglose del costo hipotético en test</h3>
            <div className="cost-breakdown"><div><strong>Falsos positivos · {integer(selected.fp)}</strong><span>{money(costFPObserved)}</span><div className="cost-track"><span style={{ width: `${selectedCost ? 100 * costFPObserved / selectedCost : 0}%` }} /></div></div>
              <div><strong>Falsos negativos · {integer(selected.fn)}</strong><span>{money(costFNObserved)}</span><div className="cost-track"><span style={{ width: `${selectedCost ? 100 * costFNObserved / selectedCost : 0}%` }} /></div></div></div>
            <p className="muted">FP: derivación sin evento registrado. FN: caso positivo no detectado.</p></>}
          {analysis === 3 && <Chart title="ROC de la puntuación del modelo" description="Curva ROC en test; el punto marca el corte visible en el simulador. AUC no valida uso clínico." xTitle="Tasa de falsos positivos" yTitle="Recall" height={370} layout={{ showlegend: false, margin: { l: 74, r: 18, t: 62, b: 54 } }} traces={[
            { type: 'scattergl', mode: 'lines', x: prepared.roc.map(point => point.fpr), y: prepared.roc.map(point => point.tpr), line: { color: '#00a199', width: 3 }, hoverinfo: 'skip' },
            { type: 'scatter', mode: 'lines', x: [0, 1], y: [0, 1], line: { color: '#8595a1', dash: 'dash' }, hoverinfo: 'skip' },
            { type: 'scatter', mode: 'markers', x: [selected.fp / prepared.negative], y: [recall(selected)], marker: { color: '#e07a5f', size: 15 }, hovertemplate: 'FPR %{x:.3f}<br>Recall %{y:.3f}<extra></extra>' },
          ]} />}
          {analysis === 4 && <div className="interpretation"><h3>Antes de usar estos resultados</h3><p><strong>Costos:</strong> son supuestos, no ahorro proyectado. <strong>Corte:</strong> 0,10 se eligió con train/CV para los costos originales; explorar aquí no valida otro. <strong>Uso:</strong> BRFSS 2015 es de EE. UU.; no diagnostica ni sustituye evaluación humana.</p><button type="button" onClick={onEvidence}>Ver evidencia técnica ↗</button></div>}
        </div>
        <p className="disclaimer">Prototipo académico · No ingreses datos identificables · Sin validación clínica en Chile.</p>
      </div>
    </div>
  </section>;
}
