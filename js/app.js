import {toBase100, validateDataset, accumulated, monthly, yearly, realSalary, gap, formatPercent, formatIndex, formatPeriod} from './calculations.js';
import {lineChart} from './charts.js';

const CONFIG = { demoMode: true };
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value);
async function loadData(file){const response=await fetch(new URL(`../data/${file}`,import.meta.url));if(!response.ok)throw new Error(`No se pudo cargar ${file}`);return response.json()}

function sourceLink(series){return series.sourceUrl?`<a href="${series.sourceUrl}" target="_blank" rel="noopener">${series.sourceName}</a>`:series.sourceName}
function metricCard(id,title,primary,details,period,series){return `<article class="metric-card" id="${id}"><div class="eyebrow">${title}</div><strong class="metric-value">${primary}</strong>${details.map(([k,v,c=''])=>`<div class="metric-row"><span>${k}</span><b class="${c}">${v}</b></div>`).join('')}<footer>Último dato disponible: ${formatPeriod(period)}<br>Fuente: ${sourceLink(series)}</footer></article>`}

async function init(){
  try {
    const [inflation,salaries,employment,agreements]=await Promise.all(['inflacion.json','salarios.json','empleo.json','paritarias.json'].map(loadData));
    if (CONFIG.demoMode !== Boolean(inflation.demo || salaries.demo)) throw new Error('CONFIG.demoMode no coincide con el estado de los archivos');
    validateDataset(inflation,{allowDemo:CONFIG.demoMode}); validateDataset(salaries,{allowDemo:CONFIG.demoMode});
    $('#demo-banner').hidden=!CONFIG.demoMode; const series=Object.fromEntries([...inflation.series,...salaries.series].map(s=>[s.id,{...s,observations:toBase100(s.observations)}]));
    const salarySeries=series.salario_publico, salary=salarySeries.observations, ipc=series.ipc.observations, food=series.alimentos.observations, services=series.servicios.observations, real=realSalary(salary,ipc);
    $('#metrics').innerHTML=[
      metricCard('card-salary','Salario público',formatIndex(salary.at(-1).value),[['Desde dic. 2023',formatPercent(accumulated(salary))]],salary.at(-1).period,salarySeries),
      metricCard('card-ipc','Inflación general',formatIndex(ipc.at(-1).value),[['Variación mensual',formatPercent(monthly(ipc))],['Interanual',formatPercent(yearly(ipc))],['Desde dic. 2023',formatPercent(accumulated(ipc))]],ipc.at(-1).period,series.ipc),
      metricCard('card-food','Inflación en alimentos',formatIndex(food.at(-1).value),[['Variación mensual',formatPercent(monthly(food))],['Desde dic. 2023',formatPercent(accumulated(food))]],food.at(-1).period,series.alimentos),
      metricCard('card-services','Inflación en servicios',formatIndex(services.at(-1).value),[['Variación mensual',formatPercent(monthly(services))],['Desde dic. 2023',formatPercent(accumulated(services))]],services.at(-1).period,series.servicios),
      metricCard('card-real','Salario real estatal',formatIndex(real.at(-1).value),[[real.at(-1).value<100?'Pérdida de poder adquisitivo':'Ganancia de poder adquisitivo',formatPercent(real.at(-1).value-100),real.at(-1).value<100?'negative':'positive']],real.at(-1).period,{sourceName:'Cálculo monitoreATE',sourceUrl:'#metodologia'})].join('');
    const chartSeries=[['Salario público',salary],['IPC general',ipc],['IPC alimentos',food],['IPC servicios',services]].map(([name,o])=>({name,labels:o.map(x=>x.period),values:o.map(x=>x.value)}));
    lineChart($('#main-chart'),chartSeries); lineChart($('#real-chart'),[{name:'Salario real',labels:real.map(x=>x.period),values:real.map(x=>x.value)}]);
    const gapsGeneral=gap(salary,ipc),gapsFood=gap(salary,food); lineChart($('#gap-chart'),[['Brecha vs IPC',gapsGeneral],['Brecha vs alimentos',gapsFood]].map(([name,o])=>({name,labels:o.map(x=>x.period),values:o.map(x=>x.value)})),{baseline:false,signed:true});
    setupCalculator({ipc,alimentos:food}); setupDataTable(series); renderAgreements(agreements); $('#employment-status').textContent=employment.series.length?'Series disponibles':'Datos pendientes de incorporación';
    $('#method-update').textContent=new Date().toLocaleDateString('es-AR',{timeZone:'UTC'});
  } catch(error){console.error(error);$('#load-error').hidden=false;$('#load-error').textContent='No fue posible cargar los datos. Ejecutá el sitio mediante un servidor local.'}
}

function setupCalculator(series){const form=$('#calculator');form.onsubmit=e=>{e.preventDefault();const base=Number($('#base-salary').value),current=Number($('#current-salary').value||0),indicator=$('#calc-index').value,data=series[indicator],target=base*data.at(-1).value/100,difference=current-target,percent=current?difference/target*100:null;$('#calculator-result').hidden=false;$('#calculator-result').innerHTML=`<span>Para mantener el mismo poder adquisitivo de diciembre de 2023, hoy deberías cobrar:</span><strong>${money(target)}</strong>${current?`<div class="comparison ${difference<0?'negative':'positive'}">${difference<0?'Pérdida':'Ganancia'}: ${money(Math.abs(difference))} (${formatPercent(Math.abs(percent))})</div>`:'<small>Ingresá tu salario actual para calcular la diferencia.</small>'}`}}
function setupDataTable(series){const select=$('#data-select');select.innerHTML=Object.values(series).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');const render=()=>{const s=series[select.value];$('#data-body').innerHTML=s.observations.map(o=>`<tr><td>${s.name}</td><td>${o.period}</td><td>${formatIndex(o.value)}</td><td>${s.sourceName}</td><td>${s.lastUpdated}</td></tr>`).join('')};select.onchange=render;render();$('#download-csv').onclick=()=>{const s=series[select.value],rows=[['indicador','periodo','valor','fuente','actualizado'],...s.observations.map(o=>[s.name,o.period,o.value.toFixed(2),s.sourceName,s.lastUpdated])],blob=new Blob([rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`monitoreate-${s.id}.csv`;a.click();URL.revokeObjectURL(a.href)}}
function renderAgreements(data){$('#agreements-body').innerHTML=data.agreements.length?data.agreements.map(a=>`<tr><td>${a.date}</td><td>${a.period}</td><td>${a.increase}</td><td>${a.accumulated}</td><td>${a.inflation}</td><td>${a.gap}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">Datos pendientes de incorporación</td></tr>'}
$('#menu-button').onclick=()=>{const nav=$('#site-nav');nav.classList.toggle('open');$('#menu-button').setAttribute('aria-expanded',nav.classList.contains('open'))};document.querySelectorAll('#site-nav a').forEach(a=>a.onclick=()=>$('#site-nav').classList.remove('open'));init();
