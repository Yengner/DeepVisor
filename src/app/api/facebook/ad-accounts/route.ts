import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
//   const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '');
//   if (!accessToken) return NextResponse.json({ error: 'Access token missing' }, { status: 400 });

  // Mocked ad account data
  const adAccounts = [
    { id: 'act_123456', account_id: '123456' },
    { id: 'act_789101', account_id: '789101' },
  ];

  return NextResponse.json(adAccounts);
}
