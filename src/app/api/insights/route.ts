import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { insightsScope,uuid } from '@/lib/server/insights/http';
import { history,prepare,savedPresentation } from '@/lib/server/insights/service';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){
 try{const scope=await insightsScope();if(!scope)return NextResponse.json({items:[],issues:[],next:null},{headers});
 const id=req.nextUrl.searchParams.get('id'),before=req.nextUrl.searchParams.get('before');
 if((id&&!uuid.test(id))||(before&&!uuid.test(before)))return NextResponse.json({error:'Invalid update'},{status:400,headers});
 if(id){const saved=await savedPresentation(scope,id);return NextResponse.json(saved??{error:'Update not found'},{status:saved?200:404,headers});}
 return NextResponse.json(await history(scope,before),{headers});
 }catch(e){unstable_rethrow(e);return NextResponse.json({error:'Updates are temporarily unavailable'},{status:503,headers});}
}
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Forbidden'},{status:403,headers});
 const body=await req.json().catch(()=>null);if(!body||typeof body.token!=='string'||!uuid.test(body.token))return NextResponse.json({error:'Invalid request'},{status:400,headers});
 try{const scope=await insightsScope();return NextResponse.json({presentation:scope?await prepare(scope,body.token):null},{headers});}
 catch(e){unstable_rethrow(e);console.warn('Insights preparation unavailable');return NextResponse.json({error:'Updates are temporarily unavailable'},{status:503,headers});}
}
