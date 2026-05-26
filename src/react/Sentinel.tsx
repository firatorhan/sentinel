import React, { useEffect } from "react";
import { SentinelDialog } from "../ui/widgets/SentinelDialog";

export function Sentinel({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log("Sentinel active");
  }, []);

  return (
    <>
      <SentinelDialog>{children}</SentinelDialog>
    </>
  );
}
