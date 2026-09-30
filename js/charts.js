const palette = ['#087f5b','#375a7f','#e09f3e','#8f5aa8'];

export function lineChart(canvas, series, {baseline = true, signed = false} = {}) {
  const ctx = canvas.getContext('2d');
  const labels = [...new Set(series.flatMap(item => item.labels))].sort();
  const points = series.map(item => new Map(item.labels.map((label, index) => [label, item.values[index]])));
  let visible = series.map(() => true);
  const legend = canvas.closest('.chart-shell').querySelector('.chart-legend');
  legend.innerHTML = series.map((s,i) => `<button class="legend-item" aria-pressed="true" data-i="${i}"><i style="background:${palette[i]}"></i>${s.name}</button>`).join('');
  legend.onclick = event => { const button = event.target.closest('button'); if (!button) return; const i = +button.dataset.i; visible[i] = !visible[i]; button.setAttribute('aria-pressed', visible[i]); draw(); };
  const tooltip = canvas.closest('.chart-shell').querySelector('.chart-tooltip');

  function draw(hoverIndex = -1) {
    const ratio = devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio; canvas.height = rect.height * ratio; ctx.scale(ratio, ratio);
    const w=rect.width,h=rect.height,p={l:48,r:20,t:20,b:36};
    const values=series.flatMap((s,i)=>visible[i]?s.values:[]), min=signed?Math.min(-5,...values):Math.min(90,...values), max=Math.max(110,...values);
    const x=i=>p.l+i*(w-p.l-p.r)/Math.max(1,labels.length-1), y=v=>p.t+(max-v)*(h-p.t-p.b)/(max-min);
    ctx.clearRect(0,0,w,h); ctx.font='12px Inter, sans-serif'; ctx.fillStyle='#66736e'; ctx.strokeStyle='#dce5e1'; ctx.lineWidth=1;
    for(let i=0;i<5;i++){const v=min+(max-min)*i/4;ctx.beginPath();ctx.moveTo(p.l,y(v));ctx.lineTo(w-p.r,y(v));ctx.stroke();ctx.fillText(v.toFixed(0),8,y(v)+4)}
    if(baseline && min<=100 && max>=100){ctx.save();ctx.strokeStyle='#6b7772';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(p.l,y(100));ctx.lineTo(w-p.r,y(100));ctx.stroke();ctx.restore()}
    series.forEach((s,si)=>{if(!visible[si])return;ctx.strokeStyle=palette[si];ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.beginPath();let started=false;labels.forEach((label,i)=>{const v=points[si].get(label);if(v==null){started=false;return}started?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v));started=true});ctx.stroke()});
    const step=Math.max(1,Math.ceil(labels.length/(w<600?4:8))); labels.forEach((label,i)=>{if(i%step===0||i===labels.length-1){ctx.fillStyle='#66736e';ctx.textAlign='center';ctx.fillText(label.slice(5)+'/'+label.slice(2,4),x(i),h-12)}});
    if(hoverIndex>=0){ctx.strokeStyle='#1e2b26';ctx.beginPath();ctx.moveTo(x(hoverIndex),p.t);ctx.lineTo(x(hoverIndex),h-p.b);ctx.stroke()}
  }
  canvas.onmousemove=e=>{const r=canvas.getBoundingClientRect(),i=Math.max(0,Math.min(labels.length-1,Math.round((e.clientX-r.left-48)*(labels.length-1)/(r.width-68)))),label=labels[i];draw(i);tooltip.hidden=false;tooltip.style.left=`${Math.min(r.width-190,Math.max(8,e.clientX-r.left+12))}px`;tooltip.style.top='8px';tooltip.innerHTML=`<strong>${label}</strong>${series.map((s,j)=>{const value=points[j].get(label);return visible[j]&&value!=null?`<span><i style="background:${palette[j]}"></i>${s.name}: <b>${value.toFixed(1)}</b></span>`:''}).join('')}`};
  canvas.onmouseleave=()=>{tooltip.hidden=true;draw()}; new ResizeObserver(()=>draw()).observe(canvas); draw();
}
