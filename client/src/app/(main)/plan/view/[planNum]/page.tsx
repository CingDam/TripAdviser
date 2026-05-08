import PlanViewReadonlyClient from '@/components/plans/PlanViewReadonlyClient';

export default async function PlanViewPage({
  params,
}: {
  params: Promise<{ planNum: string }>;
}) {
  const { planNum } = await params;
  return <PlanViewReadonlyClient planNum={Number(planNum)} />;
}
