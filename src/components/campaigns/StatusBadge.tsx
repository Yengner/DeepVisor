'use client';
import ProductStatus from '@/components/product/StatusBadge';
export default function StatusBadge({status}:{status?:string|null}) {
  return <ProductStatus status={status}/>;
}
