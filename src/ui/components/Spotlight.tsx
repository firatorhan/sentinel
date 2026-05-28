import React, { useState } from "react";
import { Portal } from "@huin-core/react-portal";

type SpotlightProps = {
  children: React.ReactNode;
  active?: boolean;
};

export const Spotlight = ({ children, active = true }: SpotlightProps) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  if (!active) return <>{children}</>;

  const handleOnMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setRect(e.currentTarget.getBoundingClientRect());
  };
  const handleOnMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setRect(null)
  };

  const bind = {
    onMouseEnter: handleOnMouseEnter,
    onMouseMove: handleOnMouseEnter,
    onMouseLeave: handleOnMouseLeave,
  };

  const centerX = rect ? rect.left + rect.width / 2 : 0;
  const centerY = rect ? rect.top + rect.height / 2 : 0;

  const colors = {
    spotlight_center: "rgba(255, 255, 255, 0.04)",
    spotlight_glow: "rgba(255, 255, 255, 0.01)",
    overlay_base: "rgba(15, 15, 18, 0.35)",
    overlay_deep: "rgba(10, 10, 12, 0.75)",
  };

  return (
    <>
      {/* GLOBAL OVERLAY */}
      {rect && (
        <Portal>
          <div
            className="pointer-events-none fixed inset-0 z-40 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              background: `
                radial-gradient(
                  circle at ${centerX}px ${centerY}px,
                  ${colors.spotlight_center} 0%,
                  rgba(255,255,255,0.01) 25%,
                  ${colors.overlay_base} 60%,
                  ${colors.overlay_deep} 100%
                )
              `,
              backdropFilter: "blur(8px) saturate(140%) contrast(105%)",
              WebkitBackdropFilter: "blur(8px) saturate(140%) contrast(105%)",
            }}
          />
        </Portal>
      )}

      {/* CHILD WRAPPER */}
      <div
        {...bind}
        className="relative block w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          zIndex: rect ? 50 : "auto",
        }}
      >
        {/* CONTENT */}
        <div
          className="w-full h-full p-0.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            transform: rect
              ? "translateY(-2px) scale(1.01)"
              : "translateY(0px) scale(1)",
            filter: rect
              ? "drop-shadow(0 18px 40px rgba(0,0,0,0.25))"
              : "drop-shadow(0 0 0 rgba(0,0,0,0))",
            border: rect
              ? "2px dashed rgba(99, 102, 241, 0.55)"
              : "2px solid transparent",
            borderRadius: "inherit",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};
