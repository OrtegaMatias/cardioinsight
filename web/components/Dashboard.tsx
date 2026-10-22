'use client';

import { useMemo, useState } from 'react';
import Chart from './Chart';
import DecisionPanel from './DecisionPanel';
import DataTable, { type Column } from './DataTable';
import IndividualForm from './IndividualForm';
import { cost, fixed, integer, money, percent, precision, prepare, recall, simulatedStrategies } from '@/lib/analytics';
import type { Comparison, DashboardData, Sensitivity, Strategy } from '@/lib/types';

const tabs = ['Resumen del experimento', 'Comparación de modelos', 'Modelo elegido', 'Costos y matriz', 'Sensibilidad', 'Calibración', 'ROC e iso-costo'];
const palette = { teal: '#168c8c', navy: '#142d46', blue: '#5393ce', coral: '#e77669', amber: '#d99a27', gray: '#75879a' };
const metric = (label: string, value: string, detail?: string) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
const float = (value: number | string) => typeof value === 'number' ? fixed(value) : value;
const modelColumns: Column<Comparison>[] = [
  { key: 'Nombre', label: 'Modelo · etapa' },
  ...(['F1_cv', 'Desv_cv', 'F1_train', 'F1_test', 'Brecha', 'Recall_test', 'Precision_test', 'AUC_test', 'PR_AUC_test', 'Tiempo_busqueda_s'] as const).map(key => ({ key, label: key.replaceAll('_', ' '), format: float })),
];
const strategyColumns: Column<Strategy>[] = [
  { key: 'Estrategia', label: 'Estrategia' },
  ...(['VN', 'FP', 'FN', 'VP'] as const).map(key => ({ key, label: key, format: (value: number | string) => integer(Number(value)) })),
  { key: 'Recall', label: 'Recall', format: (value) => fixed(Number(value)) },
  { key: 'Precision', label: 'Precisión', format: (value) => fixed(Number(value)) },
  { key: 'Costo_total', label: 'Costo total', format: (value) => money(Number(value)) },
  { key: 'Ahorro_vs_0_5', label: 'Ahorro vs 0,5', format: (value) => money(Number(value)) },
];

export default function Dashboard({ data, onLogout, onExpired, pending, error }: {
  data: DashboardData; onLogout: () => void; onExpired: () => void; pending: boolean; error: string;
}) {
  const [mode, setMode] = useState<'decision' | 'evidence' | 'individual'>('decision');
  const [tab, setTab] = useState(0);
  const [cfp, setCfp] = useState(data.resumen.c_fp);
  const [cfn, setCfn] = useState(data.resumen.c_fn);
  const [threshold, setThreshold] = useState(data.resumen.umbral_empirico);
  const [exploring, setExploring] = useState(false);
  const prepared = useMemo(() => prepare(data), [data]);
  const simulated = useMemo(() => simulatedStrategies(prepared, threshold, cfp, cfn, data.resumen.mejor_modelo_B), [prepared, threshold, cfp, cfn, data.resumen.mejor_modelo_B]);
  const current = prepared.counts(threshold);
  const r = data.resumen;
  const bestStrategy = data.estrategias.reduce((best, item) => item.Costo_total < best.Costo_total ? item : best);
  const chartColors = [palette.teal, palette.blue, '#3ba58b', palette.coral, palette.gray];

  return <div className="executive-shell">
    <header className="site-header">
      <div className="site-brand"><span className="brand-symbol" aria-hidden="true">＋</span><div><strong>cardio<span>insight</span></strong><small>ANALÍTICA PARA DECIDIR</small></div></div>
      <div className="university-mark"><img src="/udd-logo.png" alt="Universidad del Desarrollo" width={640} height={160} /></div>
      <nav className="site-nav" aria-label="Navegación principal">
        <button type="button" className={mode === 'decision' ? 'active' : ''} aria-current={mode === 'decision' ? 'page' : undefined} onClick={() => setMode('decision')}>Decisión</button>
        <button type="button" className={mode === 'evidence' ? 'active' : ''} aria-current={mode === 'evidence' ? 'page' : undefined} onClick={() => setMode('evidence')}>Evidencia</button>
        <button type="button" className={mode === 'individual' ? 'active' : ''} aria-current={mode === 'individual' ? 'page' : undefined} onClick={() => setMode('individual')}>Simulación individual</button>
      </nav>
      <button type="button" className="signout" onClick={onLogout} disabled={pending}>Salir <span aria-hidden="true">↗</span></button>
    </header>
    {error && <p role="alert" className="error-banner">{error}</p>}
    <main className="executive-main">
      {mode === 'decision' && <DecisionPanel prepared={prepared} summary={r} costFP={cfp} costFN={cfn} threshold={threshold} exploring={exploring} onExploring={setExploring} onCostFP={setCfp} onCostFN={setCfn} onThreshold={setThreshold} onEvidence={() => { setTab(3); setMode('evidence'); }} />}
      {mode === 'evidence' && <section className="evidence" aria-labelledby="evidence-title">
        <div className="evidence-heading"><div><span className="eyebrow">RESPALDO DEL CERTAMEN</span><h1 id="evidence-title">La evidencia detrás de la decisión.</h1><p>Datos, validación, calibración y análisis de costos. La política reportable se seleccionó con train/CV; las curvas sobre test son retrospectivas.</p></div><div className="evidence-assumptions">Escenario activo <strong>FP {money(cfp)} · FN {money(cfn)} · corte {fixed(threshold, 2)}</strong><button type="button" onClick={() => setMode('decision')}>Ajustar en Decisión ↗</button></div></div>
        <div className="evidence-selector"><label htmlFor="evidence-section">Sección de análisis</label><select id="evidence-section" value={tab} onChange={event => setTab(Number(event.target.value))}>{tabs.map((name, index) => <option key={name} value={index}>{String(index + 1).padStart(2, '0')} · {name}</option>)}</select></div>
        <div id="report-panel" role="region" aria-label={tabs[tab]}>
        {tab === 0 && <section className="section-content"><div className="section-intro"><span className="eyebrow">01 / PANORAMA</span><h2>Resumen ejecutivo</h2><p>Datos de partida, diseño experimental y resultados reportados.</p></div>
          <div className="metric-grid four">{metric('Registros (tras limpieza)', integer(r.registros))}{metric('Clase minoritaria (enfermos)', percent(r.prop_minoritaria, 2))}{metric('Variables predictoras', String(r.predictoras))}{metric('Train / Test', `${integer(r.n_train)} / ${integer(r.n_test)}`)}</div>
          <div className="text-card"><h3>El problema detrás de la predicción</h3><p>Se explora a quién derivar para un estudio cardiológico. Un falso positivo supone derivar a una persona sin el evento (costo hipotético {money(r.c_fp)}); un falso negativo supone no detectar un caso (costo hipotético {money(r.c_fn)}).</p><p>{r.duplicados_eliminados ? `Se eliminaron ${integer(r.duplicados_encontrados)} filas idénticas.` : `Se detectaron ${integer(r.duplicados_encontrados)} filas idénticas y se conservaron porque la base no identifica personas.`} La partición fue 80/20 estratificada; la limpieza se ejecutó dentro del pipeline. La búsqueda de hiperparámetros usó {integer(r.n_sub)} filas, {r.n_iter} combinaciones por modelo y {r.cv_folds} folds.</p><p className="muted">Costo FP: aproximación a consulta cardiológica + ECG + ecocardiograma con arancel MLE FONASA 2025. Costo FN: supuesto gerencial conservador de 10×, no una tarifa clínica; el análisis cubre razones de 2× a 50×.</p></div>
          <div className="feature-callout"><span>MODELO LÍDER POR F1 DE VALIDACIÓN CRUZADA</span><strong>{r.mejor_modelo} · {r.mejor_etapa}</strong><p>F1 CV {fixed(r.mejor_f1_cv)} ± {fixed(r.mejor_desv_cv)} · F1 test {fixed(r.mejor_f1_test)} · brecha train–test {fixed(r.mejor_brecha)}</p></div>
          <h3>Comparación económica de estrategias</h3><p className="muted">Resultados ilustrativos sobre test con los costos originales de entrenamiento; para costos actuales, visita «Costo y umbral».</p><DataTable rows={data.estrategias} columns={strategyColumns} caption="Estrategias originales sobre el conjunto de test" initialSort="Costo_total" />
          <div className="notice">Menor costo observado en esta comparación: <strong>{bestStrategy.Estrategia}</strong> · ahorro estimado de {money(bestStrategy.Ahorro_vs_0_5)} frente al corte 0,5. Esto no selecciona un umbral reportable a partir del test.</div>
        </section>}
        {tab === 1 && <section className="section-content"><div className="section-intro"><span className="eyebrow">02 / COMPARATIVA</span><h2>Diez combinaciones, una evaluación</h2><p>Cinco algoritmos y dos estrategias para el desbalance. F1 CV se calculó en la submuestra de búsqueda; train y test sobre el modelo reentrenado. Brecha = F1 train − F1 test. El modelo se eligió por CV, no por test.</p></div>
          <DataTable rows={data.comparacion} columns={modelColumns} caption="Comparación de diez combinaciones de modelos" initialSort="F1_cv" initialDescending />
          <Chart title="F1 · entrenamiento, CV y test" description="Tres F1 para cada una de las diez combinaciones; la tabla contiene todos los valores." xTitle="F1 de la clase minoritaria" height={510} layout={{ barmode: 'group', margin: { l: 195, r: 15, t: 70, b: 55 }, yaxis: { autorange: 'reversed' } }} traces={(['F1_train', 'F1_cv', 'F1_test'] as const).map((key, index) => ({ type: 'bar' as const, orientation: 'h' as const, name: key.replace('_', ' '), y: data.comparacion.map(row => row.Nombre), x: data.comparacion.map(row => row[key]), marker: { color: chartColors[index] }, hovertemplate: '%{y}<br>F1 %{x:.3f}<extra>%{fullData.name}</extra>' }))} />
          <div className="two-columns"><div><h3>SMOTE vs. pesos · promedio por etapa</h3><DataTable caption="Promedio de métricas por etapa" rows={['A: SMOTE', 'B: Pesos'].map(etapa => { const rows = data.comparacion.filter(row => row.Etapa === etapa); return { Etapa: etapa, F1_cv: rows.reduce((s, x) => s + x.F1_cv, 0) / rows.length, F1_test: rows.reduce((s, x) => s + x.F1_test, 0) / rows.length, Recall_test: rows.reduce((s, x) => s + x.Recall_test, 0) / rows.length, Precision_test: rows.reduce((s, x) => s + x.Precision_test, 0) / rows.length, AUC_test: rows.reduce((s, x) => s + x.AUC_test, 0) / rows.length, Tiempo_busqueda_s: rows.reduce((s, x) => s + x.Tiempo_busqueda_s, 0) / rows.length }; })} columns={[{ key: 'Etapa', label: 'Etapa' }, ...(['F1_cv', 'F1_test', 'Recall_test', 'Precision_test', 'AUC_test', 'Tiempo_busqueda_s'] as const).map(key => ({ key, label: key.replaceAll('_', ' '), format: float }))]} /><p className="muted">Los pesos suelen subir recall y bajar precisión; AUC cambia poco. Cambia dónde queda el corte de 0,5.</p></div>
          <div><h3>Estabilidad entre folds</h3><Chart title="F1 por fold" description="Cada punto corresponde a un fold de CV; la tabla debajo ofrece los valores." xTitle="F1 por fold" height={370} layout={{ margin: { l: 195, r: 15, t: 65, b: 60 } }} traces={[{ type: 'scatter', mode: 'markers', x: data.tabla_cv.map(row => row.F1), y: data.tabla_cv.map(row => row.Nombre), text: data.tabla_cv.map(row => `Fold ${row.Fold}`), marker: { color: palette.teal, size: 10 }, hovertemplate: '%{y}<br>%{text} · F1 %{x:.3f}<extra></extra>' }]} /><DataTable rows={data.tabla_cv} caption="F1 de cada fold de validación cruzada" columns={[{ key: 'Nombre', label: 'Modelo · etapa' }, { key: 'Fold', label: 'Fold' }, { key: 'F1', label: 'F1', format: float }]} /></div></div>
          <h3>Hiperparámetros ganadores</h3><DataTable caption="Hiperparámetros de cada combinación" rows={data.comparacion} columns={[{ key: 'Nombre', label: 'Modelo · etapa' }, { key: 'Hiperparametros', label: 'Hiperparámetros' }]} />
        </section>}
        {tab === 2 && <section className="section-content"><div className="section-intro"><span className="eyebrow">03 / MODELO LÍDER</span><h2>{r.mejor_modelo} <span className="muted">· {r.mejor_etapa}</span></h2><p>Seleccionado por F1 de validación cruzada. El test se usa para confirmar, no para elegir modelo.</p></div><div className="metric-grid three">{metric('F1 CV', fixed(r.mejor_f1_cv), `± ${fixed(r.mejor_desv_cv)}`)}{metric('F1 test', fixed(r.mejor_f1_test))}{metric('Brecha train–test', fixed(r.mejor_brecha))}</div>
          <details className="text-card"><summary>Ver hiperparámetros del modelo</summary><dl className="parameter-list">{Object.entries(r.mejor_hiperparametros).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></details>
          <Chart title="Variables con mayor importancia" description="Importancia relativa, no causalidad. La tabla contiene todas las variables." xTitle="Importancia relativa" height={470} layout={{ margin: { l: 125, r: 20, t: 68, b: 50 }, yaxis: { autorange: 'reversed' } }} traces={[{ type: 'bar', orientation: 'h', y: data.importancias.slice(0, 12).map(row => row.Variable), x: data.importancias.slice(0, 12).map(row => row.Importancia), marker: { color: palette.teal }, hovertemplate: '%{y}: %{x:.3f}<extra></extra>' }]} />
          <DataTable rows={data.importancias} columns={[{ key: 'Variable', label: 'Variable' }, { key: 'Importancia', label: 'Importancia', format: float }]} caption="Importancia de todas las variables" initialSort="Importancia" initialDescending /><p className="muted">Importancia no demuestra causalidad: resume cuánto contribuyó cada variable a separar las clases para este modelo.</p>
        </section>}
        {tab === 3 && <section className="section-content"><div className="section-intro"><span className="eyebrow">04 / SIMULADOR</span><h2>El costo de mover el umbral</h2><p>Explora los conteos de test con los costos hipotéticos y el umbral elegidos. Los datos de test ilustran, pero no seleccionan el umbral reportable.</p></div><div className="metric-grid four">{metric('Recall', percent(recall(current)))}{metric('Precisión', percent(precision(current)))}{metric('Costo total hipotético', money(cost(current, cfp, cfn)))}{metric('Ahorro vs. corte 0,5', money(simulated.base - cost(current, cfp, cfn)))}</div>
          <div className="two-columns cost-layout"><Chart title="Costo total estimado según umbral" description={`La línea de mínimo en test (${fixed(simulated.minPoint.threshold, 2)}) es solo retrospectiva. El umbral seleccionado con CV/train es ${fixed(r.umbral_empirico, 2)}.`} xTitle="Umbral de decisión" yTitle="Costo hipotético (CLP)" layout={{ hovermode: 'x unified' }} height={440} traces={[
            { type: 'scatter', mode: 'lines', name: 'Costo total', x: prepared.curve.map(point => point.threshold), y: prepared.curve.map(point => cost(point.counts, cfp, cfn)), line: { color: palette.teal, width: 3 }, fill: 'tozeroy', fillcolor: 'rgba(22,140,140,.08)' },
            ...([[0.5, 'Corte 0,5', palette.gray], [simulated.theoretical, 'Teórico p*', '#3ba58b'], [simulated.minPoint.threshold, 'Mínimo test', palette.coral], [r.umbral_empirico, 'CV/train', palette.blue], [threshold, 'Corte actual', palette.navy]] as [number, string, string][]).map(([point, name, color]) => ({ type: 'scatter' as const, mode: 'lines' as const, name, x: [point, point], y: [0, Math.max(...prepared.curve.map(row => cost(row.counts, cfp, cfn)))], line: { color, dash: 'dash' as const, width: 2 }, hoverinfo: 'name' as const })),
          ]} />
          <div><h3>Matriz de confusión · corte {fixed(threshold, 2)}</h3><div className="matrix"><span className="matrix-corner">Real ↓ / Predicho →</span><span>Predicho sin evento</span><span>Predicho con evento</span><span>Real sin evento</span><div className="matrix-cell matrix-0"><strong>VN · {integer(current.vn)}</strong><small>Sin costo directo</small></div><div className="matrix-cell matrix-1"><strong>FP · {integer(current.fp)}</strong><small>{money(cfp * current.fp)}</small></div><span>Real con evento</span><div className="matrix-cell matrix-2"><strong>FN · {integer(current.fn)}</strong><small>{money(cfn * current.fn)}</small></div><div className="matrix-cell matrix-3"><strong>VP · {integer(current.vp)}</strong><small>Sin costo directo</small></div></div><p className="muted">Costo FP {money(cfp * current.fp)} · costo FN {money(cfn * current.fn)}.</p></div></div>
          <h3>Estrategias con los costos actuales</h3><DataTable rows={simulated.rows} columns={strategyColumns} caption="Comparación hipotética según los costos actuales" /><div className="notice"><strong>Test no decide el umbral reportable.</strong> El mínimo de la curva ({fixed(simulated.minPoint.threshold, 2)}) se calculó retrospectivamente sobre test solo para ilustrar. El umbral empírico reportable fue seleccionado con validación cruzada usando únicamente train ({fixed(r.umbral_empirico, 2)}); test confirma su resultado una vez. El costo teórico presupone probabilidades calibradas.</div>
        </section>}
        {tab === 4 && <section className="section-content"><div className="section-intro"><span className="eyebrow">05 / SENSIBILIDAD</span><h2>¿Y si cambia el costo?</h2><p>Se mantiene fijo el costo de FP y se varía el de FN. Cada umbral empírico de la tabla original se eligió usando solo train.</p></div>
          <Chart title="Umbral estimado según costo relativo" description="Eje horizontal logarítmico de razón FN/FP; la tabla incluye los costos y ahorros originales." xTitle="Razón costo FN / FP (escala logarítmica)" yTitle="Umbral" layout={{ xaxis: { type: 'log', title: { text: 'Razón costo FN / FP (escala logarítmica)' } }, hovermode: 'x unified' }} traces={[['Umbral_empirico', 'Empírico (train/CV)', palette.teal], ['p_teorico', 'Teórico p*', palette.navy]].map(([key, label, color]) => ({ type: 'scatter' as const, mode: 'lines+markers' as const, name: label, x: data.sensibilidad.map(row => row.Razon_FN_FP), y: data.sensibilidad.map(row => row[key as keyof Sensitivity]), line: { color, width: 3 }, marker: { size: 9 } }))} />
          <DataTable rows={data.sensibilidad} caption="Sensibilidad del umbral y costo por razón FN/FP con costos originales" columns={[{ key: 'Razon_FN_FP', label: 'Razón FN/FP' }, { key: 'p_teorico', label: 'p* teórico', format: float }, { key: 'Umbral_empirico', label: 'Umbral empírico', format: (value) => fixed(Number(value), 2) }, ...(['Costo_0_5', 'Costo_teorico', 'Costo_empirico', 'Ahorro_empirico_vs_0_5'] as const).map(key => ({ key, label: key.replaceAll('_', ' '), format: (value: number | string) => money(Number(value)) }))]} />
          <p className="muted">En los escenarios observados, al crecer el costo relativo de FN el umbral empírico baja. Estas cifras son supuestos, no estimaciones clínicas.</p>
        </section>}
        {tab === 5 && <section className="section-content"><div className="section-intro"><span className="eyebrow">06 / CALIBRACIÓN</span><h2>¿Qué significa una probabilidad?</h2><p>Buena clasificación no garantiza que la puntuación del modelo coincida con la frecuencia observada. El corte teórico p* supone probabilidades calibradas; comparamos la media estimada con la tasa real de cada tramo decílico de test.</p></div>
          <Chart title="Probabilidad estimada vs. frecuencia observada" description="Tramos por cuantiles de la puntuación; la tabla lista media, proporción real y número de casos." xTitle="Probabilidad promedio estimada" yTitle="Proporción observada de casos positivos" layout={{ hovermode: 'closest' }} height={430} traces={[{ type: 'scatter', mode: 'lines+markers', name: 'Modelo', x: prepared.calibration.map(row => row.proba_media), y: prepared.calibration.map(row => row.tasa_real), text: prepared.calibration.map(row => `n = ${integer(row.n)}`), hovertemplate: 'Estimada: %{x:.3f}<br>Observada: %{y:.3f}<br>%{text}<extra></extra>', line: { color: palette.teal, width: 3 }, marker: { size: 9 } }, { type: 'scatter', mode: 'lines', name: 'Calibración perfecta', x: [0, Math.max(...prepared.calibration.map(row => Math.max(row.proba_media, row.tasa_real)))], y: [0, Math.max(...prepared.calibration.map(row => Math.max(row.proba_media, row.tasa_real)))], line: { color: palette.gray, dash: 'dash' } }]} />
          <DataTable caption="Calibración por tramo de probabilidad estimada en test" rows={prepared.calibration} columns={[{ key: 'proba_media', label: 'Probabilidad media', format: float }, { key: 'tasa_real', label: 'Tasa real', format: float }, { key: 'n', label: 'Casos', format: (value) => integer(Number(value)) }]} />
          <div className="notice">Probabilidad mínima del modelo: {fixed(prepared.min)} · media: {fixed(prepared.mean)} · tasa real: {fixed(prepared.prevalence)}. Si la mínima supera p* de referencia ({fixed(r.p_star)}), el corte teórico clasifica todos como positivos: es un síntoma de falta de calibración, no un error del cálculo. Se evalúa también un umbral empírico train/CV.</div>
        </section>}
        {tab === 6 && <section className="section-content"><div className="section-intro"><span className="eyebrow">07 / GEOMETRÍA DE COSTOS</span><h2>ROC e iso-costo</h2><p>Geometría retrospectiva sobre test, como en el notebook del curso. La recta de iso-costo depende de los supuestos del panel y no autoriza seleccionar un umbral sobre test.</p></div>
          <div className="metric-grid three">{metric('AUC sobre test', fixed(prepared.auc))}{metric('Pendiente de iso-costo', fixed(simulated.slope, 2))}{metric('Corte actual · recall', percent(recall(current)))}</div>
          <Chart title="ROC del modelo e iso-costo" description="Todos los puntos ROC originales se muestran con trazado acelerado; los marcadores identifican el corte actual y el mínimo retrospectivo." xTitle="FPR (1 − especificidad)" yTitle="TPR (recall)" height={530} layout={{ xaxis: { title: { text: 'FPR (1 − especificidad)' }, range: [0, 1] }, yaxis: { title: { text: 'TPR (recall)' }, range: [0, 1.02] } }} traces={[
            { type: 'scattergl', mode: 'lines', name: `ROC (AUC = ${fixed(prepared.auc)})`, x: prepared.roc.map(point => point.fpr), y: prepared.roc.map(point => point.tpr), line: { color: palette.teal, width: 3 } },
            { type: 'scatter', mode: 'lines', name: 'Azar', x: [0, 1], y: [0, 1], line: { color: palette.gray, dash: 'dash' } },
            { type: 'scatter', mode: 'lines', name: `Iso-costo (m = ${fixed(simulated.slope, 2)})`, x: [0, 1], y: [simulated.rocMinimum.tpr - simulated.slope * simulated.rocMinimum.fpr, simulated.rocMinimum.tpr + simulated.slope * (1 - simulated.rocMinimum.fpr)], line: { color: palette.navy, dash: 'dot', width: 2 } },
            { type: 'scatter', mode: 'markers', name: 'Mínimo retrospectivo', x: [simulated.rocMinimum.fpr], y: [simulated.rocMinimum.tpr], marker: { size: 14, symbol: 'circle-open', color: palette.coral, line: { width: 3 } } },
            { type: 'scatter', mode: 'markers', name: `Corte actual (${fixed(threshold, 2)})`, x: [current.fp / prepared.negative], y: [recall(current)], marker: { size: 14, symbol: 'star', color: palette.amber } },
          ]} />
          <p className="notice">La pendiente es C_FP × N / (C_FN × P) = {fixed(simulated.slope, 2)}. Al aumentar el costo de FN, la recta se aplana y favorece un recall mayor. La ubicación del mínimo ROC proviene de test y es solo retrospectiva; el umbral reportable es {fixed(r.umbral_empirico, 2)} (train/CV).</p>
          <DataTable caption="Puntos de referencia de ROC en test" rows={[
            { Escenario: 'Corte actual', Umbral: threshold, FPR: current.fp / prepared.negative, TPR: recall(current) },
            { Escenario: 'Referencia 0,5', Umbral: 0.5, FPR: prepared.counts(0.5).fp / prepared.negative, TPR: recall(prepared.counts(0.5)) },
            { Escenario: 'Teórico p*', Umbral: simulated.theoretical, FPR: prepared.counts(simulated.theoretical).fp / prepared.negative, TPR: recall(prepared.counts(simulated.theoretical)) },
            { Escenario: 'Empírico train/CV', Umbral: r.umbral_empirico, FPR: prepared.counts(r.umbral_empirico).fp / prepared.negative, TPR: recall(prepared.counts(r.umbral_empirico)) },
            { Escenario: 'Mínimo retrospectivo ROC', Umbral: simulated.rocMinimum.threshold, FPR: simulated.rocMinimum.fpr, TPR: simulated.rocMinimum.tpr },
          ]} columns={[{ key: 'Escenario', label: 'Escenario' }, ...(['Umbral', 'FPR', 'TPR'] as const).map(key => ({ key, label: key, format: (value: number | string) => fixed(Number(value)) }))]} />
        </section>}
        </div>
      </section>}
      {mode === 'individual' && <div className="individual-view"><IndividualForm validatedThreshold={r.umbral_empirico} manualThreshold={threshold} onExpired={onExpired} /></div>}
    </main>
    <footer className="site-footer"><span>CardioInsight · Grupo 14 · Joaquín Rivas y Matías Ortega</span><span>BRFSS 2015 · Prototipo académico, no diagnóstico ni indicación de tratamiento.</span></footer>
  </div>;
}
