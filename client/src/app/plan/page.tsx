import MapContainer from "@/components/plans/MapContainer";
import PlanContainer from "@/components/plans/PlanContainer";
import SearchContainer from "@/components/plans/SearchContainer";

export default function Plan() {
  return (
    <div className="flex w-screen h-screen overflow-hidden bg-gray-50">
      <SearchContainer />
      <PlanContainer />
      <MapContainer />
    </div>
  );
}
