'use client';

import { Button, type ButtonProps } from '@mantine/core';
import { useSwitchBusiness } from './useSwitchBusiness';

/** Switches to the business and opens `path` in it. */
export default function OpenBusinessButton({ businessId, path, children, ...props }: ButtonProps & { businessId: string; path?: string }) {
  const { switching, go } = useSwitchBusiness();
  return <Button {...props} loading={switching === businessId} onClick={() => void go(businessId, path)}>{children}</Button>;
}
