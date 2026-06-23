import React, { useRef } from "react";
import { useSentinelInteraction } from "./provider";
import { useId } from "@huin-core/react-id";
import { safeSerialize } from "../utils/safeSerialize";

type SentinelProps = {
  children: React.ReactNode;
  componentName?: string;
  sourceFile?: string;
  renderCount?: number;
  dialogMd?: string;
  componentProps?: Record<string, any>;
};

export const Sentinel = ({
  children,
  componentName,
  sourceFile,
  renderCount,
  dialogMd,
  componentProps,
}: SentinelProps) => {
  const id = useId();
  const { isActive, showOutlines, highlightName, registerHover, unregisterHover, openDialog } =
    useSentinelInteraction();

  const propHistoryRef = useRef<Record<string, any>[]>([]);
  const prevPropsRef = useRef<string>("");
  const safeProps = componentProps
    ? (safeSerialize(componentProps) as Record<string, unknown>)
    : undefined;
  const currentPropsStr = safeProps ? JSON.stringify(safeProps) : "";
  if (safeProps && currentPropsStr !== prevPropsRef.current) {
    prevPropsRef.current = currentPropsStr;
    propHistoryRef.current = [safeProps, ...propHistoryRef.current].slice(0, 6);
  }

  const isNameHighlighted =
    isActive &&
    !!highlightName &&
    !!componentName &&
    componentName.toLowerCase().includes(highlightName.toLowerCase());

  const getBorder = () => {
    if (isNameHighlighted) return "2px dashed rgba(245, 158, 11, 0.8)";
    if (isActive && showOutlines) return "2px dashed rgba(99, 102, 241, 0.22)";
    return "2px solid transparent";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!isActive) return;
    e.stopPropagation();
    registerHover(id, e.currentTarget.getBoundingClientRect());
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    if (!isActive) return;
    e.stopPropagation();
    unregisterHover(id);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isActive) return;
    e.stopPropagation();
    openDialog(
      id,
      componentName,
      dialogMd,
      safeProps,
      sourceFile,
      renderCount,
      propHistoryRef.current,
    );
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="relative transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
    >
      <div
        className="w-full h-full p-0.5! transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          border: getBorder(),
          borderRadius: "inherit",
        }}
      >
        {children}
      </div>
    </div>
  );
};
