'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { POST_AUTH_TOAST_KEY } from '@/lib/client/user/auth';

type PendingToastPayload = {
  type?: 'success' | 'error';
  message?: string;
};

export default function PendingAuthToast() {
  useEffect(() => {
    const rawValue = window.sessionStorage.getItem(POST_AUTH_TOAST_KEY);

    if (!rawValue) {
      return;
    }

    window.sessionStorage.removeItem(POST_AUTH_TOAST_KEY);

    try {
      const payload = JSON.parse(rawValue) as PendingToastPayload;
      const message = payload.message?.trim();

      if (!message) {
        return;
      }

      if (payload.type === 'error') {
        toast.error(message);
        return;
      }

      toast.success(message);
    } catch {
      toast.success('Logged out successfully.');
    }
  }, []);

  return null;
}
