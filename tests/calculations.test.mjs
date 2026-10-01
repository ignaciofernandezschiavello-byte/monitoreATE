import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {toBase100, validateDataset, realSalary, monthly, compoundIncrease, effectiveAgreements} from '../js/calculations.js';
const observations = [
  {period:'2023-12',officialValue:200,indexDec2023:100},
  {period:'2024-01',officialValue:250,indexDec2023:125}
];
assert.deepEqual(toBase100(observations).map(x=>x.value),[100,125]);
assert.equal(validateDataset({demo:false,series:[{id:'test',sourceName:'INDEC',sourceUrl:'https://www.indec.gob.ar/',lastUpdated:'2024-02-01',observations}]}),true);
assert.deepEqual(realSalary(toBase100(observations),[{period:'2023-12',value:100}]),[{period:'2023-12',value:100}]);
assert.ok(Math.abs(monthly([{period:'2023-12',officialValue:3},{period:'2024-01',officialValue:4}]) - 100/3) < 1e-12);
assert.throws(()=>validateDataset({demo:true,series:[]}),/DEMO/);
assert.throws(()=>validateDataset({demo:false,series:[{id:'bad',sourceName:'INDEC',sourceUrl:'x',lastUpdated:'x',observations:[...observations,observations[1]]}]}),/duplicados/);
const paritarias=JSON.parse(await readFile(new URL('../data/paritarias.json',import.meta.url),'utf8'));
const localDate=(year,month,day)=>new Date(year,month-1,day,12);
const september=effectiveAgreements(paritarias.agreements,localDate(2026,9,30));
const october=effectiveAgreements(paritarias.agreements,localDate(2026,10,1));
assert.equal(september.at(-1).period,'2026-09');
assert.equal(october.at(-1).period,'2026-10');
assert.ok(Math.abs(compoundIncrease(paritarias.agreements.slice(0,5))-10.2965)<0.001);
assert.ok(Math.abs(compoundIncrease(paritarias.agreements.slice(0,8))-17.6216)<0.001);
assert.ok(Math.abs(compoundIncrease(september)-19.8564)<0.001);
assert.ok(Math.abs(compoundIncrease(paritarias.agreements)-25.8255)<0.001);
assert.deepEqual(paritarias.extraordinaryPayments.map(item=>item.amount),[40000,80000]);
console.log('OK calculations');
