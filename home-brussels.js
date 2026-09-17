async function wireBrusselsHome(){
  const nav=document.querySelector('#market-navigation');
  if(!nav)return;
  let count=133;
  try{
    const r=await fetch('data/euronext-brussels.json?v=brussels-live',{cache:'no-store'});
    if(r.ok){const d=await r.json();if(Array.isArray(d.shares))count=d.shares.length;}
  }catch(_){ }

  const apply=()=>{
    const cards=[...nav.children];
    const old=cards.find(el=>el.querySelector('strong')?.textContent.trim()==='Brussel');
    if(!old)return;
    if(old.tagName==='A'&&old.classList.contains('active')&&old.getAttribute('href')==='brussel.html'&&old.querySelector('span')?.textContent.includes(`${count} aandelen`))return;
    const card=document.createElement('a');
    card.className='market-card active';
    card.href='brussel.html';
    card.innerHTML=`<small>België · XBRU</small><strong>Brussel</strong><span>${count} aandelen <i>→</i></span>`;
    old.replaceWith(card);
    const venueCount=document.querySelector('#venue-market-count');
    if(venueCount)venueCount.textContent='2';
  };

  apply();
  const observer=new MutationObserver(()=>apply());
  observer.observe(nav,{childList:true});
  setTimeout(apply,250);
  setTimeout(apply,1000);
}
wireBrusselsHome();
