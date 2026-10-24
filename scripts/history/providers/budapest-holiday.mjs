// BSE Resolution 380/2025 (published 5 November 2025): 2026 market-wide
// non-trading sessions. This proves a closed exchange, never a price bar.
export const BUDAPEST_CALENDAR_URL='https://bse.hu/newkibdata/129344942/Trading%20holidays_2026_ENG.pdf';
const CLOSED_2026=new Set([
 '2026-01-01','2026-01-02','2026-04-03','2026-04-06',
 '2026-05-01','2026-05-25','2026-08-20','2026-08-21',
 '2026-10-23','2026-12-24','2026-12-25','2026-12-31'
]);
export const isOfficialBudapestClosedDate=date=>typeof date==='string'&&CLOSED_2026.has(date);
export function budapestClosedSessionStatus(instrument,date){
 if((instrument?.mic||instrument?.market)!=='XBUD'||!isOfficialBudapestClosedDate(date))return null;
 const isin=instrument.officialIsin||instrument.isin,ticker=instrument.symbol||instrument.ticker;
 if(!/^[A-Z]{2}[A-Z0-9]{10}$/.test(String(isin||''))||!String(ticker||'').trim()||
    !['HUF','EUR'].includes(instrument.currency)||
    instrument.identityResolution!=='OFFICIAL_BSE_ORDINARY_REGULATED_SHARE_FREE_HISTORY_PROOF')return null;
 return {date,mic:'XBUD',isin,status:'NO_TRADES',provider:'bse-budapest-calendar',
   sourceUrl:BUDAPEST_CALENDAR_URL,trades:0,volume:0,lastTradeDate:null,
   verification:'OFFICIAL_MARKET_CLOSED_RESOLUTION_380_2025',marketClosed:true};
}
