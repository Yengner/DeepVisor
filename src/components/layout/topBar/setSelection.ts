'use server';

import { cookies } from 'next/headers';

export async function setSelection({
    platformId,
    accountRowId,
}: { platformId?: string | null; accountRowId?: string | null }) {
    const c = await cookies();

    if (platformId) {
        c.set('platform_integration_id', platformId, {
            httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
        });
    }

    if (accountRowId) {
        c.set('ad_account_row_id', accountRowId, {
            httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
        });
    } else {
        c.delete('ad_account_row_id');
    }
}
