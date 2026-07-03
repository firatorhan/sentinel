import React from "react";
import { Clock, Copy, Check, Link2 } from "lucide-react";
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
import { cn } from "../../utils/cn";
import { type EffectRecord } from "../../saga/createSentinelSagaMonitor";
import { extractApiCalls, buildCurl, type ApiCall } from "../../utils/apiCalls";

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

const CurlButton = ({ call }: { call: ApiCall }) => {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    try {
      void navigator.clipboard?.writeText(buildCurl(call));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      onClick={copy}
      className={cn(
        "shrink-0 inline-flex items-center gap-1 text-xs transition-colors cursor-pointer",
        copied ? "text-emerald-400" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy as cURL"}
    </button>
  );
};

export const ApiLayerViewer = ({
  effects,
  serverEffects,
  componentProps,
}: {
  effects?: EffectRecord[];
  serverEffects?: EffectRecord[];
  componentProps?: Record<string, unknown>;
}) => {
  const calls = React.useMemo(
    () =>
      [
        ...extractApiCalls(effects ?? [], componentProps, "client"),
        ...extractApiCalls(serverEffects ?? [], componentProps, "server"),
      ].sort((a, b) => b.matchScore - a.matchScore || b.startedAt - a.startedAt),
    [effects, serverEffects, componentProps],
  );
  const hasServerCalls = React.useMemo(() => calls.some((c) => c.origin === "server"), [calls]);
  const matched = React.useMemo(() => calls.filter((c) => c.matchScore > 0), [calls]);
  const [view, setView] = React.useState<"matched" | "all">("matched");

  const hasMatches = matched.length > 0;
  const displayed = view === "matched" && hasMatches ? matched : calls;

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
      {hasMatches ? (
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
      )}
      <Accordion type="multiple" className="w-full font-mono text-xs">
        {displayed.map((call) => (
          <ApiCallItem
            key={`${call.origin}-${call.effectId}`}
            call={call}
            showOrigin={hasServerCalls}
          />
        ))}
      </Accordion>
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
              <div key={m.propPath} className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-sky-400 break-all" title={m.preview}>
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

const ApiCallItem = ({ call, showOrigin = false }: { call: ApiCall; showOrigin?: boolean }) => {
  const highlightPaths = React.useMemo(
    () => new Set((call.propMatches ?? []).flatMap((m) => m.responsePaths)),
    [call.propMatches],
  );

  return (
  <AccordionItem value={`${call.origin}-${call.effectId}`}>
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
      {call.matchScore > 0 && (
        <span
          title={`${call.matchScore} prop value${call.matchScore > 1 ? "s" : ""} traced to this response`}
          className="shrink-0 text-sky-400 mr-1"
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
          <CurlButton call={call} />
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
