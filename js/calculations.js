export function toBase100(observations, basePeriod = '2023-12') {
  const base = observations.find(item => item.period === basePeriod)?.value;
  if (!base) return [];
  return observations.map(item => ({ ...item, value: item.value / base * 100 }));
}

export const change = (current, previous) => previous ? (current / previous - 1) * 100 : null;
export const accumulated = observations => change(observations.at(-1)?.value, observations[0]?.value);
export const monthly = observations => change(observations.at(-1)?.value, observations.at(-2)?.value);
export const yearly = observations => observations.length > 12 ? change(observations.at(-1).value, observations.at(-13).value) : null;

export function alignAndCalculate(a, b, operation) {
  const bByPeriod = new Map(b.map(item => [item.period, item.value]));
  return a.filter(item => bByPeriod.has(item.period)).map(item => ({period: item.period, value: operation(item.value, bByPeriod.get(item.period))}));
}

export const realSalary = (salary, prices) => alignAndCalculate(salary, prices, (s, p) => s / p * 100);
export const gap = (salary, prices) => alignAndCalculate(salary, prices, (s, p) => s - p);
export const formatPercent = value => value == null ? 'Pendiente' : `${value >= 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`;
export const formatIndex = value => value == null ? '—' : value.toFixed(1).replace('.', ',');
export const formatPeriod = period => new Intl.DateTimeFormat('es-AR', {month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(`${period}-02T00:00:00Z`));
