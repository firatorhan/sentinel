import React, { createContext, useContext, useState } from "react";
import { SentinelDialog } from "../ui/widgets/SentinelDialog";
import { Spotlight } from "../ui/widgets/Spotlight";

type SentinelContextType = {
  activeId: string | null;
  activeRect: DOMRect | null;
  openDialogId: string | null;
  dialogMeta: {
    title?: string;
    md?: string;
    componentProps?: Record<string, any>;
  };
  registerHover: (id: string, rect: DOMRect) => void;
  unregisterHover: (id: string) => void;
  openDialog: (
    id: string,
    title?: string,
    md?: string,
    componentProps?: Record<string, any>,
  ) => void;
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
  const [dialogMeta, setDialogMeta] = useState<
    SentinelContextType["dialogMeta"]
  >({});

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

  const openDialog = (
    id: string,
    title?: string,
    md?: string,
    componentProps?: Record<string, any>,
  ) => {
    setOpenDialogId(id);
    setDialogMeta({ title, md, componentProps });
  };

  const closeDialog = () => {
    setOpenDialogId(null);
    setDialogMeta({});
  };

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

      <Spotlight>
        <SentinelDialog />
      </Spotlight>
    </SentinelContext.Provider>
  );
};

export const useSentinel = () => {
  const context = useContext(SentinelContext);
  if (!context)
    throw new Error("useSentinel must be used within a SentinelProvider");
  return context;
};
