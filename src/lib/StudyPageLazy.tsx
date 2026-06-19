import { lazy, Suspense } from "react";
const Page = lazy(() => import("../pages/Study"));
export default function StudyPageLazy() { return <Suspense fallback={null}><Page /></Suspense>; }
