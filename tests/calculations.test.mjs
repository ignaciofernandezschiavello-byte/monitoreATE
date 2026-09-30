import assert from 'node:assert/strict';
import {toBase100, validateDataset, realSalary} from '../js/calculations.js';
const observations = [
  {period:'2023-12',officialValue:200,indexDec2023:100},
  {period:'2024-01',officialValue:250,indexDec2023:125}
];
assert.deepEqual(toBase100(observations).map(x=>x.value),[100,125]);
assert.equal(validateDataset({demo:false,series:[{id:'test',sourceName:'INDEC',sourceUrl:'https://www.indec.gob.ar/',lastUpdated:'2024-02-01',observations}]}),true);
assert.deepEqual(realSalary(toBase100(observations),[{period:'2023-12',value:100}]),[{period:'2023-12',value:100}]);
assert.throws(()=>validateDataset({demo:true,series:[]}),/DEMO/);
assert.throws(()=>validateDataset({demo:false,series:[{id:'bad',sourceName:'INDEC',sourceUrl:'x',lastUpdated:'x',observations:[...observations,observations[1]]}]}),/duplicados/);
console.log('OK calculations');
