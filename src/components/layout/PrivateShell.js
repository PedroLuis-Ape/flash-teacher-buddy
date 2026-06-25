import { Fragment, createElement } from "react";
import { useLocation } from "react-router-dom";
import { PrivateShell as BasePrivateShell } from "./PrivateShell.tsx";
import { PersonalRecommendations } from "@/components/PersonalRecommendations";

const routes = new Set(["/dashboard", "/folders", "/my-teachers", "/profile"]);

export function PrivateShell({ children }) {
  const { pathname } = useLocation();
  const recommendation = routes.has(pathname)
    ? createElement(
        "div",
        { className: "mx-auto w-full max-w-[1600px] px-4 pb-6 lg:px-8 xl:px-12" },
        createElement(PersonalRecommendations),
      )
    : null;

  return createElement(
    BasePrivateShell,
    null,
    createElement(Fragment, null, children, recommendation),
  );
}
