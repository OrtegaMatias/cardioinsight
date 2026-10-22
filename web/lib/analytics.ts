import type { DashboardData, Strategy } from './types';

export type Counts = { vn: number; fp: number; fn: number; vp: number };
export type CurvePoint = { threshold: number; counts: Counts };
export type RocPoint = { fpr: number; tpr: number; threshold: number };
export type CalibrationPoint = { proba_media: number; tasa_real: number; n: number };
export type Prepared = {
  counts: (threshold: number) => Counts; weightedCounts: (threshold: number) => Counts;
  curve: CurvePoint[]; roc: RocPoint[]; auc: number; calibration: CalibrationPoint[];
  min: number; mean: number; prevalence: number; negative: number; positive: number;
};

export const money = (value: number) => `CLP ${Math.round(value).toLocaleString('es-CL')}`;
export const fixed = (value: number, digits = 3) => value.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const integer = (value: number) => value.toLocaleString('es-CL');
export const percent = (value: number, digits = 1) => `${(value * 100).toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
export const recall = (c: Counts) => c.vp + c.fn ? c.vp / (c.vp + c.fn) : 0;
export const precision = (c: Counts) => c.vp + c.fp ? c.vp / (c.vp + c.fp) : 0;
export const cost = (c: Counts, cfp: number, cfn: number) => cfp * c.fp + cfn * c.fn;

export function prepare(data: DashboardData): Prepared {
  const { y_true: labels, proba: probabilities, proba_B: weighted } = data.datos_dashboard;
  // Sort once per loaded dashboard; chart controls only recompute costs.
  const descending = Array.from(probabilities.keys()).sort((a, b) => probabilities[b] - probabilities[a] || a - b);
  const positive = labels.reduce((sum, y) => sum + (y === 1 ? 1 : 0), 0);
  const negative = labels.length - positive;
  const cumulativeTP = new Uint32Array(labels.length + 1);
  for (let i = 0; i < descending.length; i++) cumulativeTP[i + 1] = cumulativeTP[i] + (labels[descending[i]] === 1 ? 1 : 0);
  function counts(threshold: number): Counts {
    let lo = 0, hi = descending.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (probabilities[descending[mid]] >= threshold) lo = mid + 1;
      else hi = mid;
    }
    const vp = cumulativeTP[lo], fp = lo - vp;
    return { vn: negative - fp, fp, fn: positive - vp, vp };
  }
  function weightedCounts(threshold: number): Counts {
    let vp = 0, fp = 0;
    weighted.forEach((p, i) => { if (p >= threshold) { if (labels[i] === 1) vp++; else fp++; } });
    return { vn: negative - fp, fp, fn: positive - vp, vp };
  }
  const curve: CurvePoint[] = Array.from({ length: 201 }, (_, i) => ({ threshold: i / 200, counts: counts(i / 200) }));

  // A stable sort and one point per group of tied scores matches sklearn's ROC grouping.
  const roc: RocPoint[] = [{ fpr: 0, tpr: 0, threshold: Infinity }];
  for (let i = 0; i < descending.length; i++) {
    if (i === descending.length - 1 || probabilities[descending[i]] !== probabilities[descending[i + 1]]) {
      const predicted = i + 1, tp = cumulativeTP[predicted];
      roc.push({ fpr: (predicted - tp) / negative, tpr: tp / positive, threshold: probabilities[descending[i]] });
    }
  }
  let auc = 0;
  for (let i = 1; i < roc.length; i++) auc += (roc[i].fpr - roc[i - 1].fpr) * (roc[i].tpr + roc[i - 1].tpr) / 2;

  // pandas qcut(proba, 10, duplicates='drop'): linear-interpolated quantiles, right-closed intervals.
  const sorted = descending.map(i => probabilities[i]).reverse();
  const quantile = (q: number) => {
    const at = (sorted.length - 1) * q, low = Math.floor(at), fraction = at - low;
    return sorted[low] + (sorted[Math.ceil(at)] - sorted[low]) * fraction;
  };
  const edges = Array.from({ length: 11 }, (_, i) => quantile(i / 10)).filter((value, i, all) => i === 0 || value !== all[i - 1]);
  const buckets = Array.from({ length: edges.length - 1 }, () => ({ sum: 0, positives: 0, n: 0 }));
  let bucket = 0;
  for (let position = descending.length - 1; position >= 0; position--) {
    const index = descending[position], p = probabilities[index];
    while (bucket < buckets.length - 1 && p > edges[bucket + 1]) bucket++;
    buckets[bucket].sum += p; buckets[bucket].positives += labels[index]; buckets[bucket].n++;
  }
  const calibration: CalibrationPoint[] = buckets.filter(b => b.n > 0).map(b => ({
    proba_media: b.sum / b.n, tasa_real: b.positives / b.n, n: b.n,
  }));
  const mean = probabilities.reduce((sum, p) => sum + p, 0) / probabilities.length;
  return { counts, weightedCounts, curve, roc, auc, calibration, min: sorted[0], mean, prevalence: positive / labels.length, negative, positive };
}

export function simulatedStrategies(prepared: Prepared, threshold: number, cfp: number, cfn: number, modelB: string) {
  const theoretical = cfp / (cfp + cfn);
  const minPoint = prepared.curve.reduce((best, point) => cost(point.counts, cfp, cfn) < cost(best.counts, cfp, cfn) ? point : best);
  const base = cost(prepared.counts(0.5), cfp, cfn);
  const scenarios: [string, Counts][] = [
    ['No hacer nada (todo 0)', { vn: prepared.negative, fp: 0, fn: prepared.positive, vp: 0 }],
    ['Umbral 0,5', prepared.counts(0.5)],
    [`Umbral teórico (${fixed(theoretical)})`, prepared.counts(theoretical)],
    [`Mínimo retrospectivo en test (${fixed(minPoint.threshold, 2)})`, minPoint.counts],
    [`Umbral manual (${fixed(threshold, 2)})`, prepared.counts(threshold)],
    [`Modelo con pesos – Etapa B (${modelB}, 0,5)`, prepared.weightedCounts(0.5)],
  ];
  const rows: Strategy[] = scenarios.map(([Estrategia, counts]) => ({
    Estrategia, VN: counts.vn, FP: counts.fp, FN: counts.fn, VP: counts.vp,
    Recall: recall(counts), Precision: precision(counts),
    Costo_total: cost(counts, cfp, cfn), Ahorro_vs_0_5: base - cost(counts, cfp, cfn),
  }));
  const rocMinimum = prepared.roc.reduce((best, point) => {
    const pointCost = cfn * prepared.positive * (1 - point.tpr) + cfp * prepared.negative * point.fpr;
    const bestCost = cfn * prepared.positive * (1 - best.tpr) + cfp * prepared.negative * best.fpr;
    return pointCost < bestCost ? point : best;
  });
  return { rows, minPoint, theoretical, base, rocMinimum, slope: cfp * prepared.negative / (cfn * prepared.positive) };
}
