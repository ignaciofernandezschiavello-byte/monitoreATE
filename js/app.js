import {toBase100, validateDataset, accumulated, monthly, yearly, realSalary, gap, formatPercent, formatIndex, formatPeriod, compoundIncrease, effectiveAgreements, isPeriodEffective} from './calculations.js?v=20261001-1';
import {lineChart} from './charts.js?v=20261001-1';

const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value);
const people = value => new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(value);
const signedPeople = value => new Intl.NumberFormat('es-AR',{maximumFractionDigits:0,signDisplay:'exceptZero'}).format(value);
const employmentPercent = value => value == null?'—':`${new Intl.NumberFormat('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1,signDisplay:'exceptZero'}).format(value)} %`;
async function loadData(file){const url=new URL(`../data/${file}`,import.meta.url);if(file==='paritarias.json')url.searchParams.set('v','20261001-1');const response=await fetch(url);if(!response.ok)throw new Error(`No se pudo cargar ${file}`);return response.json()}

function sourceLink(series){return series.sourceUrl?`<a href="${series.sourceUrl}" target="_blank" rel="noopener">${series.sourceName}</a>`:series.sourceName}
function metricCard(id,title,primary,details,period,series){return `<article class="metric-card" id="${id}"><div class="eyebrow">${title}</div><strong class="metric-value">${primary}</strong>${details.map(([k,v,c=''])=>`<div class="metric-row"><span>${k}</span><b class="${c}">${v}</b></div>`).join('')}<footer>Último dato disponible: ${formatPeriod(period)}<br>Fuente: ${sourceLink(series)}</footer></article>`}

async function init(){
  try {
    const agreements=await loadData('paritarias.json');
    renderAgreements(agreements);
    const [inflation,salaries,employment]=await Promise.all(['inflacion.json','salarios.json','empleo.json'].map(loadData));
    validateDataset(inflation); validateDataset(salaries);
    const series=Object.fromEntries([...inflation.series,...salaries.series].map(s=>[s.id,{...s,observations:toBase100(s.observations)}]));
    const salarySeries=series.salario_publico, salary=salarySeries.observations, ipc=series.ipc.observations, food=series.alimentos.observations, services=series.servicios.observations, real=realSalary(salary,ipc);
    $('#metrics').innerHTML=[
      metricCard('card-salary','Salario público',formatIndex(salary.at(-1).value),[['Desde dic. 2023',formatPercent(accumulated(salary))]],salary.at(-1).period,salarySeries),
      metricCard('card-ipc','Inflación general',formatIndex(ipc.at(-1).value),[['Variación mensual',formatPercent(monthly(ipc))],['Interanual',formatPercent(yearly(ipc))],['Desde dic. 2023',formatPercent(accumulated(ipc))]],ipc.at(-1).period,series.ipc),
      metricCard('card-food','Inflación en alimentos',formatIndex(food.at(-1).value),[['Variación mensual',formatPercent(monthly(food))],['Desde dic. 2023',formatPercent(accumulated(food))]],food.at(-1).period,series.alimentos),
      metricCard('card-services','Inflación en servicios',formatIndex(services.at(-1).value),[['Variación mensual',formatPercent(monthly(services))],['Desde dic. 2023',formatPercent(accumulated(services))]],services.at(-1).period,series.servicios),
      metricCard('card-real','Salario real estatal',formatIndex(real.at(-1).value),[[real.at(-1).value<100?'Pérdida de poder adquisitivo':'Ganancia de poder adquisitivo',formatPercent(real.at(-1).value-100),real.at(-1).value<100?'negative':'positive']],real.at(-1).period,{sourceName:'INDEC (cálculo monitoreATE)',sourceUrl:'#metodologia'})].join('');
    const chartSeries=[['Salario público',salary],['IPC general',ipc],['IPC alimentos',food],['IPC servicios',services]].map(([name,o])=>({name,labels:o.map(x=>x.period),values:o.map(x=>x.value)}));
    lineChart($('#main-chart'),chartSeries); lineChart($('#real-chart'),[{name:'Salario real',labels:real.map(x=>x.period),values:real.map(x=>x.value)}]);
    const gapsGeneral=gap(salary,ipc),gapsFood=gap(salary,food); lineChart($('#gap-chart'),[['Brecha vs IPC',gapsGeneral],['Brecha vs alimentos',gapsFood]].map(([name,o])=>({name,labels:o.map(x=>x.period),values:o.map(x=>x.value)})),{baseline:false,signed:true});
    setupCalculator({ipc,alimentos:food}); setupDataTable(series); setupEmployment(employment);
    $('#method-update').textContent=new Date().toLocaleDateString('es-AR',{timeZone:'UTC'});
  } catch(error){console.error(error);$('#load-error').hidden=false;$('#load-error').textContent='No fue posible cargar los datos. Ejecutá el sitio mediante un servidor local.'}
}

function setupEmployment(data){
  if(data.demo!==false||data.source!=='INDEC'||data.basePeriod!=='2023-12'||!data.series.length)throw new Error('Serie de empleo inválida');
  const observations=data.series,last=observations.at(-1),periods=observations.map(item=>item.period);
  if(data.latestPeriod!==last.period||new Set(periods).size!==periods.length||periods.some((period,index)=>index&&period<=periods[index-1])||observations.some(item=>!Number.isFinite(item.value)||item.value<=0))throw new Error('Serie de empleo inconsistente');
  const card=(title,value,secondary,footer)=>`<article class="metric-card"><div class="eyebrow">${title}</div><strong class="metric-value">${value}</strong>${secondary?`<div class="employment-secondary">${secondary}</div>`:''}<footer>${footer}</footer></article>`;
  $('#employment-metrics').innerHTML=[
    card('Dotación actual',`${people(last.value)} <small>personas</small>`,'',`Último dato: ${formatPeriod(last.period)}`),
    card('Variación desde dic. 2023',`${signedPeople(last.changeFromBase)} <small>personas</small>`,employmentPercent(last.changeFromBasePct),'Referencia: diciembre de 2023'),
    card('Variación último mes',`${signedPeople(last.monthlyChange)} <small>personas</small>`,employmentPercent(last.monthlyChangePct),`Variación de ${formatPeriod(last.period)}`)
  ].join('');
  const tooltip=(label,index)=>{const item=observations[index],monthly=item.monthlyChange==null?'—':`${signedPeople(item.monthlyChange)} personas`,fromBase=`${signedPeople(item.changeFromBase)} personas`;return `<strong>${formatPeriod(label)}${item.estimatedByImputation?' (i)':''}</strong><span>Dotación: <b>${people(item.value)} personas</b></span><span>Variación mensual: <b>${monthly}</b></span><span>Variación mensual %: <b>${employmentPercent(item.monthlyChangePct)}</b></span><span>Variación desde dic. 2023: <b>${fromBase}</b></span><span>Variación desde dic. 2023 %: <b>${employmentPercent(item.changeFromBasePct)}</b></span>`};
  lineChart($('#employment-chart'),[{name:'Dotación',labels:periods,values:observations.map(item=>item.value)}],{baseline:false,dataScale:true,valueFormatter:value=>new Intl.NumberFormat('es-AR',{notation:'compact',maximumFractionDigits:0}).format(value),tooltipBuilder:tooltip});
  $('#employment-body').innerHTML=observations.map(item=>`<tr><td>${formatPeriod(item.period)}${item.estimatedByImputation?' (i)':''}</td><td>${people(item.value)}</td><td>${item.monthlyChange==null?'—':signedPeople(item.monthlyChange)}</td><td>${employmentPercent(item.monthlyChangePct)}</td><td>${signedPeople(item.changeFromBase)}</td><td>${employmentPercent(item.changeFromBasePct)}</td></tr>`).join('');
  $('#download-employment-csv').onclick=()=>{const fields=['period','value','monthlyChange','monthlyChangePct','changeFromBase','changeFromBasePct'],rows=[fields,...observations.map(item=>fields.map(field=>item[field]??''))],blob=new Blob([rows.map(row=>row.map(value=>`"${value}"`).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='monitoreate-empleo.csv';link.click();URL.revokeObjectURL(link.href)};
}

function setupCalculator(series){const form=$('#calculator');form.onsubmit=e=>{e.preventDefault();const base=Number($('#base-salary').value),current=Number($('#current-salary').value||0),indicator=$('#calc-index').value,data=series[indicator],target=base*data.at(-1).value/100,difference=current-target,percent=current?difference/target*100:null;$('#calculator-result').hidden=false;$('#calculator-result').innerHTML=`<span>Para mantener el mismo poder adquisitivo de diciembre de 2023, hoy deberías cobrar:</span><strong>${money(target)}</strong>${current?`<div class="comparison ${difference<0?'negative':'positive'}">${difference<0?'Pérdida':'Ganancia'}: ${money(Math.abs(difference))} (${formatPercent(Math.abs(percent))})</div>`:'<small>Ingresá tu salario actual para calcular la diferencia.</small>'}`}}
function setupDataTable(series){const select=$('#data-select');select.innerHTML=Object.values(series).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');const render=()=>{const s=series[select.value];$('#data-body').innerHTML=s.observations.map(o=>`<tr><td>${s.name}</td><td>${o.period}</td><td>${o.officialValue.toLocaleString('es-AR',{maximumFractionDigits:4})}</td><td>${formatIndex(o.value)}</td><td>${s.sourceName}</td><td>${s.lastUpdated}</td></tr>`).join('')};select.onchange=render;render();$('#download-csv').onclick=()=>{const s=series[select.value],rows=[['indicador','periodo','valor_oficial_indec','indice_monitoreate_dic_2023_100','fuente','actualizado'],...s.observations.map(o=>[s.name,o.period,o.officialValue,o.value,s.sourceName,s.lastUpdated])],blob=new Blob([rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`monitoreate-${s.id}.csv`;a.click();URL.revokeObjectURL(a.href)}}
function renderAgreements(data){
  const today=new Date(),effective=effectiveAgreements(data.agreements,today),agreed=compoundIncrease(data.agreements),current=compoundIncrease(effective),last=effective.at(-1);
  const percent=value=>`${value.toFixed(1).replace('.',',')} %`;
  const extrasEffective=data.extraordinaryPayments.filter(item=>isPeriodEffective(item.period,today));
  const lastExtra=extrasEffective.at(-1),futureExtras=data.extraordinaryPayments.filter(item=>!isPeriodEffective(item.period,today));
  $('#agreement-metrics').innerHTML=[
    ['Último acuerdo',last?formatPeriod(last.period):'—',last?`${percent(last.percent)} · ${last.source.label}`:'Sin tramos vigentes'],
    ['Aumento del mes',last?percent(last.percent):'—',last?formatPeriod(last.period):'Sin tramos vigentes'],
    ['Acumulado vigente',percent(current),last?`Hasta ${formatPeriod(last.period)}${lastExtra?` · Extraordinario: ${money(lastExtra.amount)}`:''}`:'Sin tramos vigentes'],
    ['Acumulado acordado 2026',percent(agreed),`Extraordinarios: ${data.extraordinaryPayments.map(item=>`${money(item.amount)} en ${formatPeriod(item.period)}`).join(' · ')}${futureExtras.length?' · Incluye pagos futuros':''}`]
  ].map(([title,value,note])=>`<article class="agreement-card"><div class="eyebrow">${title}</div><strong>${value}</strong><small>${note}</small></article>`).join('');
  let factor=1;
  const cumulative=data.agreements.map(item=>({period:item.period,value:(factor*=1+item.percent/100,factor*100-100)}));
  lineChart($('#agreements-monthly-chart'),[{name:'Aumento mensual',labels:data.agreements.map(item=>item.period),values:data.agreements.map(item=>item.percent)}],{baseline:false,signed:true});
  lineChart($('#agreements-cumulative-chart'),[{name:'Acumulado acordado',labels:cumulative.map(item=>item.period),values:cumulative.map(item=>item.value)}],{baseline:false,signed:true});
  $('#agreements-body').innerHTML=data.agreements.map((item,index)=>{const effectiveNow=isPeriodEffective(item.period,today),extras=data.extraordinaryPayments.filter(extra=>extra.period===item.period);return `<tr><td>${formatPeriod(item.period)}</td><td>${item.percent.toFixed(1).replace('.',',')} %</td><td>${cumulative[index].value.toFixed(4).replace('.',',')} %</td><td><span class="status-pill ${effectiveNow?'effective':'future'}">${effectiveNow?'Vigente':'Acordado / vigencia futura'}</span></td><td>${extras.length?extras.map(extra=>`${money(extra.amount)} · ${effectiveNow?'pago extraordinario':'pago extraordinario acordado para '+formatPeriod(extra.period)}`).join('<br>'):'—'}</td><td><a href="${item.source.url}" target="_blank" rel="noopener">${item.source.label}</a></td></tr>`}).join('');
}
$('#menu-button').onclick=()=>{const nav=$('#site-nav');nav.classList.toggle('open');$('#menu-button').setAttribute('aria-expanded',nav.classList.contains('open'))};document.querySelectorAll('#site-nav a').forEach(a=>a.onclick=()=>$('#site-nav').classList.remove('open'));init();
