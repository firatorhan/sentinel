import React, { useEffect } from "react";
import { Button } from "../ui/components/Button";
import { DialogDemo } from "../ui/widgets/SentinelDialog";

export function Sentinel({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log("Sentinel active");
  }, []);

  return (
    <>
      {children}
      <Button type="button" variant="destructive" size="lg">
        Click me!!
      </Button>
      <DialogDemo />
    </>
  );
}
