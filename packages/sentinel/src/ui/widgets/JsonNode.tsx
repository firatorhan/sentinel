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

export const JsonNode = ({
  value,
  depth = 0,
  collapseFromDepth = Infinity,
}: {
  value: unknown;
  depth?: number;
  collapseFromDepth?: number;
}) => {
  const [collapsed, setCollapsed] = useState(depth >= collapseFromDepth);

  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === "boolean") return <span className="text-orange-400">{String(value)}</span>;
  if (typeof value === "number") return <span className="text-orange-400">{value}</span>;
  if (typeof value === "string") return <StringValue value={value} />;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span>{"[]"}</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted-foreground hover:text-foreground cursor-pointer select-none"
        >
          {collapsed ? "▸" : "▾"}
        </button>
        {collapsed ? (
          <span className="text-muted-foreground"> [{value.length}]</span>
        ) : (
          <>
            {" ["}
            {value.map((item, i) => (
              <div key={i} style={{ paddingLeft: 16 }}>
                <JsonNode value={item} depth={depth + 1} collapseFromDepth={collapseFromDepth} />
                {i < value.length - 1 && <span className="text-muted-foreground">,</span>}
              </div>
            ))}
            {"]"}
          </>
        )}
      </span>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span>{"{}"}</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted-foreground hover:text-foreground cursor-pointer select-none"
        >
          {collapsed ? "▸" : "▾"}
        </button>
        {collapsed ? (
          <span className="text-muted-foreground">
            {" {"}
            {entries.slice(0, 3).map(([k]) => k).join(", ")}
            {entries.length > 3 ? ", …" : ""}
            {"}"}
          </span>
        ) : (
          <>
            {" {"}
            {entries.map(([key, val], i) => (
              <div key={key} style={{ paddingLeft: 16 }}>
                <span className="text-sky-400">"{key}"</span>
                <span className="text-muted-foreground">: </span>
                <JsonNode value={val} depth={depth + 1} collapseFromDepth={collapseFromDepth} />
                {i < entries.length - 1 && <span className="text-muted-foreground">,</span>}
              </div>
            ))}
            {"}"}
          </>
        )}
      </span>
    );
  }

  return <span>{String(value)}</span>;
};
