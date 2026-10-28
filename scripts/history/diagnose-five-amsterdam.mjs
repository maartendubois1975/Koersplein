import {EuronextLiveProvider} from './providers/euronext-live.mjs';
const provider=new EuronextLiveProvider();
const instruments=[['AF','FR001400J770'],['ENX','NL0006294274'],['FAGR','BE0003874915'],['ONWD','NL0015000HT4'],['SGO','FR0000125007']];
const venues=['XAMS','XPAR','XBRU'];
const endDate='2026-10-28',startDate='2026-10-01';
for(const [symbol,isin] of instruments){
 for(const mic of venues){
  try{
   const {bars}=await provider.fetchDaily({symbol,isin,mic},{startDate,endDate});
   console.log('FIVE_VENUE_EVIDENCE '+JSON.stringify({symbol,isin,mic,count:bars.length,lastDate:bars.at(-1)?.date,lastVolume:bars.at(-1)?.volume}));
  }catch(error){console.log('FIVE_VENUE_EVIDENCE '+JSON.stringify({symbol,isin,mic,error:String(error.message).slice(0,180)}));}
 }
}
