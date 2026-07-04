import React from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../components/Accordion";
import { Badge } from "../components/Badge";
import { Alert, AlertDescription } from "../components/Alert";
import { Input } from "../components/Input";
import { cn } from "../../utils/cn";
import { type EffectRecord } from "../../saga/createSentinelSagaMonitor";
import { type ActionRecord } from "../../redux/createSentinelReduxMiddleware";
import { buildLineage, type LineageEntry } from "../../utils/lineage";

const displayPath = (url: string): string => {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
};

const Arrow = () => <span className="text-muted-foreground shrink-0">←</span>;

const ORIGIN_BADGE: Record<"client" | "server", string> = {
  client: "text-muted-foreground border-border",
  server: "text-purple-400 border-purple-400/50",
};

export const LineageViewer = ({
  componentProps,
  state,
  serverState,
  clientActions,
  serverActions,
  clientEffects,
  serverEffects,
}: {
  componentProps?: Record<string, unknown>;
  state?: unknown;
  serverState?: unknown;
  clientActions?: ActionRecord[];
  serverActions?: ActionRecord[];
  clientEffects?: EffectRecord[];
  serverEffects?: EffectRecord[];
}) => {
  const entries = React.useMemo(
    () =>
      buildLineage({
        componentProps,
        state,
        serverState,
        clientActions,
        serverActions,
        clientEffects,
        serverEffects,
      }),
    [componentProps, state, serverState, clientActions, serverActions, clientEffects, serverEffects],
  );

  const [search, setSearch] = React.useState("");
  const filtered = React.useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    // Match anywhere along the chain: prop, state, action or request URL
    return entries.filter((e) =>
      [e.propPath, e.preview, ...(e.statePaths ?? []), e.actionType, e.api?.url, e.api?.method]
        .some((segment) => segment?.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  if (entries.length === 0) {
    return (
      <Alert className="m-1! p-3!">
        <AlertDescription className="text-xs">
          No lineage traced for this component's props.
          <span className="block text-muted-foreground mt-1">
            Lineage links a prop value to the redux state path holding it, the
            action that last changed that slice, and the API request behind it.
            It needs distinctive prop values captured in the state/effect logs.
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search lineage… (prop, state path, action, url)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-7 text-xs"
      />
      {filtered.length === 0 ? (
        <span className="text-muted-foreground italic text-xs px-1">No results for "{search}"</span>
      ) : (
        <Accordion type="multiple" className="w-full font-mono text-xs">
          {filtered.map((entry) => (
            <LineageRow key={entry.propPath} entry={entry} />
          ))}
        </Accordion>
      )}
    </div>
  );
};

const LineageRow = ({ entry }: { entry: LineageEntry }) => (
  <AccordionItem value={entry.propPath}>
    <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded font-mono text-xs font-normal">
      <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 flex-1 min-w-0 text-left">
        <span className="text-sky-400 break-all" title={entry.preview}>
          {entry.propPath}
        </span>
        {entry.statePaths && (
          <>
            <Arrow />
            <span className="text-violet-400 break-all">state.{entry.statePaths[0]}</span>
          </>
        )}
        {entry.actionType && (
          <>
            <Arrow />
            <span className="text-amber-400 break-all">{entry.actionType}</span>
          </>
        )}
        {entry.api && (
          <>
            <Arrow />
            <span className="text-emerald-400 break-all">
              {entry.api.method} {displayPath(entry.api.url)}
            </span>
          </>
        )}
      </span>
    </AccordionTrigger>

    <AccordionContent className="pb-2! pt-0 px-2">
      <div className="space-y-1 text-muted-foreground">
        <div>
          <span className="text-sky-400">prop</span> {entry.propPath} = {entry.preview}
        </div>
        {entry.statePaths?.map((path) => (
          <div key={path}>
            <span className="text-violet-400">state</span> {path}
          </div>
        ))}
        {entry.actionType && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-amber-400">action</span>
            <span className="text-foreground">{entry.actionType}</span>
            {entry.actionOrigin && (
              <Badge
                variant="outline"
                className={cn(
                  "px-1.5 py-0 text-[10px] font-mono leading-4 rounded",
                  ORIGIN_BADGE[entry.actionOrigin],
                )}
              >
                {entry.actionOrigin}
              </Badge>
            )}
          </div>
        )}
        {entry.api && (
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-emerald-400">api</span>
            <span className="text-foreground break-all">
              {entry.api.method} {entry.api.url}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "px-1.5 py-0 text-[10px] font-mono leading-4 rounded",
                ORIGIN_BADGE[entry.api.origin],
              )}
            >
              {entry.api.origin}
            </Badge>
            <span>
              {entry.api.via === "response-value"
                ? entry.api.responsePath
                  ? `value found at ${entry.api.responsePath}`
                  : "value found in response"
                : "linked through the saga that dispatched the action"}
            </span>
          </div>
        )}
      </div>
    </AccordionContent>
  </AccordionItem>
);
