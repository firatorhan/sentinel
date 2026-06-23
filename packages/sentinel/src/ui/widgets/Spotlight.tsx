import React from "react";
import { Portal } from "@huin-core/react-portal";
import { useSentinelInteraction } from "../../react";

type SpotlightProps = {
  children: React.ReactNode;
  active?: boolean;
};

const DARK = "rgba(10, 10, 12, 0.72)";
const BLUR = "blur(8px) saturate(140%) contrast(105%)";

export const Spotlight = ({ children, active = true }: SpotlightProps) => {
  if (!active) return <>{children}</>;
  const { activeRect } = useSentinelInteraction();

  return (
    <>
      <Portal>
        <div className="sentinel-root">
          {activeRect && (
            <>
              {/* Top */}
              <div
                className="pointer-events-none fixed z-[999]"
                style={{
                  top: 0,
                  left: 0,
                  right: 0,
                  height: activeRect.top,
                  background: DARK,
                  backdropFilter: BLUR,
                  WebkitBackdropFilter: BLUR,
                }}
              />
              {/* Bottom */}
              <div
                className="pointer-events-none fixed z-[999]"
                style={{
                  top: activeRect.bottom,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: DARK,
                  backdropFilter: BLUR,
                  WebkitBackdropFilter: BLUR,
                }}
              />
              {/* Left */}
              <div
                className="pointer-events-none fixed z-[999]"
                style={{
                  top: activeRect.top,
                  left: 0,
                  width: activeRect.left,
                  height: activeRect.height,
                  background: DARK,
                  backdropFilter: BLUR,
                  WebkitBackdropFilter: BLUR,
                }}
              />
              {/* Right */}
              <div
                className="pointer-events-none fixed z-[999]"
                style={{
                  top: activeRect.top,
                  left: activeRect.right,
                  right: 0,
                  height: activeRect.height,
                  background: DARK,
                  backdropFilter: BLUR,
                  WebkitBackdropFilter: BLUR,
                }}
              />
              {/* Border around active component */}
              <div
                className="pointer-events-none fixed z-[1000]"
                style={{
                  top: activeRect.top,
                  left: activeRect.left,
                  width: activeRect.width,
                  height: activeRect.height,
                  border: "2px dashed rgba(99, 102, 241, 0.7)",
                  borderRadius: 4,
                }}
              />
            </>
          )}
          {children}
        </div>
      </Portal>
    </>
  );
};
