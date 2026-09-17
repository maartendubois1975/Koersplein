async function wireBrusselsHome(){
  const nav=document.querySelector('#market-navigation');
  if(!nav)return;
  let count=null;
  try{const r=await fetch('data/euronext-brussels.json');if(r.ok){const d=await r.json();count=Array.isArray(d.shares)?d.shares.length:null;}}catch(_){ }
  const apply=()=>{
    const cards=[...nav.querySelectorAll('.market-card')];
    const card=cards.find(a=>a.querySelector('strong')?.textContent.trim()==='Brussel');
    if(!card)return;
    if(card.tagName==='A') card.setAttribute('href','brussel.html');
    const span=card.querySelector('span');
    if(span&&count!==null) span.innerHTML=`${count} aandelen <i>→</i>`;
  };
  apply();
  new MutationObserver(apply).observe(nav,{childList:true,subtree:true});
}
wireBrusselsHome();
