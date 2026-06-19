import React from "react";
import { ScanEye, Maximize2 } from "lucide-react";
import { Portal } from "@huin-core/react-portal";
import { Popover, PopoverContent, PopoverTrigger } from "../components/Popover";
import { Switch } from "../components/Switch";
import { Label } from "../components/Label";
import { Separator } from "../components/Separator";
import { Input } from "../components/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/Dialog";
import { JsonNode } from "./JsonNode";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/Accordion";
import { useSentinelInteraction } from "../../react";
import { type ReduxStore } from "../../react/provider";
import { type SentinelSagaMonitor, type EffectRecord } from "../../saga/createSentinelSagaMonitor";
import { cn } from "../../utils/cn";

const filterState = (value: unknown, query: string): unknown => {
  if (!query) return value;
  const q = query.toLowerCase();

  if (value === null || typeof value !== "object") {
    return String(value).toLowerCase().includes(q) ? value : undefined;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => filterState(item, query))
      .filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k.toLowerCase().includes(q)) {
      result[k] = v;
    } else {
      const child = filterState(v, query);
      if (child !== undefined) result[k] = child;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const ReduxTab = ({ store }: { store: ReduxStore | undefined }) => {
  const [state, setState] = React.useState<unknown>(store?.getState());
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!store) return;
    setState(store.getState());
    return store.subscribe(() => setState(store.getState()));
  }, [store]);

  if (!store) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No store connected.
        <span className="block mt-1 text-xs font-mono">
          {"<SentinelProvider store={store}>"}
        </span>
      </div>
    );
  }

  const filtered = filterState(state, search);

  const JsonTree = ({ collapseDepth }: { collapseDepth: number }) =>
    filtered !== undefined ? (
      <JsonNode value={filtered} collapseFromDepth={collapseDepth} />
    ) : (
      <span className="text-muted-foreground italic">No results for "{search}"</span>
    );

  return (
    <>
      <div className="py-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Search state…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
          <button
            onClick={() => setExpanded(true)}
            title="Expand"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        <div className="max-h-60 overflow-y-auto">
          <div className="bg-primary text-primary-foreground p-3! rounded-md font-mono text-xs leading-5 overflow-x-hidden">
            <JsonTree collapseDepth={1} />
          </div>
        </div>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Redux State</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search state…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm shrink-0"
          />
          <div className="overflow-y-auto min-h-0 flex-1">
            <div className="bg-primary text-primary-foreground p-4! rounded-md font-mono text-xs leading-5 overflow-x-hidden">
              <JsonTree collapseDepth={2} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const STATUS_ICON: Record<EffectRecord["status"], string> = {
  pending: "⏳",
  resolved: "✓",
  rejected: "✗",
  cancelled: "⊘",
};

const STATUS_COLOR: Record<EffectRecord["status"], string> = {
  pending: "text-amber-400",
  resolved: "text-emerald-400",
  rejected: "text-red-400",
  cancelled: "text-muted-foreground",
};

const EffectList = ({ effects }: { effects: EffectRecord[] }) => {
  if (effects.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        No calls captured yet.
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="w-full font-mono text-xs">
      {effects.map((effect) => (
        <AccordionItem key={effect.id} value={String(effect.id)}>
          <AccordionTrigger
            className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded font-mono text-xs font-normal"
          >
            <span className={cn("shrink-0 w-4 text-center", STATUS_COLOR[effect.status])}>
              {STATUS_ICON[effect.status]}
            </span>
            <span className="flex-1 truncate text-left text-foreground mx-2">{effect.fnName}</span>
            {effect.duration !== undefined && (
              <span className="shrink-0 text-muted-foreground mr-1">{effect.duration}ms</span>
            )}
          </AccordionTrigger>

          <AccordionContent className="pb-2! pt-0 px-2">
            <div className="space-y-1.5">
              {effect.args.length > 0 && (
                <div className="bg-muted p-2! rounded overflow-x-hidden">
                  <div className="text-muted-foreground mb-1!">args</div>
                  <JsonNode value={effect.args} collapseFromDepth={1} />
                </div>
              )}
              {effect.result !== undefined && (
                <div className="bg-primary text-primary-foreground p-2! rounded overflow-x-hidden">
                  <div className="text-muted-foreground mb-1">result</div>
                  <JsonNode value={effect.result} collapseFromDepth={1} />
                </div>
              )}
              {effect.error !== undefined && (
                <div className="bg-destructive/10 text-destructive p-2 rounded overflow-x-hidden">
                  <div className="mb-1! font-medium">error</div>
                  <JsonNode
                    value={effect.error instanceof Error ? effect.error.message : effect.error}
                    collapseFromDepth={1}
                  />
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

const SagaTab = ({ monitor }: { monitor: SentinelSagaMonitor | undefined }) => {
  const [effects, setEffects] = React.useState<EffectRecord[]>(() => monitor?._getEffects() ?? []);
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!monitor) return;
    setEffects(monitor._getEffects());
    return monitor._subscribe(() => setEffects(monitor._getEffects()));
  }, [monitor]);

  if (!monitor) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No saga monitor connected.
        <span className="block mt-1 text-xs font-mono">
          {"sagaMonitor={sentinelMonitor}"}
        </span>
      </div>
    );
  }

  const filtered = search
    ? effects.filter((e) => e.fnName.toLowerCase().includes(search.toLowerCase()))
    : effects;

  return (
    <>
      <div className="py-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Search calls…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
          {effects.length > 0 && (
            <button
              onClick={() => monitor._clear()}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setExpanded(true)}
            title="Expand"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        <div className="max-h-60 overflow-y-auto">
          <EffectList effects={filtered} />
        </div>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Saga Calls</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search calls…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm shrink-0"
          />
          <div className="overflow-y-auto min-h-0 flex-1">
            <EffectList effects={filtered} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const SentinelToolbar = ({ sagaMonitor }: { sagaMonitor?: SentinelSagaMonitor }) => {
  const {
    isActive, setIsActive,
    showOutlines, setShowOutlines,
    highlightName, setHighlightName,
    reduxStore,
  } = useSentinelInteraction();

  return (
    <Portal>
      <div className="fixed bottom-4 right-4 z-[9999]">
        <Popover>
          <PopoverTrigger
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
              isActive
                ? "bg-primary text-primary-foreground border-primary/30"
                : "bg-background text-muted-foreground border-border hover:text-foreground",
            )}
          >
            <ScanEye size={18} />
          </PopoverTrigger>

          <PopoverContent side="top" align="end" className="w-72">
            <div className="flex items-center justify-between py-3!">
              <div className="flex items-center gap-2">
                <ScanEye size={14} className="text-muted-foreground" />
                <span className="text-sm font-semibold">Sentinel</span>
              </div>
              <kbd className="text-sm text-muted-foreground bg-muted px-1.5! py-0.5! rounded font-mono">
                ⌃ ⇧ S
              </kbd>
            </div>

            <Separator />

            <Tabs defaultValue="controls">
              <TabsList className="grid w-full grid-cols-3 mx-0 rounded-none border-b bg-transparent h-9 gap-2">
                <TabsTrigger value="controls" className="text-xs">Controls</TabsTrigger>
                <TabsTrigger value="redux" className="text-xs">Redux</TabsTrigger>
                <TabsTrigger value="saga" className="text-xs">Saga</TabsTrigger>
              </TabsList>

              <TabsContent value="controls" className="mt-0">
                <div className="flex items-center justify-between py-3!">
                  <Label htmlFor="sentinel-active-switch" className="cursor-pointer">
                    Active
                  </Label>
                  <Switch
                    id="sentinel-active-switch"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>

                <div className="flex items-center justify-between pb-3!">
                  <Label
                    htmlFor="sentinel-outline-switch"
                    className={cn("cursor-pointer", !isActive && "opacity-40")}
                  >
                    Outline All
                  </Label>
                  <Switch
                    id="sentinel-outline-switch"
                    checked={showOutlines}
                    onCheckedChange={setShowOutlines}
                    disabled={!isActive}
                  />
                </div>

                <Separator />

                <div className="py-3! space-y-1.5">
                  <Label
                    htmlFor="sentinel-filter-input"
                    className={cn("text-xs text-muted-foreground", !isActive && "opacity-40")}
                  >
                    Filter component
                  </Label>
                  <Input
                    id="sentinel-filter-input"
                    placeholder="e.g. ProductCard"
                    value={highlightName}
                    onChange={(e) => setHighlightName(e.target.value)}
                    disabled={!isActive}
                    className="h-8 text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="redux" className="mt-0">
                <ReduxTab store={reduxStore} />
              </TabsContent>

              <TabsContent value="saga" className="mt-0">
                <SagaTab monitor={sagaMonitor} />
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>
      </div>
    </Portal>
  );
};
