import PlanViewClient from '@/components/mypage/PlanViewClient';

export default async function PlanViewPage({
  params,
}: {
  params: Promise<{ planNum: string }>;
}) {
  const { planNum } = await params;
  return <PlanViewClient planNum={Number(planNum)} />;
}
