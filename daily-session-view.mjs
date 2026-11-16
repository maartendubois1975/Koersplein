export const approvedMarkets=new Set(['XAMS','XBRU','XPAR']);
export async function browserCatalog(mic,fallback,load){
 if(!approvedMarkets.has(mic))return load(fallback);
 const contracts=await load('data/company-register-contracts.json');
 const contract=contracts.markets[mic];
 const catalog=await load('data/'+contract.file);
 if(catalog.shares.length!==contract.expectedCount)throw Error('Bedrijvenregister onvolledig');
 return catalog;
}
export function dailyRow(snapshot,share,mic){
 const row=snapshot?.results?.find(x=>x.isin===share.isin&&x.symbol===(share.symbol||share.ticker)&&x.mic===(share.primaryMic||share.mic||mic));
 const b=row?.bar;
 if(row?.status!=='TRADED'||!b||b.date!==snapshot.session||![b.open,b.high,b.low,b.close,b.volume].every(x=>Number.isFinite(x)&&x>0)||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||b.high<b.low)return null;
 return b;
}
