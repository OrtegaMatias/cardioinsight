'use client';

import { useState, type FormEvent } from 'react';
import { fixed, percent } from '@/lib/analytics';

const binaryFields = [
  ['HighBP', 'Presión arterial alta'], ['HighChol', 'Colesterol alto'], ['CholCheck', 'Chequeo de colesterol en 5 años'],
  ['Smoker', 'Ha fumado al menos 100 cigarrillos'], ['Stroke', 'Antecedente de ACV'],
  ['PhysActivity', 'Actividad física en los últimos 30 días'], ['Fruits', 'Consume fruta diariamente'],
  ['Veggies', 'Consume vegetales diariamente'], ['HvyAlcoholConsump', 'Consumo elevado de alcohol'],
  ['AnyHealthcare', 'Tiene cobertura de salud'], ['NoDocbcCost', 'No consultó por costo en el último año'],
  ['DiffWalk', 'Dificultad para caminar o subir escaleras'], ['Sex', 'Sexo codificado en la base (0 mujer, 1 hombre)',],
] as const;
const ageLabels = ['18–24', '25–29', '30–34', '35–39', '40–44', '45–49', '50–54', '55–59', '60–64', '65–69', '70–74', '75–79', '80+'];
const educationLabels = ['Nunca asistió / jardín infantil', 'Primaria (grados 1–8)', 'Algo de secundaria', 'Secundaria completa', 'Algo de educación superior', 'Superior completa'];
const incomeLabels = ['Menos de USD 10.000', 'USD 10.000–14.999', 'USD 15.000–19.999', 'USD 20.000–24.999', 'USD 25.000–34.999', 'USD 35.000–49.999', 'USD 50.000–74.999', 'USD 75.000 o más'];
const names = [...binaryFields.map(([name]) => name), 'BMI', 'Diabetes', 'GenHlth', 'MentHlth', 'PhysHlth', 'Age', 'Education', 'Income'] as const;
type FeatureName = typeof names[number];
type Prediction = { probability: number; decision: boolean; threshold: number; label: string; notice: string };

export default function IndividualForm({ validatedThreshold, manualThreshold }: { validatedThreshold: number; manualThreshold: number }) {
  const [values, setValues] = useState<Partial<Record<FeatureName, string>>>({});
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [useManualThreshold, setUseManualThreshold] = useState(false);
  const threshold = useManualThreshold ? manualThreshold : validatedThreshold;
  function setField(name: FeatureName, value: string) {
    setValues(previous => ({ ...previous, [name]: value }));
    setPrediction(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setPrediction(null); setPending(true);
    try {
      const features = Object.fromEntries(names.map(name => [name, Number(values[name])])) as Record<FeatureName, number>;
      const response = await fetch('/api/predict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', credentials: 'same-origin',
        body: JSON.stringify({ features, threshold }),
      });
      if (!response.ok) {
        setError(response.status === 422 ? 'Revisa los valores del formulario y vuelve a intentar.' : 'No fue posible calcular esta simulación. Intenta nuevamente.');
        return;
      }
      setPrediction(await response.json() as Prediction);
    } catch { setError('No se pudo contactar al servidor. Intenta nuevamente.'); }
    finally { setPending(false); }
  }
  function select(name: FeatureName, label: string, options: [number, string][]) {
    return <label className="form-field" key={name}>{label}
      <select required value={values[name] ?? ''} onChange={event => setField(name, event.target.value)} disabled={pending}>
        <option value="" disabled>Seleccionar</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>;
  }
  function number(name: FeatureName, label: string, min: number, max: number, step = 1) {
    return <label className="form-field" key={name}>{label}
      <input type="number" required min={min} max={max} step={step} value={values[name] ?? ''} onChange={event => setField(name, event.target.value)} disabled={pending} placeholder={`${min}–${max}`} />
    </label>;
  }
  return <section className="section-content" aria-labelledby="individual-heading">
    <div className="section-intro"><span className="eyebrow">08 / EXPLORACIÓN INDIVIDUAL</span><h2 id="individual-heading">Simulación educativa individual</h2>
      <p>Completa las 21 variables tal como están codificadas en la base BRFSS 2015. El modelo devuelve una puntuación estimada para el evento histórico «enfermedad cardíaca o infarto», no un riesgo clínico personal validado.</p></div>
    <div className="notice">No uses datos identificables. No almacenamos respuestas ni predicciones. Un resultado no diagnostica, descarta enfermedad ni justifica decisiones de tratamiento. Ante inquietudes, consulta a un profesional.</div>
    <form onSubmit={submit} className="input-card"><h3>Indicadores de salud y contexto</h3>
      <div className="form-grid">
        {binaryFields.map(([name, label]) => select(name, label, [[0, 'No (0)'], [1, 'Sí (1)']]))}
        {number('BMI', 'Índice de masa corporal (IMC)', 12, 98, 0.1)}
        {select('Diabetes', 'Diabetes (categoría BRFSS)', [[0, 'No (0)'], [1, 'Prediabetes (1)'], [2, 'Diabetes (2)']])}
        {select('GenHlth', 'Salud general autopercibida', [[1, 'Excelente (1)'], [2, 'Muy buena (2)'], [3, 'Buena (3)'], [4, 'Regular (4)'], [5, 'Mala (5)']])}
        {number('MentHlth', 'Días de mala salud mental en últimos 30 días', 0, 30)}
        {number('PhysHlth', 'Días de mala salud física en últimos 30 días', 0, 30)}
        {select('Age', 'Grupo de edad', ageLabels.map((label, index): [number, string] => [index + 1, label]))}
        {select('Education', 'Nivel educativo', educationLabels.map((label, index): [number, string] => [index + 1, label]))}
        {select('Income', 'Ingreso anual del hogar (categorías originales USD)', incomeLabels.map((label, index): [number, string] => [index + 1, label]))}
      </div>
      <label className="form-field">Criterio para la señal
        <select value={useManualThreshold ? 'manual' : 'validated'} onChange={event => { setUseManualThreshold(event.target.value === 'manual'); setPrediction(null); }}>
          <option value="validated">Umbral seleccionado en train/CV ({fixed(validatedThreshold, 2)})</option>
          <option value="manual">Umbral experimental del panel ({fixed(manualThreshold, 2)})</option>
        </select>
      </label>
      <p className="muted">La decisión usa el corte {fixed(threshold, 2)}; cambiar el corte modifica la señal, no la puntuación ni el modelo. El mínimo retrospectivo en test no se usa para seleccionar el corte.</p>
      <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Calculando…' : 'Calcular simulación'} <span aria-hidden="true">↗</span></button>
      {error && <p className="error-banner" role="alert">{error}</p>}
    </form>
    {prediction && <div className="prediction-card" role="status" aria-live="polite"><span className="eyebrow">RESULTADO DEL MODELO</span>
      <div className="prediction-line"><strong>{percent(prediction.probability)}</strong><span className={prediction.decision ? 'signal signal-on' : 'signal'}>{prediction.label}</span></div>
      <p>Puntuación estimada para el evento de la base histórica. Comparada con el umbral <strong>{fixed(prediction.threshold, 2)}</strong>; no representa una probabilidad clínica calibrada de enfermedad individual.</p>
      <p className="muted">{prediction.notice}</p>
    </div>}
  </section>;
}
