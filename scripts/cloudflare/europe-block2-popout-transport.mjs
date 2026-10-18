import fs from 'node:fs/promises';
const samples=[
 {isin:'BE0003720340',mic:'XAMS',symbol:'RET'},
 {isin:'BE0003851681',mic:'XAMS',symbol:'AED'},
 {isin:'NL0006294274',mic:'XAMS',symbol:'ENX'},
 {isin:'FR001400J770',mic:'XAMS',symbol:'AF'},
 {isin:'BE0974349814',mic:'XAMS',symbol:'WDP'},
 {isin:'BE0003720340',mic:'XBRU',symbol:'RET',control:true}
];
const results=[];
const downloadTests=[];
for(const item of samples){
 const url='https://live.euronext.com/en/popout-page/getHistoricalPrice/'+item.isin+'-'+item.mic;
 try{
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'},signal:AbortSignal.timeout(15000)});
  const html=await r.text();
  const links=[...html.matchAll(/(?:href|action)=["']([^"']+)["']/gi)].map(m=>m[1]).filter(x=>/download|csv|historical|price/i.test(x)).slice(0,25);
  const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>m[1]).filter(x=>/historical|download|price|euronext/i.test(x)).slice(0,20);
  results.push({...item,url,http:r.status,bytes:html.length,hasDownload:/download formatting options|comma delimited|historical data/i.test(html),links,scripts,status:r.ok?'HTML_RETRIEVED':'HTTP_ERROR',importApproved:false});
  const dl=links.find(x=>x.includes('/AwlHistoricalPrice/getFullDownloadAjax/'));
  if(dl){
   for(const method of ['GET','POST']){
    try{
     const downloadUrl=new URL(dl,'https://live.euronext.com').href;
     const response=await fetch(downloadUrl,{method,headers:{'User-Agent':'Mozilla/5.0','Accept':'text/csv,application/json,text/plain,*/*','Referer':url,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'}:{})},...(method==='POST'?{body:new URLSearchParams({adjusted:'Y',startdate:'2026-01-01',enddate:'2026-10-16'})}:{}),signal:AbortSignal.timeout(12000)});
     const body=await response.text(),head=body.slice(0,300);
     downloadTests.push({...item,method,http:response.status,contentType:response.headers.get('content-type'),contentDisposition:response.headers.get('content-disposition'),bytes:body.length,hasCsvRows:/^(?:date|datum|trading date)[,;\\t]/im.test(body),looksLikeHtml:/^\\s*<!doctype html|^\\s*<html/i.test(body),bodyPreview:head.replace(/[\\r\\n]/g,' ').slice(0,220),approvedForImport:false});
    }catch(e){downloadTests.push({...item,method,error:String(e.message).slice(0,200),approvedForImport:false});}
   }
  }
 }catch(e){results.push({...item,url,status:'FETCH_FAILED',error:String(e.message),importApproved:false});}
}
const summary={tested:results.length,htmlRetrieved:results.filter(x=>x.status==='HTML_RETRIEVED').length,downloadInterfaceSeen:results.filter(x=>x.hasDownload).length,downloadRequests:downloadTests.length,downloadCsvCandidates:downloadTests.filter(x=>x.hasCsvRows).length};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-block2-popout-transport.json',JSON.stringify({summary,results,downloadTests},null,2)+'\n');
console.log('EURONEXT_POPOUT_TRANSPORT',JSON.stringify({summary,downloadTests}));
