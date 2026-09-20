import { normalizeHistoryDocument } from './paris-input.mjs';
const doc={instrument:{isin:'FR0000000001',symbol:'TEST',name:'Test Paris',mic:'XPAR',currency:'EUR'},provider:{id:'fixture',retrievedAt:'2026-09-20T00:00:00Z'},bars:[{date:'2020-01-02',close:100},{date:'2020-01-03',close:101},{date:'2020-01-06',close:150}]};
const snap=normalizeHistoryDocument(doc,{cutoff:'2020-01-03'});
if(snap.records!==2||snap.lastDate!=='2020-01-03'||snap.bars.some(x=>x.date>'2020-01-03')) throw new Error('Look-ahead guard failed');
let rejected=false;try{normalizeHistoryDocument({...doc,instrument:{...doc.instrument,mic:'XAMS'}},{cutoff:'2020-01-03'});}catch{rejected=true}
if(!rejected) throw new Error('Paris market isolation failed');
console.log('Paris point-in-time history adapter: PASS');
