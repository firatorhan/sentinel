import React, { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

const TRUNCATE_AT = 120;

const HIGHLIGHT_CLASS = "bg-sky-400/20 rounded px-0.5";

const StringValue = ({ value, highlighted = false }: { value: string; highlighted?: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  const className = `text-emerald-400 break-all${highlighted ? ` ${HIGHLIGHT_CLASS}` : ""}`;

  if (value.length <= TRUNCATE_AT) {
    return <span className={className}>"{value}"</span>;
  }

  return (
    <span>
      <span className={className}>
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

// True when `target` sits somewhere below `path` in the tree
const isAncestorOf = (path: string, target: string): boolean =>
  path === "" ? target !== "" : target.startsWith(`${path}.`) || target.startsWith(`${path}[`);

export const JsonNode = ({
  value,
  depth = 0,
  collapseFromDepth = Infinity,
  path = "",
  highlightPaths,
}: {
  value: unknown;
  depth?: number;
  collapseFromDepth?: number;
  path?: string;
  highlightPaths?: Set<string>;
}) => {
  const highlighted = highlightPaths?.has(path) ?? false;
  let hasHighlightedDescendant = false;
  if (highlightPaths) {
    for (const p of highlightPaths) {
      if (isAncestorOf(path, p)) {
        hasHighlightedDescendant = true;
        break;
      }
    }
  }
  // Highlighted branches stay open so matches are visible without digging
  const [collapsed, setCollapsed] = useState(depth >= collapseFromDepth && !hasHighlightedDescendant);

  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === "boolean") return <span className="text-orange-400 break-all">{String(value)}</span>;
  if (typeof value === "number")
    return (
      <span className={`text-orange-400 break-all${highlighted ? ` ${HIGHLIGHT_CLASS}` : ""}`}>
        {value}
      </span>
    );
  if (typeof value === "string") return <StringValue value={value} highlighted={highlighted} />;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span>{"[]"}</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="inline-flex items-center text-muted-foreground hover:text-foreground cursor-pointer select-none"
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
        </button>
        {collapsed ? (
          <span className="text-muted-foreground"> [{value.length}]</span>
        ) : (
          <>
            {" ["}
            {value.map((item, i) => (
              <div key={i} style={{ paddingLeft: 16 }}>
                <JsonNode
                  value={item}
                  depth={depth + 1}
                  collapseFromDepth={collapseFromDepth}
                  path={`${path}[${i}]`}
                  highlightPaths={highlightPaths}
                />
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
          className="inline-flex items-center text-muted-foreground hover:text-foreground cursor-pointer select-none"
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
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
                <JsonNode
                  value={val}
                  depth={depth + 1}
                  collapseFromDepth={collapseFromDepth}
                  path={path ? `${path}.${key}` : key}
                  highlightPaths={highlightPaths}
                />
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
