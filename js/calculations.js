export function toBase100(observations, basePeriod = '2023-12') {
  const original = item => item.officialValue ?? item.value;
  const baseItem = observations.find(item => item.period === basePeriod);
  const base = baseItem && original(baseItem);
  if (!Number.isFinite(base) || base === 0) throw new Error(`Falta un valor oficial válido para ${basePeriod}`);
  return observations.map(item => ({ ...item, value: original(item) / base * 100 }));
}

export function validateDataset(dataset, {allowDemo = false} = {}) {
  if (!allowDemo && dataset.demo) throw new Error('El conjunto contiene datos DEMO');
  for (const series of dataset.series) {
    if ((!series.sourceName || !series.sourceUrl || !series.lastUpdated) && !dataset.demo) throw new Error(`${series.id}: faltan metadatos de fuente`);
    const periods = series.observations.map(item => item.period);
    if (!periods.includes('2023-12')) throw new Error(`${series.id}: falta diciembre de 2023`);
    if (new Set(periods).size !== periods.length) throw new Error(`${series.id}: existen períodos duplicados`);
    if (periods.some((period, index) => index && period <= periods[index - 1])) throw new Error(`${series.id}: los períodos no están ordenados`);
    const field = dataset.demo ? 'value' : 'officialValue';
    if (series.observations.some(item => !Number.isFinite(item[field]))) throw new Error(`${series.id}: existe un valor oficial nulo o inválido`);
    const rebased = toBase100(series.observations);
    if (rebased.find(item => item.period === '2023-12').value !== 100) throw new Error(`${series.id}: la base no resulta exactamente 100`);
    series.observations.forEach((item, index) => {
      if (item.indexDec2023 != null && Math.abs(item.indexDec2023 - rebased[index].value) > 1e-8) throw new Error(`${series.id}: índice almacenado inconsistente en ${item.period}`);
    });
  }
  return true;
}

export const change = (current, previous) => previous ? (current / previous - 1) * 100 : null;
const original = observation => observation?.officialValue ?? observation?.value;
export const accumulated = observations => change(original(observations.at(-1)), original(observations[0]));
export const monthly = observations => change(original(observations.at(-1)), original(observations.at(-2)));
export const yearly = observations => observations.length > 12 ? change(original(observations.at(-1)), original(observations.at(-13))) : null;

export function alignAndCalculate(a, b, operation) {
  const bByPeriod = new Map(b.map(item => [item.period, item.value]));
  return a.filter(item => bByPeriod.has(item.period)).map(item => ({period: item.period, value: operation(item.value, bByPeriod.get(item.period))}));
}

export const realSalary = (salary, prices) => alignAndCalculate(salary, prices, (s, p) => s / p * 100);
export const gap = (salary, prices) => alignAndCalculate(salary, prices, (s, p) => s - p);
export const formatPercent = value => value == null ? 'Pendiente' : `${value >= 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`;
export const formatIndex = value => value == null ? '—' : value.toFixed(1).replace('.', ',');
export const formatPeriod = period => new Intl.DateTimeFormat('es-AR', {month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(`${period}-02T00:00:00Z`));
