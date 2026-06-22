import React from "react";
import { Portal } from "@huin-core/react-portal";
import { useSentinelInteraction } from "../../react";

type SpotlightProps = {
  children: React.ReactNode;
  active?: boolean;
};

export const Spotlight = ({ children, active = true }: SpotlightProps) => {
  if (!active) return <>{children}</>;
  const { activeRect } = useSentinelInteraction();
  const centerX = activeRect ? activeRect.left + activeRect.width / 2 : 0;
  const centerY = activeRect ? activeRect.top + activeRect.height / 2 : 0;

  return (
    <>
      <Portal>
        <div className="sentinel-root">
        {activeRect && (
          <div
            className="pointer-events-none fixed inset-0 z-[999] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              background: `
                radial-gradient(
                  circle at ${centerX}px ${centerY}px,
                  rgba(255, 255, 255, 0.04) 0%,
                  rgba(255,255,255,0.01) 25%,
                  rgba(15, 15, 18, 0.35) 60%,
                  rgba(10, 10, 12, 0.75) 100%
                )
              `,
              backdropFilter: "blur(8px) saturate(140%) contrast(105%)",
              WebkitBackdropFilter: "blur(8px) saturate(140%) contrast(105%)",
            }}
          />
        )}
        {children}
        </div>
      </Portal>
    </>
  );
};
