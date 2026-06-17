import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { SentinelDialog } from "../ui/widgets/SentinelDialog";
import { Spotlight } from "../ui/widgets/Spotlight";

type DialogMeta = {
  componentName?: string;
  sourceFile?: string;
  renderCount?: number;
  propHistory?: Record<string, any>[];
  md?: string;
  componentProps?: Record<string, any>;
};

type SentinelInteractionContextType = {
  activeId: string | null;
  activeRect: DOMRect | null;
  registerHover: (id: string, rect: DOMRect) => void;
  unregisterHover: (id: string) => void;
  openDialog: (
    id: string,
    componentName?: string,
    md?: string,
    componentProps?: Record<string, any>,
    sourceFile?: string,
    renderCount?: number,
    propHistory?: Record<string, any>[],
  ) => void;
};

type SentinelDialogContextType = {
  openDialogId: string | null;
  dialogMeta: DialogMeta;
  closeDialog: () => void;
};

const SentinelInteractionContext = createContext<
  SentinelInteractionContextType | undefined
>(undefined);

const SentinelDialogContext = createContext<
  SentinelDialogContextType | undefined
>(undefined);

export const SentinelProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [openDialogId, setOpenDialogId] = useState<string | null>(null);
  const [dialogMeta, setDialogMeta] = useState<DialogMeta>({});

  const registerHover = useCallback((id: string, rect: DOMRect) => {
    setActiveId(id);
    setActiveRect(rect);
  }, []);

  const unregisterHover = useCallback((id: string) => {
    setActiveId((prev) => {
      if (prev === id) {
        setActiveRect(null);
        return null;
      }
      return prev;
    });
  }, []);

  const openDialog = useCallback(
    (
      id: string,
      componentName?: string,
      md?: string,
      componentProps?: Record<string, any>,
      sourceFile?: string,
      renderCount?: number,
      propHistory?: Record<string, any>[],
    ) => {
      setOpenDialogId(id);
      setDialogMeta({ componentName, sourceFile, renderCount, propHistory, md, componentProps });
    },
    [],
  );

  const closeDialog = useCallback(() => {
    setOpenDialogId(null);
    setDialogMeta({});
  }, []);

  const interactionValue = useMemo(
    () => ({ activeId, activeRect, registerHover, unregisterHover, openDialog }),
    [activeId, activeRect, registerHover, unregisterHover, openDialog],
  );

  const dialogValue = useMemo(
    () => ({ openDialogId, dialogMeta, closeDialog }),
    [openDialogId, dialogMeta, closeDialog],
  );

  return (
    <SentinelInteractionContext.Provider value={interactionValue}>
      <SentinelDialogContext.Provider value={dialogValue}>
        {children}
        <Spotlight>
          <SentinelDialog />
        </Spotlight>
      </SentinelDialogContext.Provider>
    </SentinelInteractionContext.Provider>
  );
};

const noopInteraction: SentinelInteractionContextType = {
  activeId: null,
  activeRect: null,
  registerHover: () => {},
  unregisterHover: () => {},
  openDialog: () => {},
};

const noopDialog: SentinelDialogContextType = {
  openDialogId: null,
  dialogMeta: {},
  closeDialog: () => {},
};

export const useSentinelInteraction = () =>
  useContext(SentinelInteractionContext) ?? noopInteraction;

export const useSentinelDialog = () =>
  useContext(SentinelDialogContext) ?? noopDialog;

// Geriye dönük uyumluluk için birleşik hook
export const useSentinel = () => {
  const interaction = useSentinelInteraction();
  const dialog = useSentinelDialog();
  return { ...interaction, ...dialog };
};
