import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { loadListPrimarySide } from "./loadListPrimarySide";
import { loadPublicSide } from "./loadPublicSide";
import { primarySideToDirection } from "./primarySideDirection";

export function ListDirectionGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  void location;
  return <>{children}</>;
}
