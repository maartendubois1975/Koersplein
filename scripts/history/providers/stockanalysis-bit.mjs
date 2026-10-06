const SUPPORTED_MICS=new Map([['XMIL','bit'],['MTAA','bit'],['EXGM','bit'],['XPRA','pra'],['XBUL','bul'],['XTAL','tal'],['XRIS','rse'],['XLIT','vse'],['XBRA','bsse'],['XLUX','lux'],['XMAL','mse'],['XCYS','cys'],['XLJU','ljse']]);

export class StockAnalysisBitProvider {
  id='stockanalysis-bit';
  supports(instrument){return SUPPORTED_MICS.has(String(instrument?.mic||'').toUpperCase())&&Boolean(instrument?.symbol||instrument?.ticker)}
  async fetchDaily(instrument,{startDate='1990-01-01',endDate=new Date().toISOString().slice(0,10)}={}){
    const symbol=encodeURIComponent(String(instrument.symbol||instrument.ticker).trim().toUpperCase());
    const venue=SUPPORTED_MICS.get(String(instrument?.mic||'').toUpperCase());
    const bars=[];
    for(let page=1;page<=20;page++){
      const url=`https://stockanalysis.com/quote/${venue}/${symbol}/history/?p=${page}`;
      let r=null;
      for(let attempt=1;attempt<=5;attempt++){
        r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; Koersplein/1.0)','accept':'text/html'}});
        if(r.status!==429)break;
        const retryAfter=Number(r.headers.get('retry-after')||0);
        const waitMs=Math.max(retryAfter*1000,attempt*5000);
        console.log(`STOCKANALYSIS_RATE_LIMIT ${venue}/${symbol} page=${page} attempt=${attempt} waitMs=${waitMs}`);
        await new Promise(resolve=>setTimeout(resolve,waitMs));
      }
      if(!r?.ok){if(page>1&&bars.length)break;throw new Error(`StockAnalysis HTTP ${r?.status||'NO_RESPONSE'} voor ${symbol}`);}
      const html=await r.text();
      const rows=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      let added=0;
      for(const row of rows){
        const cells=[...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>x[1].replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').trim());
        if(cells.length<5)continue;
        const d=new Date(cells[0]);if(Number.isNaN(d.getTime()))continue;
        const date=d.toISOString().slice(0,10);if(date<startDate||date>endDate)continue;
        const nums=cells.slice(1,5).map(v=>Number(v.replace(/,/g,'')));
        if(nums.some(v=>!Number.isFinite(v)||v<=0))continue;
        const volume=Number(String(cells[6]||'0').replace(/,/g,''))||0;
        bars.push({date,open:nums[0],high:nums[1],low:nums[2],close:nums[3],volume});added++;
      }
      if(!added&&page>1)break;
      // StockAnalysis history pages do not expose a reliable next-link on every venue. Continue while rows are found; a later empty/404 page safely terminates without discarding collected bars.
    }
    const unique=[...new Map(bars.map(x=>[x.date,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));
    if(!unique.length)throw new Error(`Geen StockAnalysis-historie voor ${symbol}`);
    return {bars:unique,meta:{source:'stockanalysis.com',symbol}};
  }
}
