'use client';

import Chart from './Chart';
import { cost, fixed, integer, money, percent, recall, type Prepared } from '@/lib/analytics';
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
  const originalCosts = costFP === summary.c_fp && costFN === summary.c_fn;
  const reference = prepared.counts(0.5);
  const selected = prepared.counts(threshold);
  const referenceCost = cost(reference, costFP, costFN);
  const selectedCost = cost(selected, costFP, costFN);
  const difference = referenceCost - selectedCost;
  const extraReferrals = selected.fp + selected.vp - reference.fp - reference.vp;
  const additionalDetected = selected.vp - reference.vp;
  const series = prepared.curve.map(point => cost(point.counts, costFP, costFN));
  const chartLimit = Math.max(...series);
  const tested = summary.n_test;

  return <section className="decision" aria-labelledby="decision-title">
    <div className="decision-heading">
      <div><span className="eyebrow">CARDIOINSIGHT / DECISIÓN GERENCIAL</span>
        <h1 id="decision-title">¿A quién derivar<br /><span>para evaluación?</span></h1>
        <p>Compare el costo de no detectar casos con el esfuerzo de derivar a más personas. Los valores son supuestos aplicados al conjunto de prueba, no costos clínicos observados.</p>
      </div>
      <div className="decision-context"><span>BASE DE ANÁLISIS</span><strong>{integer(tested)} respuestas</strong><small>BRFSS 2015 · conjunto de prueba de EE. UU.</small></div>
    </div>

    <div className="policy-card">
      <div className="policy-title"><span className="eyebrow">01 / ELEGIR UN CORTE</span><h2>Política de derivación</h2><p>Referencia: umbral 0,50. Compare con el umbral {fixed(summary.umbral_empirico, 2)} seleccionado por validación cruzada usando solo entrenamiento.</p></div>
      <div className="policy-options" role="group" aria-label="Política de corte">
        <button type="button" className={!exploring ? 'policy-option selected' : 'policy-option'} aria-pressed={!exploring} onClick={() => { onExploring(false); onThreshold(summary.umbral_empirico); }}><strong>Corte del experimento</strong><span>{fixed(summary.umbral_empirico, 2)} · elegido con train/CV</span></button>
        <button type="button" className={exploring ? 'policy-option selected' : 'policy-option'} aria-pressed={exploring} onClick={() => onExploring(true)}><strong>Explorar otro corte</strong><span>Simulación retrospectiva, no validada</span></button>
      </div>
      {exploring && <div className="range-control policy-range"><label htmlFor="decision-threshold">Umbral de exploración <strong>{fixed(threshold, 2)}</strong></label><input id="decision-threshold" type="range" min={0} max={1} step={0.01} value={threshold} onChange={event => onThreshold(Number(event.target.value))} /><div className="range-ends"><span>0,00 · más derivaciones</span><span>1,00 · menos derivaciones</span></div></div>}
    </div>

    <div className="outcome-heading"><div><span className="eyebrow">02 / EFECTO EN LA PRUEBA</span><h2>Qué cambia frente a 0,50</h2></div><span className="scenario-badge">Corte actual {fixed(threshold, 2)}</span></div>
    <div className="outcomes" aria-live="polite">
      <div className={difference < 0 ? 'outcome primary adverse' : 'outcome primary'}><span>{difference >= 0 ? 'Menor costo hipotético' : 'Mayor costo hipotético'}</span><strong>{money(Math.abs(difference))}</strong><small>Comparación en {integer(tested)} respuestas de test · no es un ahorro proyectado.</small></div>
      <div className="outcome"><span>Derivaciones {extraReferrals >= 0 ? 'adicionales' : 'menos'}</span><strong>{integer(Math.abs(extraReferrals))}</strong><small>{integer(selected.fp)} serían falsos positivos con este corte.</small></div>
      <div className="outcome"><span>Casos positivos {additionalDetected >= 0 ? 'más detectados' : 'menos detectados'}</span><strong>{integer(Math.abs(additionalDetected))}</strong><small>{integer(selected.fn)} casos positivos no se detectarían.</small></div>
    </div>

    <div className="decision-grid">
      <div className="analysis-card">
        <div className="card-heading"><div><span className="eyebrow">03 / COMPROMISO</span><h2>Detección y derivación</h2></div></div>
        <div className="comparison" role="table" aria-label="Comparación de políticas en test">
          <div className="comparison-row comparison-head" role="row"><span role="columnheader">Indicador</span><span role="columnheader">0,50</span><span role="columnheader">{fixed(threshold, 2)}</span></div>
          <div className="comparison-row" role="row"><span role="cell">Sensibilidad (recall)</span><strong role="cell">{percent(recall(reference))}</strong><strong role="cell">{percent(recall(selected))}</strong></div>
          <div className="comparison-row" role="row"><span role="cell">Casos no detectados (FN)</span><strong role="cell">{integer(reference.fn)}</strong><strong role="cell">{integer(selected.fn)}</strong></div>
          <div className="comparison-row" role="row"><span role="cell">Derivaciones sin evento (FP)</span><strong role="cell">{integer(reference.fp)}</strong><strong role="cell">{integer(selected.fp)}</strong></div>
        </div>
        <p className="card-footnote">FP: derivación de quien no presentó el evento en la base. FN: caso positivo no detectado. Esta comparación utiliza test únicamente para ilustrar resultados.</p>
      </div>
      <div className="analysis-card costs-card"><div className="card-heading"><div><span className="eyebrow">04 / SUPUESTOS</span><h2>Ajuste los costos</h2></div></div>
        <div className="range-control"><label htmlFor="cost-fp">Falso positivo <strong>{money(costFP)}</strong></label><input id="cost-fp" type="range" min={25000} max={300000} step={5000} value={costFP} onChange={event => onCostFP(Number(event.target.value))} /><div className="range-ends"><span>CLP 25.000</span><span>CLP 300.000</span></div></div>
        <div className="range-control"><label htmlFor="cost-fn">Falso negativo <strong>{money(costFN)}</strong></label><input id="cost-fn" type="range" min={200000} max={10000000} step={50000} value={costFN} onChange={event => onCostFN(Number(event.target.value))} /><div className="range-ends"><span>CLP 200.000</span><span>CLP 10.000.000</span></div></div>
        <p className="card-footnote">FP: aproximación del arancel de consulta y exámenes; FN: supuesto gerencial, no tarifa observada. Cambiar costos no reentrena el modelo.</p>
      </div>
    </div>

    <div className="analysis-card curve-card"><div className="card-heading"><div><span className="eyebrow">05 / EXPLORAR</span><h2>Costo frente al umbral</h2></div><span className="chart-key">● Escenario&nbsp;&nbsp; ◆ Train/CV&nbsp;&nbsp; ┊ Referencia 0,50</span></div>
      <Chart title="Costo hipotético por umbral" description="Curva retrospectiva sobre test. La línea 0,50 es la referencia y el marcador indica el corte elegido." xTitle="Umbral de decisión" yTitle="Costo hipotético (CLP)" height={310} layout={{ showlegend: false, margin: { l: 88, r: 22, t: 35, b: 50 }, hovermode: 'x unified' }} traces={[
        { type: 'scatter', mode: 'lines', x: prepared.curve.map(point => point.threshold), y: series, line: { color: '#13786f', width: 3 }, hovertemplate: 'Umbral %{x:.2f}<br>Costo CLP %{y:,.0f}<extra></extra>' },
        { type: 'scatter', mode: 'lines', x: [0.5, 0.5], y: [0, chartLimit], line: { color: '#a9b9b6', dash: 'dash', width: 1 }, hoverinfo: 'skip' },
        { type: 'scatter', mode: 'markers', x: [summary.umbral_empirico], y: [cost(prepared.counts(summary.umbral_empirico), costFP, costFN)], marker: { color: '#173633', size: 11, symbol: 'diamond' }, hovertemplate: 'Train/CV %{x:.2f}<br>CLP %{y:,.0f}<extra></extra>' },
        { type: 'scatter', mode: 'markers', x: [threshold], y: [selectedCost], marker: { color: '#e39b4c', size: 15, line: { color: '#fff', width: 2 } }, hovertemplate: 'Escenario %{x:.2f}<br>CLP %{y:,.0f}<extra></extra>' },
      ]} />
    </div>

    <div className="decision-end"><div><span className="eyebrow">LECTURA DE GERENCIA</span><h2>{exploring ? 'Un escenario para estudiar, no para aprobar.' : originalCosts ? 'Priorizar la evaluación, no automatizar decisiones.' : 'Los costos cambiaron: revalidar antes de decidir.'}</h2><p>{exploring ? 'El corte manual se evalúa retrospectivamente con test; no debe presentarse como umbral seleccionado o validado.' : originalCosts ? 'Con los supuestos originales, el corte de 0,10 fue elegido con train/CV y en test detecta más casos que 0,50 a costa de más derivaciones. Una persona debe revisar cualquier decisión real.' : 'El corte de 0,10 se eligió para los costos originales. Si cambian los supuestos, la nueva política debe seleccionarse con datos de entrenamiento y validarse antes de implementarse.'}</p></div><button type="button" onClick={onEvidence}>Ver evidencia técnica <span aria-hidden="true">↗</span></button></div>
    <p className="disclaimer">Prototipo académico. BRFSS 2015, EE. UU.; no representa la población chilena. No es una estimación de ahorro real, diagnóstico ni indicación de tratamiento.</p>
  </section>;
}
