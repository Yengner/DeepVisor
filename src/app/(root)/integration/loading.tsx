import SectionSkeleton from '@/components/product/SectionSkeleton';
export default function LoadingConnections() {
  return <div style={{padding:16}}><SectionSkeleton kind="activity"/><SectionSkeleton kind="attention"/></div>;
}
