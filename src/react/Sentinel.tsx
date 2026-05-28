import React, { useEffect, useId } from "react";
import { useSentinel } from "./provider";

type SentinelProps = {
  children: React.ReactNode;
  dialogTitle?: string;
  dialogDescription?: string;
};

export const Sentinel = ({
  children,
  dialogTitle,
  dialogDescription,
}: SentinelProps) => {
  const id = useId();
  const { activeId, registerHover, unregisterHover, openDialog } =
    useSentinel();

  const isDirectlyActive = activeId === id;

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    registerHover(id, e.currentTarget.getBoundingClientRect());
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    unregisterHover(id);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDialog(id, dialogTitle, dialogDescription);
  };
  useEffect(() => {
    console.log("Active Sentinel ID:", activeId, id);

    console.log("isDirectlyActive:", isDirectlyActive);
  }, [isDirectlyActive]);
  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        zIndex: isDirectlyActive ? 51 : "initial",
      }}
      className="relative block w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
    >
      <div
        className="w-full h-full p-0.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          zIndex: isDirectlyActive ? 51 : "auto",
          border: isDirectlyActive
            ? "2px dashed rgba(99, 102, 241, 0.55)"
            : "2px solid transparent",
          borderRadius: "inherit",
        }}
      >
        {children}
      </div>
    </div>
  );
};
