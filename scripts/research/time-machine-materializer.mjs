import crypto from 'node:crypto';
import {projectWorldAt,assertNoFutureLeak} from './pit-core.mjs';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function monthEnds(start,end){const a=new Date(start),b=new Date(end),out=[];let d=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,0,23,59,59));while(d<=b){out.push(d.toISOString());d=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+2,0,23,59,59));}return out;}
export function materializeSnapshot(evidence,cutoff,{universeIds=null}={}){let world=projectWorldAt(evidence,cutoff);if(universeIds)world=world.filter(x=>universeIds.has(x.entityId));assertNoFutureLeak(world,cutoff);const evidenceIds=world.map(x=>x.evidenceId).sort();const manifest={cutoff,records:world.length,entities:new Set(world.map(x=>x.entityId)).size,evidenceIds};return{cutoff,world,manifest:{...manifest,snapshotHash:hash(manifest)}};}
export function materializeMonthly(evidence,start,end,universeAt){return monthEnds(start,end).map(cutoff=>materializeSnapshot(evidence,cutoff,{universeIds:universeAt?new Set(universeAt(cutoff)):null}));}
