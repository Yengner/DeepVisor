import SectionSkeleton from '@/components/product/SectionSkeleton';
export default function LoadingReports() {
  return <div style={{padding:16}}><SectionSkeleton kind="metrics"/><SectionSkeleton kind="chart"/></div>;
}
