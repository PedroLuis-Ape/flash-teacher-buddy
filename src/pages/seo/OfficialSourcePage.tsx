import { useLocation } from "react-router-dom";
import { EditorialPage } from "@/components/seo/EditorialPage";

export default function OfficialSourcePage() {
  const location = useLocation();
  return <EditorialPage path={location.pathname} />;
}
