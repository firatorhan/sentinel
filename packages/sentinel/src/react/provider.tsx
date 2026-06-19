import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SentinelDialog } from "../ui/widgets/SentinelDialog";
import { SentinelToolbar } from "../ui/widgets/SentinelToolbar";
import { Spotlight } from "../ui/widgets/Spotlight";
import { type SentinelSagaMonitor } from "../saga/createSentinelSagaMonitor";

type DialogMeta = {
  componentName?: string;
  sourceFile?: string;
  renderCount?: number;
  propHistory?: Record<string, any>[];
  md?: string;
  componentProps?: Record<string, any>;
};

export type ReduxStore = {
  getState: () => unknown;
  subscribe: (listener: () => void) => () => void;
};

type SentinelInteractionContextType = {
  activeId: string | null;
  activeRect: DOMRect | null;
  isActive: boolean;
  setIsActive: (value: boolean) => void;
  showOutlines: boolean;
  setShowOutlines: (value: boolean) => void;
  highlightName: string;
  setHighlightName: (value: string) => void;
  reduxStore: ReduxStore | undefined;
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
  store: reduxStore,
  sagaMonitor,
}: {
  children: React.ReactNode;
  store?: ReduxStore;
  sagaMonitor?: SentinelSagaMonitor;
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [openDialogId, setOpenDialogId] = useState<string | null>(null);
  const [dialogMeta, setDialogMeta] = useState<DialogMeta>({});
  const [isActive, setIsActive] = useState(false);
  const [showOutlines, setShowOutlines] = useState(false);
  const [highlightName, setHighlightName] = useState("");

  useEffect(() => {
    if (!isActive) {
      setActiveId(null);
      setActiveRect(null);
      setOpenDialogId(null);
      setDialogMeta({});
    }
  }, [isActive]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        setIsActive((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    () => ({ activeId, activeRect, isActive, setIsActive, showOutlines, setShowOutlines, highlightName, setHighlightName, reduxStore, registerHover, unregisterHover, openDialog }),
    [activeId, activeRect, isActive, showOutlines, highlightName, reduxStore, registerHover, unregisterHover, openDialog],
  );

  const dialogValue = useMemo(
    () => ({ openDialogId, dialogMeta, closeDialog }),
    [openDialogId, dialogMeta, closeDialog],
  );

  return (
    <SentinelInteractionContext.Provider value={interactionValue}>
      <SentinelDialogContext.Provider value={dialogValue}>
        {children}
        <Spotlight active={isActive}>
          <SentinelDialog />
        </Spotlight>
        <SentinelToolbar sagaMonitor={sagaMonitor} />
      </SentinelDialogContext.Provider>
    </SentinelInteractionContext.Provider>
  );
};

const noopInteraction: SentinelInteractionContextType = {
  activeId: null,
  activeRect: null,
  isActive: false,
  setIsActive: () => {},
  showOutlines: false,
  setShowOutlines: () => {},
  highlightName: "",
  setHighlightName: () => {},
  reduxStore: undefined,
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
