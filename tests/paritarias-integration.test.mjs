import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, app, dataText] = await Promise.all([
  read('index.html'),
  read('js/app.js'),
  read('data/paritarias.json')
]);
const data = JSON.parse(dataText);

assert.equal(data.agreements.length, 12, 'Paritarias debe contener enero-diciembre');
assert.deepEqual(data.extraordinaryPayments.map(item => item.amount), [40000, 80000]);

const requiredIds = [
  'agreement-metrics',
  'agreements-monthly-chart',
  'agreements-cumulative-chart',
  'agreements-body'
];
for (const id of requiredIds) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Falta #${id} en index.html`);
  assert.match(app, new RegExp(`['"]#${id}['"]`), `app.js no usa #${id}`);
}

assert.match(app, /renderAgreements\(agreements\)/, 'init no ejecuta el renderer de Paritarias');
assert.match(app, /paritarias\.json/, 'app.js no carga paritarias.json');
assert.doesNotMatch(html + app, /Datos pendientes de incorporación/);
assert.match(html, /app\.js\?v=20261001-1/);
assert.match(app, /searchParams\.set\('v','20261001-1'\)/);

console.log('OK integración estática de Paritarias');
