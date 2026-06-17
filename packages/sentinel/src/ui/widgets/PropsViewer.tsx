import React, { useState } from "react";

const TRUNCATE_AT = 120;

const StringValue = ({ value }: { value: string }) => {
  const [expanded, setExpanded] = useState(false);

  if (value.length <= TRUNCATE_AT) {
    return <span className="text-emerald-400">"{value}"</span>;
  }

  return (
    <span>
      <span className="text-emerald-400 break-all">
        "{expanded ? value : `${value.slice(0, TRUNCATE_AT)}...`}"
      </span>
      <button
        className="ml-2 text-xs text-sky-400 underline cursor-pointer hover:text-sky-300"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? "collapse" : `+${value.length - TRUNCATE_AT} more chars`}
      </button>
    </span>
  );
};

const JsonNode = ({ value, depth = 0 }: { value: unknown; depth?: number }) => {
  if (value === null) {
    return <span className="text-muted-foreground">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-orange-400">{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-orange-400">{value}</span>;
  }
  if (typeof value === "string") {
    return <StringValue value={value} />;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span>{"[]"}</span>;
    return (
      <span>
        {"["}
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: 16 }}>
            <JsonNode value={item} depth={depth + 1} />
            {i < value.length - 1 && (
              <span className="text-muted-foreground">,</span>
            )}
          </div>
        ))}
        {"]"}
      </span>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span>{"{}"}</span>;
    return (
      <span>
        {"{"}
        {entries.map(([key, val], i) => (
          <div key={key} style={{ paddingLeft: 16 }}>
            <span className="text-sky-400">"{key}"</span>
            <span className="text-muted-foreground">: </span>
            <JsonNode value={val} depth={depth + 1} />
            {i < entries.length - 1 && (
              <span className="text-muted-foreground">,</span>
            )}
          </div>
        ))}
        {"}"}
      </span>
    );
  }

  return <span>{String(value)}</span>;
};

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
      <div className="relative bg-primary text-primary-foreground p-4 rounded-md font-mono text-sm leading-6 overflow-x-hidden">
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
