// src/react/hooks.ts
import { useContext } from "react";
import { SentinelContext } from "./provider";

export function useSentinel() {
  return useContext(SentinelContext);
}