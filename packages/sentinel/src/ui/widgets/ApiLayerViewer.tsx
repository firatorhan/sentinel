import React from "react";
import { Clock, Link2 } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../components/Accordion";
import { Badge } from "../components/Badge";
import { Alert, AlertDescription } from "../components/Alert";
import { ToggleGroup, ToggleGroupItem } from "../components/ToggleGroup";
import { JsonNode } from "./JsonNode";
import { CopyButton } from "./CopyButton";
import { cn } from "../../utils/cn";
import { type EffectRecord } from "../../saga/createSentinelSagaMonitor";
import {
  extractApiCalls,
  correlateProps,
  detectFragmentIds,
  sortApiCalls,
  buildCurl,
  type ApiCall,
} from "../../utils/apiCalls";

const METHOD_COLOR: Record<string, string> = {
  GET: "text-emerald-400 border-emerald-400/50",
  POST: "text-sky-400 border-sky-400/50",
  PUT: "text-amber-400 border-amber-400/50",
  PATCH: "text-purple-400 border-purple-400/50",
  DELETE: "text-red-400 border-red-400/50",
};

const statusColor = (call: ApiCall): string => {
  if (call.effectStatus === "pending") return "text-amber-400";
  if (call.responseStatus !== undefined && call.responseStatus < 400) return "text-emerald-400";
  return "text-red-400";
};

const displayPath = (url: string): string => {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
};


const callMatchesSearch = (call: ApiCall, q: string): boolean =>
  call.url.toLowerCase().includes(q) ||
  call.method.toLowerCase().includes(q) ||
  call.origin.includes(q) ||
  String(call.responseStatus ?? "").includes(q) ||
  (call.errorMessage?.toLowerCase().includes(q) ?? false) ||
  call.fnName.toLowerCase().includes(q);

export const ApiLayerViewer = ({
  effects,
  serverEffects,
  componentProps,
  search,
}: {
  effects?: EffectRecord[];
  serverEffects?: EffectRecord[];
  componentProps?: Record<string, unknown>;
  // External filter (e.g. the toolbar pane's search input)
  search?: string;
}) => {
  const calls = React.useMemo(
    () =>
      correlateProps(
        [
          ...extractApiCalls(effects ?? [], componentProps, "client"),
          ...extractApiCalls(serverEffects ?? [], componentProps, "server"),
        ],
        componentProps,
      ).sort(sortApiCalls),
    [effects, serverEffects, componentProps],
  );
  const hasServerCalls = React.useMemo(() => calls.some((c) => c.origin === "server"), [calls]);
  // Same origin+method+URL captured more than once → likely a redundant
  // request (identical batch entries excluded: they share one effectId).
  const duplicateCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    const seenEffects = new Map<string, Set<number>>();
    for (const call of calls) {
      const key = `${call.origin} ${call.method} ${call.url}`;
      const effectIds = seenEffects.get(key) ?? new Set<number>();
      effectIds.add(call.effectId);
      seenEffects.set(key, effectIds);
      counts.set(key, effectIds.size);
    }
    return counts;
  }, [calls]);
  const matched = React.useMemo(
    () => calls.filter((c) => c.matchScore > 0 || c.directMatch),
    [calls],
  );
  const [view, setView] = React.useState<"matched" | "all">("matched");

  const hasMatches = matched.length > 0;
  const q = (search ?? "").trim().toLowerCase();
  const base = view === "matched" && hasMatches ? matched : calls;
  const displayed = q ? base.filter((c) => callMatchesSearch(c, q)) : base;

  const fragmentIds = React.useMemo(
    () => [
      ...new Set([
        ...detectFragmentIds(effects ?? [], componentProps),
        ...detectFragmentIds(serverEffects ?? [], componentProps),
      ]),
    ],
    [effects, serverEffects, componentProps],
  );
  const hasDirectMatch = calls.some((c) => c.directMatch);

  if (calls.length === 0) {
    return (
      <Alert className="m-1! p-3!">
        <AlertDescription className="text-xs">
          No API calls captured.
          <span className="block text-muted-foreground mt-1">
            HTTP requests made through the connected saga monitor will appear here with
            request/response details and a copy-as-cURL shortcut.
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-1">
      {fragmentIds.length > 0 && (
        <div className="px-1 text-[10px] text-muted-foreground font-mono">
          fragment id{fragmentIds.length > 1 ? "s" : ""} in props:{" "}
          <span className={hasDirectMatch ? "text-emerald-400" : "text-foreground"}>
            {fragmentIds.join(", ")}
          </span>
          {!hasDirectMatch && (
            <span className="text-amber-400">
              {" "}— no captured request matches this id
            </span>
          )}
        </div>
      )}
      {componentProps &&
        (hasMatches ? (
          matched.length < calls.length && (
            <div className="flex justify-end px-1">
              <ToggleGroup
                type="single"
                value={view}
                onValueChange={(v) => v && setView(v as "matched" | "all")}
              >
                <ToggleGroupItem value="matched" className="h-6 px-2 text-[10px]">
                  Props match ({matched.length})
                </ToggleGroupItem>
                <ToggleGroupItem value="all" className="h-6 px-2 text-[10px]">
                  All ({calls.length})
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          )
        ) : (
          <div className="px-1 text-[10px] text-muted-foreground">
            No request correlates with this component's props — showing all {calls.length} calls.
          </div>
        ))}
      {displayed.length === 0 ? (
        <span className="text-muted-foreground italic text-xs px-1">No results for "{search}"</span>
      ) : (
        <Accordion type="multiple" className="w-full font-mono text-xs">
          {displayed.map((call) => (
            <ApiCallItem
              key={`${call.origin}-${call.effectId}-${call.subIndex ?? 0}`}
              call={call}
              showOrigin={hasServerCalls}
              duplicateCount={duplicateCounts.get(`${call.origin} ${call.method} ${call.url}`) ?? 1}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
};

const PropsMapping = ({ call }: { call: ApiCall }) => {
  const { propMatches, unmatchedPropPaths } = call;
  if (!propMatches || propMatches.length === 0) return null;

  const total = propMatches.length + (unmatchedPropPaths?.length ?? 0);

  return (
    <Accordion type="multiple" className="w-full font-mono text-xs bg-muted rounded-md">
      <AccordionItem value="props-mapping" className="border-b-0">
        <AccordionTrigger className="py-2 px-2 hover:no-underline rounded font-mono text-xs font-normal text-muted-foreground">
          <span className="flex-1 min-w-0 text-left">props mapping</span>
          <span className="shrink-0 mr-2">
            {propMatches.length}/{total} traced
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-2! pt-0 px-2">
          <div className="space-y-0.5 overflow-x-hidden">
            {propMatches.map((m) => (
              <div
                key={m.propPath}
                className={cn(
                  "flex flex-wrap items-baseline gap-x-1.5",
                  m.weight === 0 && "opacity-50",
                )}
                title={m.weight === 0 ? "Value occurs in every response — no correlation signal" : m.preview}
              >
                <span className="text-sky-400 break-all">
                  {m.propPath}
                </span>
                <span className="text-muted-foreground shrink-0">←</span>
                <span className="text-foreground break-all">{m.responsePaths[0]}</span>
                {m.responsePaths.length > 1 && (
                  <span className="text-muted-foreground">
                    +{m.responsePaths.length - 1} more
                  </span>
                )}
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

const ORIGIN_BADGE: Record<ApiCall["origin"], string> = {
  client: "text-muted-foreground border-border",
  server: "text-purple-400 border-purple-400/50",
};

const ApiCallItem = ({
  call,
  showOrigin = false,
  duplicateCount = 1,
}: {
  call: ApiCall;
  showOrigin?: boolean;
  duplicateCount?: number;
}) => {
  const highlightPaths = React.useMemo(
    () => new Set((call.propMatches ?? []).flatMap((m) => m.responsePaths)),
    [call.propMatches],
  );

  return (
  <AccordionItem value={`${call.origin}-${call.effectId}-${call.subIndex ?? 0}`}>
    <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded font-mono text-xs font-normal">
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 px-1.5 py-0 text-[10px] font-mono leading-4 rounded",
          METHOD_COLOR[call.method] ?? "text-muted-foreground border-border",
        )}
      >
        {call.method}
      </Badge>
      {showOrigin && (
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 ml-1 px-1.5 py-0 text-[10px] font-mono leading-4 rounded",
            ORIGIN_BADGE[call.origin],
          )}
        >
          {call.origin}
        </Badge>
      )}
      <span className="flex-1 min-w-0 line-clamp-1 break-all text-left text-foreground mx-2">
        {displayPath(call.url)}
      </span>
      {duplicateCount > 1 && (
        <span
          title={`This request was made ${duplicateCount} times — possibly redundant`}
          className="shrink-0 text-amber-400 mr-1 text-[10px] font-semibold"
        >
          ×{duplicateCount}
        </span>
      )}
      {(call.directMatch || call.matchScore > 0) && (
        <span
          title={
            call.directMatch
              ? "Fragment id match — this request produced the selected component"
              : `${(call.propMatches ?? []).filter((m) => m.weight > 0).length} distinctive prop value(s) traced to this response`
          }
          className={cn("shrink-0 mr-1", call.directMatch ? "text-emerald-400" : "text-sky-400")}
        >
          <Link2 size={11} />
        </span>
      )}
      <span className={cn("shrink-0 mr-1", statusColor(call))}>
        {call.effectStatus === "pending" ? (
          <Clock size={11} />
        ) : (
          (call.responseStatus ?? "ERR")
        )}
      </span>
      {call.duration !== undefined && (
        <span className="shrink-0 text-muted-foreground mr-1">{call.duration}ms</span>
      )}
    </AccordionTrigger>

    <AccordionContent className="pb-2! pt-0 px-1">
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2 px-1">
          <span className="text-muted-foreground break-all min-w-0">{call.url}</span>
          <CopyButton getText={() => buildCurl(call)} label="Copy as cURL" />
        </div>

        {call.requestHeaders && Object.keys(call.requestHeaders).length > 0 && (
          <div className="bg-muted p-2! rounded-md overflow-x-hidden">
            <div className="text-muted-foreground mb-1!">request headers</div>
            <JsonNode value={call.requestHeaders} collapseFromDepth={0} />
          </div>
        )}

        {call.requestBody !== undefined && call.requestBody !== null && (
          <div className="bg-muted p-2! rounded-md overflow-x-hidden">
            <div className="text-muted-foreground mb-1!">request body</div>
            <JsonNode value={call.requestBody} collapseFromDepth={1} />
          </div>
        )}

        {call.errorMessage && (
          <div className="bg-destructive/10 text-destructive p-2! rounded-md overflow-x-hidden">
            <div className="mb-1! font-medium">error</div>
            <span className="break-all">{call.errorMessage}</span>
          </div>
        )}

        <PropsMapping call={call} />

        {call.responseData !== undefined && (
          <div className="bg-primary text-primary-foreground p-2! rounded-md overflow-x-hidden">
            <div className="text-muted-foreground mb-1">
              response
              {call.responseStatus !== undefined && (
                <span className={statusColor(call)}>
                  {" "}· {call.responseStatus} {call.responseStatusText ?? ""}
                </span>
              )}
            </div>
            <JsonNode
              value={call.responseData}
              collapseFromDepth={1}
              highlightPaths={highlightPaths}
            />
          </div>
        )}
      </div>
    </AccordionContent>
  </AccordionItem>
  );
};
