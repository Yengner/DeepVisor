'use client';
import Link from 'next/link';
import { Button } from '@mantine/core';
import type { ReactNode } from 'react';
export default function ProductLinkButton({href,disabled,children}:{href:string;disabled?:boolean;children:ReactNode}) {
  return disabled ? <Button variant="default" disabled>{children}</Button> : <Button component={Link} href={href} variant="default">{children}</Button>;
}
