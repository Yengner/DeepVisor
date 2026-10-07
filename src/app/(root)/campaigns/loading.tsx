import SectionSkeleton from '@/components/product/SectionSkeleton';
export default function LoadingCampaigns() {
  return <div style={{padding:16}}><SectionSkeleton kind="metrics"/><SectionSkeleton kind="activity"/></div>;
}
