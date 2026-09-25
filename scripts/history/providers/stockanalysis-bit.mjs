const MILAN_MICS=new Set(['XMIL','MTAA','EXGM']);

export class StockAnalysisBitProvider {
  id='stockanalysis-bit';
  supports(instrument){return MILAN_MICS.has(String(instrument?.mic||'').toUpperCase())&&Boolean(instrument?.symbol||instrument?.ticker)}
  async fetchDaily(instrument,{startDate='1990-01-01',endDate=new Date().toISOString().slice(0,10)}={}){
    const symbol=encodeURIComponent(String(instrument.symbol||instrument.ticker).trim().toUpperCase());
    const bars=[];
    for(let page=1;page<=20;page++){
      const url=`https://stockanalysis.com/quote/bit/${symbol}/history/?p=${page}`;
      const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; Koersplein/1.0)','accept':'text/html'}});
      if(!r.ok)throw new Error(`StockAnalysis HTTP ${r.status} voor ${symbol}`);
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
      if(!/rel="next"|Next/i.test(html)&&page>1)break;
    }
    const unique=[...new Map(bars.map(x=>[x.date,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));
    if(!unique.length)throw new Error(`Geen StockAnalysis-historie voor ${symbol}`);
    return {bars:unique,meta:{source:'stockanalysis.com',symbol}};
  }
}
