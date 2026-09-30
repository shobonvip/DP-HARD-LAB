const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,limit=30;
try{data=globalThis.PRACTICE_DATA??await(await fetch('/practice-data.json')).json();
 $('#category').innerHTML=data.categories.map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join('');
 for(const id of ['min','max'])$('#'+id).innerHTML=Array.from({length:8},(_,i)=>`<option>${i+5}</option>`).join('');$('#min').value=7;$('#max').value=9;
 $('#coverage').textContent=`解析済み ${data.analyzed.toLocaleString()} / ${data.total.toLocaleString()}譜面。未取得・未解析 ${data.unavailable.length}譜面は推薦から除外。${data.generatedAt.slice(0,10)}生成。`;
 for(const el of document.querySelectorAll('.filters input,.filters select'))el.addEventListener('input',()=>{limit=30;render();});
 $('#more').onclick=()=>{limit+=30;render();};render();
}catch(e){$('#status').textContent='練習データを読み込めませんでした。ページを再読み込みしてください。';console.error(e);}
function render(){
 const id=$('#category').value,cat=data.categories.find(c=>c.id===id),min=+$('#min').value,max=+$('#max').value,q=$('#search').value.toLocaleLowerCase();
 $('#theme').textContent=cat.label;$('#description').textContent=cat.description;
 const loadBased=['stamina','technique'].includes(id);
 const rows=data.rows.filter(r=>r.level>=min&&r.level<=max&&(!$('#difficulty').value||r.difficulty===$('#difficulty').value)&&(!$('#steady').checked||!r.soflan)&&r.title.toLocaleLowerCase().includes(q)&&(loadBased?r.features[id].score>0:r.features[id].count>=3&&r.features[id].sections>=2)).sort((a,b)=>b.features[id].score-a.features[id].score||a.level-b.level||a.id.localeCompare(b.id));
 $('#status').textContent=min>max?'下限を上限以下にしてください。':`${rows.length}譜面の候補 · ${Math.min(limit,rows.length)}件表示（3回以上・2小節以上で検出）`;
 $('#more').hidden=limit>=rows.length;
 if(loadBased&&min<=max)$('#status').textContent=`${rows.length}譜面の候補 · ${Math.min(limit,rows.length)}件表示（鍵盤のみの動作シミュレーション負荷順）`;
 $('#cards').innerHTML=rows.slice(0,limit).map(r=>{const f=r.features[id],unit=['smallStair','largeStair','colorStair'].includes(id)?'列':'回';return `<article class="card"><span class="badge">☆${r.level} · ${esc(r.difficulty)} · 正規</span><h3>${esc(r.title)}</h3><p>${f.count}${unit} / ${f.sections}小節で検出<br>左手 ${f.hands[0]}${unit} · 右手 ${f.hands[1]}${unit}</p><p class="meta">確認箇所：${f.examples.slice(0,3).map(e=>`${e.time.toFixed(1)}秒付近・${e.hand?'右':'左'}${e.keys.join('')||'皿'}`).join(' ／ ')}</p>${r.soflan?'<p class="warning">変速あり：目的の配置以外にも注意</p>':''}${r.holds?'<p class="meta">CN/BSSを含む譜面</p>':''}<a href="${esc(r.sourceUrl)}" target="_blank" rel="noreferrer">TexTageで譜面を確認 ↗</a></article>`;}).join('');
 if(loadBased)for(const [i,card] of [...$('#cards').children].entries()){
  const row=rows[i],load=row.keyboardLoad,tech=id==='technique',offset=tech?3:1;
  const summary=card.querySelector('p');summary.textContent=tech?`技術負荷 平均${load.technicalMean.toFixed(2)} / 上位負荷${load.technicalPeak.toFixed(2)}`:`身体負荷 平均${load.physicalMean.toFixed(2)} / 上位負荷${load.physicalPeak.toFixed(2)}。持続の最長 ${load.longestSeconds.toFixed(0)}秒・低負荷 ${load.restSeconds.toFixed(0)}秒`;
  const evidence=card.querySelector('p.meta');
  evidence.textContent=tech?`認識 ${load.components.recognition.toFixed(2)} ／ 指移動 ${load.components.movement.toFixed(2)} ／ 配置切替 ${load.components.switching.toFixed(2)} ／ 拡張 ${load.components.extension.toFixed(2)}（動作平均）`:`持続の基準は、この曲の上位25%負荷×65%（${load.threshold.toFixed(2)}）。持久力の実測値ではありません。`;
  const scale=Math.max(.1,...load.timeline.flatMap(b=>[b[offset],b[offset+1]])),width=300,height=80;
  const lines=[0,1].map(hand=>load.timeline.map(b=>`${(b[0]/row.duration*width).toFixed(1)},${(height-b[offset+hand]/scale*height).toFixed(1)}`).join(' '));
  const panel=document.createElement('div');panel.className='load-plot';
  panel.innerHTML=`<svg viewBox="0 0 300 80" role="img" aria-label="${tech?'技術':'身体'}負荷の時間推移。左手は緑、右手は黄。詳しい数値は下の表。"><polyline points="${lines[0]}" fill="none" stroke="#88e1d3" stroke-width="2"/><polyline points="${lines[1]}" fill="none" stroke="#f4cd86" stroke-width="2"/></svg><p class="meta">0～${row.duration.toFixed(0)}秒 · 左手：緑 / 右手：黄<br>縦軸 0～${scale.toFixed(2)}（曲ごとに調整・モデル単位）</p><details><summary>2秒ごとの負荷を見る</summary><div class="load-table"><table><thead><tr><th>秒</th><th>左手</th><th>右手</th></tr></thead><tbody>${load.timeline.map(b=>`<tr><td>${b[0]}</td><td>${b[offset].toFixed(2)}</td><td>${b[offset+1].toFixed(2)}</td></tr>`).join('')}</tbody></table></div></details>`;
  card.insertBefore(panel,card.querySelector('a'));
 }
 if(id==='independence')for(const [i,card] of [...$('#cards').children].entries()){
  const p=document.createElement('p'),windows=rows[i].features[id].windows;
  p.className='meta';p.textContent=`混フレ候補 ${windows.length}区間：`+windows.slice(0,3).map(w=>`${w.start.toFixed(1)}～${w.end.toFixed(1)}秒（左${w.left}・右${w.right}動作）`).join(' ／ ');
  card.insertBefore(p,card.querySelector('a'));
 }
}
