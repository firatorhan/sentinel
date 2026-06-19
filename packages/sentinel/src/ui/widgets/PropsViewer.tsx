import React, { useState } from "react";
import { JsonNode } from "./JsonNode";

export const PropsViewer = ({
  data,
  history,
}: {
  data: Record<string, unknown>;
  history?: Record<string, any>[];
}) => {
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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
        <div>
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {historyOpen ? "▾" : "▸"} Previous renders ({prevRenders.length})
          </button>
          {historyOpen && (
            <div className="space-y-2 mt-2">
              {prevRenders.map((snapshot, i) => (
                <div
                  key={i}
                  className="bg-muted p-3 rounded-md font-mono text-sm leading-6 overflow-x-hidden"
                  style={{ opacity: 1 - i * 0.15 }}
                >
                  <div className="text-xs text-muted-foreground mb-2">
                    -{i + 1} render
                  </div>
                  <JsonNode value={snapshot} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
