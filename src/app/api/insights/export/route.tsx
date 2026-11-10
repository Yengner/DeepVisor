import {NextRequest,NextResponse} from 'next/server';
import {unstable_rethrow} from 'next/navigation';
import {Document,Page,Text,View,renderToBuffer} from '@react-pdf/renderer';
import {insightsScope,uuid} from '@/lib/server/insights/http';
import {savedPresentation} from '@/lib/server/insights/service';
import {exportCsv,exportRows} from '@/lib/shared/insights/export';
import type {SavedPresentation} from '@/lib/shared/insights/model';
function exportDocument(saved:SavedPresentation){return <Document><Page size="A4" style={{padding:32,fontSize:10,color:'#122d4b'}}><Text style={{fontSize:20,marginBottom:12}}>DeepVisor · Insights &amp; Events</Text>{exportRows(saved).map((row,i)=><View key={i} wrap={false} style={{marginBottom:9}}><Text style={{fontSize:9,color:'#516275'}}>{String(row[0])} · {String(row[1])}</Text><Text>{row[2]===null?'Unavailable':String(row[2])}</Text>{row[3]!==null&&<Text style={{fontSize:9}}>{String(row[3])}</Text>}</View>)}</Page></Document>;}
export async function GET(req:NextRequest){
 try{const s=await insightsScope(),id=req.nextUrl.searchParams.get('id'),format=req.nextUrl.searchParams.get('format');
 if(!s||!id||!uuid.test(id))return NextResponse.json({error:'Not found'},{status:404});
 if(!['csv','pdf'].includes(format??''))return NextResponse.json({error:'Unsupported format'},{status:400});
 const saved=await savedPresentation(s,id);if(!saved)return NextResponse.json({error:'Not found'},{status:404});
 const headers={'Cache-Control':'private, no-store','Content-Disposition':`attachment; filename="deepvisor-update-${id}.${format}"`};
 if(format==='csv')return new NextResponse(exportCsv(saved),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8'}});
 const buffer=await renderToBuffer(exportDocument(saved));
 return new NextResponse(new Uint8Array(buffer),{headers:{...headers,'Content-Type':'application/pdf'}});
 }catch(e){unstable_rethrow(e);return NextResponse.json({error:'Export unavailable'},{status:503});}
}
