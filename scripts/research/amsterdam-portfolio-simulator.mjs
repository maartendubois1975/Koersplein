export function simulatePortfolio({bars=[],decisions=[],initialCash=100000,costRate=0.0025}={}) {
  if (!(initialCash>0) || costRate<0 || costRate>=1) throw new Error('Invalid settings');
  const prices=new Map(),positions=new Map(),ledger=[],equity=[];
  const days=new Map();
  for(const b of bars){if(!b.date||!b.instrument||!(b.close>0))continue; if(!days.has(b.date))days.set(b.date,[]);days.get(b.date).push(b);}
  const orders=new Map(decisions.map(x=>[x.date,x]));
  let cash=initialCash,fees=0,peak=initialCash,maxDrawdown=0;
  for(const date of [...days.keys()].sort()){
    for(const b of days.get(date))prices.set(b.instrument,{date,price:b.close});
    const order=orders.get(date);
    if(order){
      const picks=[...new Set(order.picks||[])].slice(0,5);
      for(const [id,shares] of positions)if(!picks.includes(id)&&prices.get(id)?.date===date){
        const gross=shares*prices.get(id).price,fee=gross*costRate;
        cash+=gross-fee;fees+=fee;positions.delete(id);ledger.push({date,side:'SELL',instrument:id,gross,fee});
      }
      const nav=cash+[...positions].reduce((s,[id,shares])=>s+shares*prices.get(id).price,0);
      for(const id of picks)if(!positions.has(id)&&prices.get(id)?.date===date){
        const spend=Math.min(cash,nav/5),gross=spend/(1+costRate),fee=spend-gross;
        if(gross<=0)continue;
        cash-=spend;fees+=fee;positions.set(id,gross/prices.get(id).price);
        ledger.push({date,side:'BUY',instrument:id,gross,fee});
      }
    }
    const invested=[...positions].reduce((s,[id,shares])=>s+shares*prices.get(id).price,0);
    const nav=cash+invested;peak=Math.max(peak,nav);maxDrawdown=Math.max(maxDrawdown,1-nav/peak);
    equity.push({date,cash,invested,nav,positions:positions.size});
  }
  const finalNav=equity.at(-1)?.nav??initialCash;
  return {initialCash,finalNav,totalReturn:finalNav/initialCash-1,totalFees:fees,maxDrawdown,ledger,equity,limitations:['Research only','Same-day closing fills may introduce look-ahead','Stale marks carried forward','Dividends, spreads and delistings excluded']};
}
