import {NextRequest,NextResponse} from 'next/server';
import {unstable_rethrow} from 'next/navigation';
import React from 'react';
import {Document,Page,Text,renderToBuffer} from '@react-pdf/renderer';
import {getRequiredAppContext} from '@/lib/server/actions/app/context';
import {resolveCurrentSelection} from '@/lib/server/actions/app/selection';
import {lifecycleEnabled} from '@/lib/server/lifecycle/service';
import {lifecycleBrief} from '@/lib/server/lifecycle/brief';
export async function GET(req:NextRequest,{params}:{params:Promise<{eventId:string}>}){
 if(!lifecycleEnabled())return new NextResponse(null,{status:404});
 try{const {businessId}=await getRequiredAppContext();const {selectedAdAccountId}=await resolveCurrentSelection(businessId);const {eventId}=await params;
 if(!selectedAdAccountId||!/^[0-9a-f-]{36}$/i.test(eventId))return new NextResponse(null,{status:404});
 const b=await lifecycleBrief(businessId,selectedAdAccountId,eventId,false,true);if(!b)return new NextResponse(null,{status:404});
 const format=req.nextUrl.searchParams.get('format');const headers={'Cache-Control':'private, no-store','Content-Disposition':`attachment; filename="lifecycle-${eventId}.${format==='csv'?'csv':'pdf'}"`};
 if(format==='csv'){const q=(v:unknown)=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`;};const rows=[['record_type','date','spend','reported_results','currency','details'],['summary',`${b.since}/${b.until}`,b.spend,b.results,b.currency],...b.days.map(d=>['daily',d.day,d.spend,d.results,b.currency]),...b.affected.map(a=>['affected_ad',a.id,null,null,null,`${a.name}; scheduled end ${a.end??'unknown'}`]),...(b.breakdowns??[]).flatMap(d=>d.rows.map(r=>['snapshot',r.label,r.spend,null,b.currency,`${d.scope}; ${d.since}–${d.until}; impressions ${r.impressions}`])),...b.limitations.map(t=>['limitation',t])];return new NextResponse(rows.map(r=>r.map(q).join(',')).join('\r\n'),{headers:{...headers,'Content-Type':'text/csv;charset=utf-8'}});}
 if(format!=='pdf')return new NextResponse(null,{status:400});
 const lines=[b.title,b.explanation,`${b.provenance} · Observed ${b.observedAt}`,`Coverage ${b.since} – ${b.until}`,`Spend ${b.spend??'unavailable'} ${b.currency??''} · Results ${b.results??'unavailable'} · CPR ${b.cpr??'unavailable'}`,...b.days.map(d=>`${d.day}: ${d.spend??'unavailable'} ${b.currency??''}; ${d.results??'unavailable'} results`),...b.affected.map(a=>`${a.name} (${a.id}); scheduled end ${a.end??'unknown'}`),...(b.breakdowns??[]).flatMap(d=>[`${d.scope} Snapshot ${d.since}–${d.until}`,...d.rows.map(r=>`${r.label}: ${r.impressions} impressions; ${r.spend} ${b.currency??''}`)]),...b.limitations];
 const pdf=await renderToBuffer(React.createElement(Document,null,React.createElement(Page,{size:'A4',style:{padding:36,fontSize:11}},...lines.map((line,i)=>React.createElement(Text,{key:i,style:{marginBottom:12}},line)))));
 return new NextResponse(new Uint8Array(pdf),{headers:{...headers,'Content-Type':'application/pdf'}});
 }catch(e){unstable_rethrow(e);return NextResponse.json({error:'Report unavailable'},{status:503});}
}
