import fs from 'node:fs/promises';
const root='https://live.euronext.com';
const isin='NL0006294274',mic='XAMS',key=isin+'-'+mic;
const pageUrl=root+'/en/popout-page/getHistoricalPrice/'+key;
const page=await fetch(pageUrl,{signal:AbortSignal.timeout(15000)});
const html=await page.text();
const formHints=[...html.matchAll(/<(?:input|select|form)[^>]{0,900}>/gi)].map(m=>m[0]).filter(x=>/format|typefile|separator|typedate|download|csv|date|action|adjusted/i.test(x)).slice(0,65);
const context=html.indexOf('getFullDownloadAjax');
const nearDownload=context>=0?html.slice(Math.max(0,context-2200),context+1800):'';
const path='/en/ajax/AwlHistoricalPrice/getFullDownloadAjax/'+key;
const candidates=[
 ['GET','format','csv'],['GET','format','CSV'],['GET','typefile','csv'],['GET','fileformat','csv'],
 ['POST','format','csv'],['POST','typefile','csv'],['POST','format','xls'],
 ['GET','format','csv&separator=point&typedate=dmy'],
 ['GET','typefile','csv&layout=vertical&typedate=dmy&separator=pointt']
];
const tests=[];
for(const [method,param,value] of candidates){
 const u=new URL(path,root),form=new URLSearchParams();
 form.set(param,value);
 form.set('adjusted','Y');form.set('startdate','2026-10-01');form.set('enddate','2026-10-16');
 if(method==='GET')u.search=form.toString();
 try{
 const response=await fetch(u,{method,headers:{'Referer':pageUrl,'User-Agent':'Mozilla/5.0','Accept':'text/csv,text/plain,application/octet-stream,*/*',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'}:{})},...(method==='POST'?{body:form}:{}),signal:AbortSignal.timeout(12000)});
 const body=await response.text();
 tests.push({method,param,value,http:response.status,contentType:response.headers.get('content-type'),disposition:response.headers.get('content-disposition'),bytes:body.length,preview:body.slice(0,180).replace(/[\r\n]/g,' '),hasOHLC:/date.{0,80}open.{0,80}high.{0,80}low.{0,80}close/i.test(body)});
 }catch(e){tests.push({method,param,value,error:String(e.message)});}
}
const output={mode:'READ_ONLY',identity:{isin,mic},page:{http:page.status,bytes:html.length,formHints,nearDownload},tests};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-download-format-matrix.json',JSON.stringify(output,null,2)+'\n');
console.log('EURONEXT_DOWNLOAD_FORMAT_MATRIX',JSON.stringify({pageHttp:page.status,formHints,tests}));
