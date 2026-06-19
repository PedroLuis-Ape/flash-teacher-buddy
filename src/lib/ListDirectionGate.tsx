import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loadListPrimarySide } from "./loadListPrimarySide";
import { loadPublicSide } from "./loadPublicSide";
import { primarySideToDirection } from "./primarySideDirection";
import { listIdFromPath } from "./listRoute";

export function ListDirectionGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const listId = listIdFromPath(location.pathname);
  const isPublic = location.pathname.startsWith("/portal/list/");
  void listId;
  void isPublic;
  return <>{children}</>;
}
