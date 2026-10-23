import Image from 'next/image';
import { cn } from '@/lib/shared/utils/format';

type BrandTone = 'dark' | 'light';

export function BrandMark({ className, tone = 'dark' }: { className?: string; tone?: BrandTone }) {
  return <Image src={`/images/brand/deepvisor-app-icon-${tone}-128.png`} alt="" aria-hidden width={128} height={128}
    className={cn('inline-block h-8 w-8 shrink-0 rounded-md object-contain', className)} />;
}

export function BrandLockup({ className, compact = false, inverse = false }: { className?: string; compact?: boolean; inverse?: boolean }) {
  return <span className={cn('inline-flex shrink-0 items-center', className)} aria-label="DeepVisor">
    {compact ? <BrandMark tone={inverse ? 'dark' : 'light'} /> : <Image src="/images/brand/deepvisor-wordmark-horizontal.webp" alt="DeepVisor" width={583} height={128}
      className={cn('h-8 w-auto max-w-[146px] object-contain', inverse && 'brightness-0 invert')} />}
  </span>;
}
