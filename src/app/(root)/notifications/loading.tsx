import SectionSkeleton from '@/components/product/SectionSkeleton';
export default function LoadingNotifications() {
  return <div style={{padding:16}}><SectionSkeleton kind="activity"/><SectionSkeleton kind="activity"/></div>;
}
