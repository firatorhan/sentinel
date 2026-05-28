import React, { createContext, useContext, useState } from "react";
import { Portal } from "@huin-core/react-portal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/components/Dialog";
import { Button } from "../ui/components/Button";
import { SentinelDialog } from "../ui/widgets/SentinelDialog";
type SentinelContextType = {
  activeId: string | null;
  activeRect: DOMRect | null;
  openDialogId: string | null;
  dialogMeta: { title?: string; description?: string };
  registerHover: (id: string, rect: DOMRect) => void;
  unregisterHover: (id: string) => void;
  openDialog: (id: string, title?: string, description?: string) => void;
  closeDialog: () => void;
};

export const SentinelContext = createContext<SentinelContextType | undefined>(
  undefined,
);

export const SentinelProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [openDialogId, setOpenDialogId] = useState<string | null>(null);
  const [dialogMeta, setDialogMeta] = useState<{
    title?: string;
    description?: string;
  }>({});

  const registerHover = (id: string, rect: DOMRect) => {
    setActiveId(id);
    setActiveRect(rect);
  };

  const unregisterHover = (id: string) => {
    setActiveId((prev) => (prev === id ? null : prev));
    setActiveRect((prev) =>
      prev?.width && activeId === id ? null : activeRect,
    );
  };

  const openDialog = (id: string, title?: string, description?: string) => {
    setOpenDialogId(id);
    setDialogMeta({ title, description });
  };

  const closeDialog = () => {
    setOpenDialogId(null);
    setDialogMeta({});
  };

  const centerX = activeRect ? activeRect.left + activeRect.width / 2 : 0;
  const centerY = activeRect ? activeRect.top + activeRect.height / 2 : 0;

  return (
    <SentinelContext.Provider
      value={{
        activeId,
        activeRect,
        openDialogId,
        dialogMeta,
        registerHover,
        unregisterHover,
        openDialog,
        closeDialog,
      }}
    >
      {children}

      <Portal>
        {/* GLOBAL BLUR KATMANI */}
        {activeRect && (
          <div
            className="pointer-events-none fixed inset-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
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

        <SentinelDialog />

       
      </Portal>
    </SentinelContext.Provider>
  );
};

export const useSentinel = () => {
  const context = useContext(SentinelContext);
  if (!context)
    throw new Error("useSentinel must be used within a SentinelProvider");
  return context;
};
