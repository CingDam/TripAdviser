import MapContainer from "@/components/plans/MapContainer";
import PlanContainer from "@/components/plans/PlanContainer";
import SearchContainer from "@/components/plans/SearchContainer";
import PlanEditLoader from "@/components/plans/PlanEditLoader";

// Next.js App Router: page.tsx는 서버 컴포넌트로 searchParams prop을 직접 받을 수 있음
export default async function Plan({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lat?: string; lng?: string; edit?: string }>;
}) {
  const { q, lat, lng, edit } = await searchParams;

  const initialQuery = q ?? null;
  const initialCenter =
    lat && lng
      ? { lat: parseFloat(lat), lng: parseFloat(lng) }
      : null;
  // edit 쿼리 파라미터가 있으면 기존 일정 수정 모드 — PlanEditLoader가 스토어에 데이터 적재
  const editPlanNum = edit ? parseInt(edit, 10) : null;

  return (
    <div className="flex w-full h-full overflow-hidden bg-gray-50 dark:bg-[#252527]">
      {editPlanNum && <PlanEditLoader planNum={editPlanNum} />}
      <SearchContainer initialQuery={initialQuery} />
      <PlanContainer />
      <MapContainer initialCenter={initialCenter} />
    </div>
  );
}
