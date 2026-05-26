import React, { useEffect } from "react";
import { Button } from "../ui/components/Button";

export function Sentinel({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log("Sentinel active");
  }, []);

  return (
    <>
      {children}
      <Button />
    </>
  );
}
