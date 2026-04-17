import CommunityDetailClient from '@/components/community/CommunityDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CommunityDetailPage({ params }: Props) {
  const { id } = await params;
  return <CommunityDetailClient id={Number(id)} />;
}
