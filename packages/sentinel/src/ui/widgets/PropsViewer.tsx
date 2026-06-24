import React, { useMemo, useState } from "react";
import { JsonNode } from "./JsonNode";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/Accordion";
import { Input } from "../components/Input";
import { getPreview, filteredEntries } from "../../utils/stateSearch";

export const PropsViewer = ({
  data,
  history,
}: {
  data: Record<string, unknown>;
  history?: Record<string, unknown>[];
}) => {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const entries = Object.entries(data);
  const filtered = useMemo(() => filteredEntries(entries, search), [entries, search]);
  const openKeys = search ? filtered.map((e) => e.key) : undefined;

  const handleCopy = () => {
    const text = (() => {
      try {
        return JSON.stringify(data, null, 2);
      } catch {
        return "[Circular structure — could not serialize]";
      }
    })();
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const prevRenders = history?.slice(1) ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Input
          placeholder="Search props…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
        <button
          onClick={handleCopy}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <span className="text-muted-foreground italic text-xs px-1">No results for "{search}"</span>
      ) : (
        <Accordion type="multiple" value={openKeys} className="w-full font-mono text-xs">
          {filtered.map(({ key, displayValue }) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-muted/50 rounded font-mono text-xs font-normal">
                <span className="flex-1 text-left truncate text-foreground">{key}</span>
                <span className="text-muted-foreground text-xs mr-2 shrink-0 font-normal">
                  {getPreview(displayValue)}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2! pt-0 px-1">
                <div className="bg-primary text-primary-foreground p-2! rounded-md font-mono text-xs leading-5 overflow-x-hidden">
                  <JsonNode value={displayValue} collapseFromDepth={1} />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {prevRenders.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground px-1 pt-1">History</div>
          <Accordion type="multiple" className="w-full">
            {prevRenders.map((snapshot, i) => (
              <AccordionItem key={i} value={String(i)}>
                <AccordionTrigger
                  className="py-2 px-1 hover:no-underline hover:bg-muted/50 rounded font-mono text-xs font-normal"
                  style={{ opacity: 1 - i * 0.12 }}
                >
                  <span className="text-muted-foreground">-{i + 1} render</span>
                </AccordionTrigger>
                <AccordionContent className="pb-2! pt-0 px-1">
                  <div
                    className="bg-muted p-3! rounded-md font-mono text-xs leading-5 overflow-x-hidden"
                    style={{ opacity: 1 - i * 0.12 }}
                  >
                    <JsonNode value={snapshot} collapseFromDepth={1} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </>
      )}
    </div>
  );
};
