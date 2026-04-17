import CityHubClient from '@/components/city/CityHubClient';

interface Props {
  params: Promise<{ cityNum: string }>;
}

export default async function CityPage({ params }: Props) {
  const { cityNum } = await params;
  return <CityHubClient cityNum={Number(cityNum)} />;
}
