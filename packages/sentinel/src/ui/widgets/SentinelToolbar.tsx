import React from "react";
import { ScanEye, Maximize2, Clock, Check, X, Ban } from "lucide-react";
import { Portal } from "@huin-core/react-portal";
import { Popover, PopoverContent, PopoverTrigger } from "../components/Popover";
import { Switch } from "../components/Switch";
import { Label } from "../components/Label";
import { Separator } from "../components/Separator";
import { Input } from "../components/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/Dialog";
import { JsonNode } from "./JsonNode";
import { Badge } from "../components/Badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/Accordion";
import { ScrollArea } from "../components/ScrollArea";
import { ToggleGroup, ToggleGroupItem } from "../components/ToggleGroup";
import { Alert, AlertDescription } from "../components/Alert";
import { useSentinelInteraction } from "../../react";
import { type ReduxStore } from "../../react/provider";
import { type SentinelSagaMonitor, type EffectRecord, type EffectType } from "../../saga/createSentinelSagaMonitor";
import { type SentinelReduxMiddleware, type ActionRecord, type DiffType } from "../../redux/createSentinelReduxMiddleware";
import { cn } from "../../utils/cn";
import { getPreview, filterState, filteredEntries } from "../../utils/stateSearch";

const ReduxAccordion = ({
  items,
  openKeys,
  collapseDepth,
  search,
}: {
  items: { key: string; displayValue: unknown }[];
  openKeys: string[] | undefined;
  collapseDepth: number;
  search: string;
}) =>
  items.length === 0 ? (
    <span className="text-muted-foreground italic text-xs px-1">No results for "{search}"</span>
  ) : (
    <Accordion type="multiple" value={openKeys} className="w-full font-mono text-xs">
      {items.map(({ key, displayValue }) => (
        <AccordionItem key={key} value={key}>
          <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded font-mono text-xs font-normal">
            <span className="flex-1 min-w-0 line-clamp-1 break-all text-left text-foreground">{key}</span>
            <span className="text-muted-foreground text-xs mr-2 shrink-0 font-normal">
              {getPreview(displayValue)}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-2! pt-0 px-1">
            <div className="bg-primary text-primary-foreground p-2! rounded-md font-mono text-xs leading-5 overflow-x-hidden">
              <JsonNode value={displayValue} collapseFromDepth={collapseDepth} />
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );

const ReduxStatePane = ({ state }: { state: unknown }) => {
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);

  const isPlainObject = state !== null && typeof state === "object" && !Array.isArray(state);
  const entries = React.useMemo(
    () => (isPlainObject ? Object.entries(state as Record<string, unknown>) : []),
    [isPlainObject, state],
  );

  const filtered_entries = React.useMemo(
    () => filteredEntries(entries, search),
    [entries, search],
  );

  const openKeys = search ? filtered_entries.map((e) => e.key) : undefined;
  const flatFiltered = filterState(state, search);

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 py-3! gap-2">
        <div className="shrink-0 flex items-center gap-1.5">
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

        <ScrollArea className="flex-1 min-h-0">
          <div className="pr-3">
            {isPlainObject && entries.length > 0 ? (
              <ReduxAccordion items={filtered_entries} openKeys={openKeys} collapseDepth={1} search={search} />
            ) : (
              <div className="bg-primary text-primary-foreground p-3! rounded-md font-mono text-xs leading-5 overflow-x-hidden">
                {flatFiltered !== undefined ? (
                  <JsonNode value={flatFiltered} collapseFromDepth={1} />
                ) : (
                  <span className="text-muted-foreground italic">No results for "{search}"</span>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
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
          <ScrollArea className="flex-1 min-h-0">
            <div className="pr-3">
              {isPlainObject && entries.length > 0 ? (
                <ReduxAccordion items={filtered_entries} openKeys={openKeys} collapseDepth={2} search={search} />
              ) : (
                <div className="bg-primary text-primary-foreground p-4! rounded-md font-mono text-xs leading-5 overflow-x-hidden">
                  {flatFiltered !== undefined ? (
                    <JsonNode value={flatFiltered} collapseFromDepth={2} />
                  ) : (
                    <span className="text-muted-foreground italic">No results for "{search}"</span>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

const DIFF_ICON: Record<DiffType, string> = { added: "+", removed: "−", changed: "~" };
const DIFF_COLOR: Record<DiffType, string> = {
  added: "text-emerald-400",
  removed: "text-red-400",
  changed: "text-amber-400",
};

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 1000) return "just now";
  if (d < 60000) return `${Math.floor(d / 1000)}s ago`;
  return `${Math.floor(d / 60000)}m ago`;
}

const actionMatchesSearch = (record: ActionRecord, q: string): boolean => {
  if (record.action.type.toLowerCase().includes(q)) return true;
  if (record.diff.some(e => e.path.toLowerCase().includes(q))) return true;
  return false;
};

const ActionList = ({ records, search = "" }: { records: ActionRecord[]; search?: string }) => {
  const q = search.toLowerCase();
  const filtered = q ? records.filter(r => actionMatchesSearch(r, q)) : records;
  const [openItems, setOpenItems] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!q) { setOpenItems([]); return; }
    setOpenItems(filtered.map(r => String(r.id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (records.length === 0) {
    return <div className="py-4 text-center text-xs text-muted-foreground">No actions dispatched yet.</div>;
  }

  if (filtered.length === 0) {
    return <span className="text-muted-foreground italic text-xs px-1">No results for "{search}"</span>;
  }

  return (
    <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="w-full font-mono text-xs">
      {filtered.map(record => (
        <AccordionItem key={record.id} value={String(record.id)}>
          <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded font-mono text-xs font-normal">
            <span className="flex-1 min-w-0 line-clamp-1 break-all text-left text-foreground">{record.action.type}</span>
            <span className="shrink-0 text-muted-foreground mr-2 text-[10px]">{timeAgo(record.timestamp)}</span>
            {record.diff.length > 0 && (
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] font-mono leading-4 rounded text-amber-400 border-amber-400/50">
                {record.diff.length}
              </Badge>
            )}
          </AccordionTrigger>
          <AccordionContent className="pb-2! pt-0 px-1">
            {record.diff.length === 0 ? (
              <span className="text-muted-foreground italic text-xs">No state changes</span>
            ) : (
              <div className="space-y-1.5">
                {record.diff.map((entry, i) => (
                  <div key={i} className="bg-muted p-2! rounded-md overflow-x-hidden">
                    <div className="flex items-start gap-1.5 mb-1!">
                      <span className={cn("font-bold text-xs shrink-0 mt-px", DIFF_COLOR[entry.type])}>{DIFF_ICON[entry.type]}</span>
                      <span className="text-foreground text-xs break-all">{entry.path}</span>
                    </div>
                    {entry.type === "changed" && (
                      <div className="space-y-1">
                        <div className="opacity-60 line-through">
                          <JsonNode value={entry.prev} collapseFromDepth={1} />
                        </div>
                        <div className={DIFF_COLOR.added}>
                          <JsonNode value={entry.next} collapseFromDepth={1} />
                        </div>
                      </div>
                    )}
                    {entry.type === "added" && (
                      <div className={DIFF_COLOR.added}>
                        <JsonNode value={entry.next} collapseFromDepth={1} />
                      </div>
                    )}
                    {entry.type === "removed" && (
                      <div className={cn("opacity-60 line-through", DIFF_COLOR.removed)}>
                        <JsonNode value={entry.prev} collapseFromDepth={1} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

const ActionLogPane = ({ records, onClear }: { records: ActionRecord[]; onClear?: () => void }) => {
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 py-3! gap-2">
        <div className="shrink-0 flex items-center gap-1.5">
          <Input
            placeholder="Search actions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
          {onClear && records.length > 0 && (
            <button
              onClick={onClear}
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
        <ScrollArea className="flex-1 min-h-0">
          <div className="pr-3">
            <ActionList records={records} search={search} />
          </div>
        </ScrollArea>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Action Log</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search actions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm shrink-0"
          />
          <ScrollArea className="flex-1 min-h-0">
            <div className="pr-3">
              <ActionList records={records} search={search} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ActionLogTab = ({
  middleware,
  serverActionLog,
}: {
  middleware?: SentinelReduxMiddleware;
  serverActionLog?: ActionRecord[];
}) => {
  const [records, setRecords] = React.useState<ActionRecord[]>(() => middleware?._getRecords() ?? []);
  const [side, setSide] = React.useState<"client" | "server">("server");
  const [serverCleared, setServerCleared] = React.useState(false);

  React.useEffect(() => {
    if (!middleware) return;
    setRecords(middleware._getRecords());
    return middleware._subscribe(() => setRecords([...middleware._getRecords()]));
  }, [middleware]);

  const hasServer = serverActionLog != null;

  if (!hasServer) {
    if (!middleware) {
      return (
        <Alert className="m-3! p-3!">
          <AlertDescription className="text-xs">
            No middleware connected.
            <span className="block font-mono mt-1">createSentinelReduxMiddleware()</span>
          </AlertDescription>
        </Alert>
      );
    }
    return <ActionLogPane records={records} onClear={() => middleware._clear()} />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 flex justify-center pt-2 pb-1">
        <ToggleGroup
          type="single"
          value={side}
          onValueChange={(v) => v && setSide(v as "client" | "server")}
        >
          <ToggleGroupItem value="client" className="text-xs">Client</ToggleGroupItem>
          <ToggleGroupItem value="server" className="text-xs">Server</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {side === "client" ? (
        middleware ? (
          <ActionLogPane records={records} onClear={() => middleware._clear()} />
        ) : (
          <Alert className="m-3! p-3!">
            <AlertDescription className="text-xs">No client middleware connected.</AlertDescription>
          </Alert>
        )
      ) : (
        <ActionLogPane records={serverCleared ? [] : serverActionLog} onClear={() => setServerCleared(true)} />
      )}
    </div>
  );
};

const ReduxStateSection = ({ store, serverState }: { store: ReduxStore | undefined; serverState?: unknown }) => {
  const [clientState, setClientState] = React.useState<unknown>(store?.getState());
  const [side, setSide] = React.useState<"client" | "server">("server");

  React.useEffect(() => {
    if (!store) return;
    setClientState(store.getState());
    return store.subscribe(() => setClientState(store.getState()));
  }, [store]);

  const hasServer = serverState != null;

  if (!hasServer) {
    if (!store) {
      return (
        <Alert className="m-3! p-3!">
          <AlertDescription className="text-xs">
            No store connected.
            <span className="block font-mono mt-1">{"<SentinelProvider store={store}>"}</span>
          </AlertDescription>
        </Alert>
      );
    }
    return <ReduxStatePane state={clientState} />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 flex justify-center pt-2 pb-1">
        <ToggleGroup
          type="single"
          value={side}
          onValueChange={(v) => v && setSide(v as "client" | "server")}
        >
          <ToggleGroupItem value="client" className="text-xs">Client</ToggleGroupItem>
          <ToggleGroupItem value="server" className="text-xs">Server</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {side === "client" ? (
        store ? (
          <ReduxStatePane state={clientState} />
        ) : (
          <Alert className="m-3! p-3!">
            <AlertDescription className="text-xs">No client store connected.</AlertDescription>
          </Alert>
        )
      ) : (
        <ReduxStatePane state={serverState} />
      )}
    </div>
  );
};


const STATUS_ICON: Record<EffectRecord["status"], React.ReactNode> = {
  pending:   <Clock size={11} />,
  resolved:  <Check size={11} />,
  rejected:  <X size={11} />,
  cancelled: <Ban size={11} />,
};

const STATUS_COLOR: Record<EffectRecord["status"], string> = {
  pending: "text-amber-400",
  resolved: "text-emerald-400",
  rejected: "text-red-400",
  cancelled: "text-muted-foreground",
};

const safeFilterState = (value: unknown, q: string): boolean => {
  try {
    return filterState(value, q) !== undefined;
  } catch {
    try {
      return (JSON.stringify(value) ?? "").toLowerCase().includes(q);
    } catch {
      return false;
    }
  }
};

const effectMatchesSearch = (effect: EffectRecord, q: string): boolean => {
  if (effect.fnName.toLowerCase().includes(q)) return true;
  if (effect.type?.toLowerCase().includes(q)) return true;
  if (safeFilterState(effect.args, q)) return true;
  if (effect.result !== undefined && safeFilterState(effect.result, q)) return true;
  if (effect.error !== undefined && safeFilterState(effect.error, q)) return true;
  return false;
};

type TreeNode = { effect: EffectRecord; children: TreeNode[] };

function buildTree(effects: EffectRecord[]): TreeNode[] {
  const ordered = [...effects].reverse();
  const byId = new Map<number, TreeNode>();
  for (const e of ordered) byId.set(e.id, { effect: e, children: [] });
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parent = byId.get(node.effect.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function flattenDFS(nodes: TreeNode[], depth = 0): Array<{ effect: EffectRecord; depth: number }> {
  return nodes.flatMap(n => [{ effect: n.effect, depth }, ...flattenDFS(n.children, depth + 1)]);
}

function getVisibleIds(effects: EffectRecord[], q: string): Set<number> {
  const byId = new Map(effects.map(e => [e.id, e]));
  const matched = new Set(effects.filter(e => effectMatchesSearch(e, q)).map(e => e.id));
  const visible = new Set(matched);
  for (const id of matched) {
    let cur = byId.get(id);
    while (cur) {
      const parent = byId.get(cur.parentId);
      if (!parent) break;
      visible.add(parent.id);
      cur = parent;
    }
  }
  return visible;
}

const TYPE_BADGE: Partial<Record<EffectType, { label: string; className: string }>> = {
  CALL:  { label: "call",  className: "text-emerald-400 border-emerald-400/50" },
  FORK:  { label: "fork",  className: "text-blue-400 border-blue-400/50" },
  SPAWN: { label: "spawn", className: "text-purple-400 border-purple-400/50" },
  TAKE:  { label: "take",  className: "text-amber-400 border-amber-400/50" },
  PUT:   { label: "put",   className: "text-cyan-400 border-cyan-400/50" },
};

const EffectTree = ({ effects, search = "" }: { effects: EffectRecord[]; search?: string }) => {
  const q = search.toLowerCase();

  const roots = React.useMemo(() => buildTree(effects), [effects]);
  const allFlat = React.useMemo(() => flattenDFS(roots), [roots]);

  const visibleIds = React.useMemo(
    () => (q ? getVisibleIds(effects, q) : null),
    [effects, q],
  );

  const displayed = visibleIds ? allFlat.filter(({ effect }) => visibleIds.has(effect.id)) : allFlat;

  const [openItems, setOpenItems] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!q) { setOpenItems([]); return; }
    const matchedIds = effects.filter(e => effectMatchesSearch(e, q)).map(e => String(e.id));
    setOpenItems(matchedIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (effects.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        No calls captured yet.
      </div>
    );
  }

  if (displayed.length === 0) {
    return (
      <span className="text-muted-foreground italic text-xs px-1">No results for "{search}"</span>
    );
  }

  return (
    <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="w-full font-mono text-xs">
      {displayed.map(({ effect, depth }) => {
        const safeDisplay = (val: unknown) => { try { return filterState(val, q); } catch { return undefined; } };
        const displayArgs = q ? (safeDisplay(effect.args) ?? effect.args) : effect.args;
        const displayResult = q && effect.result !== undefined ? (safeDisplay(effect.result) ?? effect.result) : effect.result;
        const displayError = q && effect.error !== undefined ? (safeDisplay(effect.error) ?? effect.error) : effect.error;
        const typeBadge = TYPE_BADGE[effect.type];

        return (
          <AccordionItem key={effect.id} value={String(effect.id)}>
            <AccordionTrigger
              className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded font-mono text-xs font-normal"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <span className={cn("shrink-0 w-4 text-center", STATUS_COLOR[effect.status])}>
                {STATUS_ICON[effect.status]}
              </span>
              {typeBadge && (
                <Badge variant="outline" className={cn("shrink-0 ml-1 px-1.5 py-0 text-[10px] font-mono leading-4 rounded", typeBadge.className)}>
                  {typeBadge.label}
                </Badge>
              )}
              <span className="flex-1 min-w-0 line-clamp-1 break-all text-left text-foreground mx-2">{effect.fnName}</span>
              {effect.duration !== undefined && (
                <span className="shrink-0 text-muted-foreground mr-1">{effect.duration}ms</span>
              )}
            </AccordionTrigger>

            <AccordionContent className="pb-2! pt-0 px-1" style={{ paddingLeft: `${depth * 12 + 8}px` }}>
              <div className="space-y-1.5">
                {(effect.args?.length ?? 0) > 0 && (
                  <div className="bg-muted p-2! rounded-md overflow-x-hidden">
                    <div className="text-muted-foreground mb-1!">args</div>
                    <JsonNode value={displayArgs} collapseFromDepth={q ? 10 : 1} />
                  </div>
                )}
                {effect.result !== undefined && (
                  <div className="bg-primary text-primary-foreground p-2! rounded-md overflow-x-hidden">
                    <div className="text-muted-foreground mb-1">result</div>
                    <JsonNode value={displayResult} collapseFromDepth={q ? 10 : 1} />
                  </div>
                )}
                {displayError !== undefined && (
                  <div className="bg-destructive/10 text-destructive p-2! rounded-md overflow-x-hidden">
                    <div className="mb-1! font-medium">error</div>
                    <JsonNode
                      value={displayError instanceof Error ? displayError.message : displayError}
                      collapseFromDepth={q ? 10 : 1}
                    />
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

const SagaTypeFilters = ({
  effects,
  activeTypes,
  onChange,
}: {
  effects: EffectRecord[];
  activeTypes: EffectType[];
  onChange: (types: EffectType[]) => void;
}) => {
  const availableTypes = React.useMemo(
    () => [...new Set(effects.map((e) => e.type))].filter(Boolean) as EffectType[],
    [effects],
  );

  if (availableTypes.length === 0) return null;

  return (
    <ToggleGroup
      type="multiple"
      value={activeTypes}
      onValueChange={(v) => onChange(v as EffectType[])}
      className="shrink-0 justify-start flex-wrap gap-1"
    >
      {availableTypes.map((type) => {
        const badge = TYPE_BADGE[type];
        return (
          <ToggleGroupItem
            key={type}
            value={type}
            className={cn("h-5 px-1.5 min-w-0 text-[10px] font-mono", badge?.className)}
          >
            {badge?.label ?? type.toLowerCase()}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
};

const SagaPane = ({ effects: rawEffects, onClear }: { effects?: EffectRecord[]; onClear?: () => void }) => {
  const effects = rawEffects ?? [];
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const [activeTypes, setActiveTypes] = React.useState<EffectType[]>([]);

  const filteredEffects = React.useMemo(
    () => (activeTypes.length === 0 ? effects : effects.filter((e) => activeTypes.includes(e.type))),
    [effects, activeTypes],
  );

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 py-3! gap-2">
        <div className="shrink-0 flex items-center gap-1.5">
          <Input
            placeholder="Deep search calls…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
          {onClear && effects.length > 0 && (
            <button
              onClick={onClear}
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
        <SagaTypeFilters effects={effects} activeTypes={activeTypes} onChange={setActiveTypes} />
        <ScrollArea className="flex-1 min-h-0">
          <div className="pr-3">
            <EffectTree key={activeTypes.join("-")} effects={filteredEffects} search={search} />
          </div>
        </ScrollArea>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Saga Calls</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Deep search calls…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm shrink-0"
          />
          <SagaTypeFilters effects={effects} activeTypes={activeTypes} onChange={setActiveTypes} />
          <ScrollArea className="flex-1 min-h-0">
            <div className="pr-3">
              <EffectTree key={activeTypes.join("-")} effects={filteredEffects} search={search} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

const SagaTab = ({ monitor, serverEffects }: { monitor: SentinelSagaMonitor | undefined; serverEffects?: EffectRecord[] }) => {
  const [effects, setEffects] = React.useState<EffectRecord[]>(() => monitor?._getEffects() ?? []);
  const [side, setSide] = React.useState<"client" | "server">("server");
  const [serverCleared, setServerCleared] = React.useState(false);

  React.useEffect(() => {
    if (!monitor) return;
    setEffects(monitor._getEffects());
    return monitor._subscribe(() => setEffects(monitor._getEffects()));
  }, [monitor]);

  const hasServer = serverEffects != null;

  if (!hasServer) {
    if (!monitor) {
      return (
        <Alert className="m-3! p-3!">
          <AlertDescription className="text-xs">
            No saga monitor connected.
            <span className="block font-mono mt-1">{"sagaMonitor={sentinelMonitor}"}</span>
          </AlertDescription>
        </Alert>
      );
    }
    return <SagaPane effects={effects} onClear={() => monitor._clear()} />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 flex justify-center pt-2 pb-1">
        <ToggleGroup
          type="single"
          value={side}
          onValueChange={(v) => v && setSide(v as "client" | "server")}
        >
          <ToggleGroupItem value="client" className="text-xs">Client</ToggleGroupItem>
          <ToggleGroupItem value="server" className="text-xs">Server</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {side === "client" ? (
        monitor ? (
          <SagaPane effects={effects} onClear={() => monitor._clear()} />
        ) : (
          <Alert className="m-3! p-3!">
            <AlertDescription className="text-xs">No client monitor connected.</AlertDescription>
          </Alert>
        )
      ) : (
        <SagaPane effects={serverCleared ? [] : serverEffects} onClear={() => setServerCleared(true)} />
      )}
    </div>
  );
};

export const SentinelToolbar = ({
  sagaMonitor,
  serverState,
  serverSagaEffects,
  reduxMiddleware,
  serverActionLog,
}: {
  sagaMonitor?: SentinelSagaMonitor;
  serverState?: unknown;
  serverSagaEffects?: EffectRecord[];
  reduxMiddleware?: SentinelReduxMiddleware;
  serverActionLog?: ActionRecord[];
}) => {
  const {
    isActive, setIsActive,
    showOutlines, setShowOutlines,
    highlightName, setHighlightName,
    reduxStore,
  } = useSentinelInteraction();

  const [sagaEffectCount, setSagaEffectCount] = React.useState(() => sagaMonitor?._getEffects().length ?? 0);
  const [sagaRejectedCount, setSagaRejectedCount] = React.useState(
    () => sagaMonitor?._getEffects().filter(e => e.status === "rejected").length ?? 0,
  );
  const [logCount, setLogCount] = React.useState(() => reduxMiddleware?._getRecords().length ?? 0);

  React.useEffect(() => {
    if (!sagaMonitor) return;
    const update = () => {
      const effects = sagaMonitor._getEffects();
      setSagaEffectCount(effects.length);
      setSagaRejectedCount(effects.filter(e => e.status === "rejected").length);
    };
    update();
    return sagaMonitor._subscribe(update);
  }, [sagaMonitor]);

  React.useEffect(() => {
    if (!reduxMiddleware) return;
    const update = () => setLogCount(reduxMiddleware._getRecords().length);
    update();
    return reduxMiddleware._subscribe(update);
  }, [reduxMiddleware]);

  return (
    <Portal>
      <div className="sentinel-root">
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

          <PopoverContent
            side="top"
            align="end"
            className="w-[440px] h-[540px] flex flex-col overflow-hidden"
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between py-3! shrink-0">
              <div className="flex items-center gap-2">
                <ScanEye size={14} className="text-muted-foreground" />
                <span className="text-sm font-semibold">Sentinel</span>
              </div>
              <kbd className="text-sm text-muted-foreground bg-muted px-1.5! py-0.5! rounded font-mono">
                ⌃ ⇧ S
              </kbd>
            </div>

            <Separator />

            <Tabs defaultValue="controls" className="flex flex-col flex-1 min-h-0">
              <TabsList className="grid w-full grid-cols-4 mx-0 rounded-none border-b bg-transparent h-9 gap-1 shrink-0">
                <TabsTrigger value="controls" className="text-xs">Controls</TabsTrigger>
                <TabsTrigger value="state" className="text-xs gap-1">
                  State
                  {reduxStore && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="log" className="text-xs gap-1">
                  Log
                  {logCount > 0 && (
                    <Badge variant="outline" className="px-1 py-0 text-[9px] font-mono leading-4 h-4 min-w-4">
                      {logCount > 99 ? "99+" : logCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="saga" className="text-xs gap-1">
                  Saga
                  {sagaRejectedCount > 0 ? (
                    <Badge variant="outline" className="px-1 py-0 text-[9px] font-mono leading-4 h-4 min-w-4 text-red-400 border-red-400/50">
                      {sagaRejectedCount}
                    </Badge>
                  ) : sagaEffectCount > 0 ? (
                    <Badge variant="outline" className="px-1 py-0 text-[9px] font-mono leading-4 h-4 min-w-4">
                      {sagaEffectCount > 99 ? "99+" : sagaEffectCount}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="controls" className="mt-0 flex-1 overflow-y-auto">
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

                <div className="py-3! space-y-1.5!">
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

              <TabsContent value="state" className="mt-0 flex-1 flex flex-col min-h-0">
                <ReduxStateSection store={reduxStore} serverState={serverState} />
              </TabsContent>

              <TabsContent value="log" className="mt-0 flex-1 flex flex-col min-h-0">
                <ActionLogTab middleware={reduxMiddleware} serverActionLog={serverActionLog} />
              </TabsContent>

              <TabsContent value="saga" className="mt-0 flex-1 flex flex-col min-h-0">
                <SagaTab monitor={sagaMonitor} serverEffects={serverSagaEffects} />
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>
      </div>
      </div>
    </Portal>
  );
};
