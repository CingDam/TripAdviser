import MapContainer from "@/components/plans/MapContainer";
import PlanContainer from "@/components/plans/PlanContainer";
import SearchContainer from "@/components/plans/SearchContainer";

// Next.js App Router: page.tsx는 서버 컴포넌트로 searchParams prop을 직접 받을 수 있음
export default async function Plan({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lat?: string; lng?: string }>;
}) {
  const { q, lat, lng } = await searchParams;

  const initialQuery = q ?? null;
  const initialCenter =
    lat && lng
      ? { lat: parseFloat(lat), lng: parseFloat(lng) }
      : null;

  return (
    <div className="flex w-full h-full overflow-hidden bg-gray-50 dark:bg-[#252527]">
      <SearchContainer initialQuery={initialQuery} />
      <PlanContainer />
      <MapContainer initialCenter={initialCenter} />
    </div>
  );
}
