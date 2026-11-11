import SectionSkeleton from '@/components/product/SectionSkeleton';
export default function LoadingOverview() {
  return <div style={{padding:16}}><SectionSkeleton kind="metrics"/><SectionSkeleton kind="chart"/></div>;
}
