import React, { useState } from "react";
import { JsonNode } from "./JsonNode";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/Accordion";

export const PropsViewer = ({
  data,
  history,
}: {
  data: Record<string, unknown>;
  history?: Record<string, any>[];
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } catch {
      navigator.clipboard.writeText("[Circular structure — could not serialize]");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const prevRenders = history?.slice(1) ?? [];

  return (
    <div className="space-y-2">
      <div className="relative bg-primary text-primary-foreground p-4! rounded-md font-mono text-sm leading-6 overflow-x-hidden">
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 text-xs text-muted-foreground hover:text-primary-foreground transition-colors"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
        <JsonNode value={data} />
      </div>

      {prevRenders.length > 0 && (
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
      )}
    </div>
  );
};
