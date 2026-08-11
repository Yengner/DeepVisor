import { cn } from '@/lib/shared/utils/format';

type BrandTone = 'dark' | 'light';

export function BrandMark({
  className,
  tone = 'dark',
}: {
  className?: string;
  tone?: BrandTone;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-end justify-center gap-[3px] rounded-md border px-[6px] pb-[6px] pt-[5px]',
        tone === 'dark'
          ? 'border-[#2e342d] bg-[#151714]'
          : 'border-[#d7ff8a] bg-[#c8ff56]',
        className
      )}
    >
      <span className={cn('h-2 w-[3px] rounded-[1px]', tone === 'dark' ? 'bg-[#c8ff56]' : 'bg-[#151714]')} />
      <span className={cn('h-4 w-[3px] rounded-[1px]', tone === 'dark' ? 'bg-[#c8ff56]' : 'bg-[#151714]')} />
      <span className={cn('h-3 w-[3px] rounded-[1px]', tone === 'dark' ? 'bg-[#c8ff56]' : 'bg-[#151714]')} />
    </span>
  );
}

export function BrandLockup({
  className,
  compact = false,
  inverse = false,
}: {
  className?: string;
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <span
      className={cn('inline-flex min-w-0 items-center gap-2.5', className)}
      aria-label="DeepVisor"
    >
      <BrandMark tone={inverse ? 'light' : 'dark'} />
      {!compact ? (
        <span className="min-w-0">
          <span className={cn('block text-sm font-extrabold leading-none', inverse ? 'text-white' : 'text-[#151714]')}>
            DeepVisor
          </span>
          <span className={cn('mt-1 block text-[9px] font-bold uppercase leading-none', inverse ? 'text-[#a8afa5]' : 'text-[#727970]')}>
            Ad intelligence
          </span>
        </span>
      ) : null}
    </span>
  );
}
