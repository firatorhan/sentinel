import React, { useState } from "react";
import { ChevronRight, ChevronDown, Copy, Check, Link2 } from "lucide-react";

const TRUNCATE_AT = 120;
const ARRAY_CHUNK = 50;

const HIGHLIGHT_CLASS = "bg-sky-400/20 rounded px-0.5";
// Reveals the row's copy actions on hover without leaking into nested rows
const ROW_HOVER_CLASS = "[&:hover>.jn-actions]:opacity-100";

const stringifyValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
};

const CopyAction = ({
  title,
  getText,
  icon,
}: {
  title: string;
  getText: () => string;
  icon: React.ReactNode;
}) => {
  const [copied, setCopied] = useState(false);

  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        try {
          void navigator.clipboard?.writeText(getText());
        } catch {
          /* clipboard unavailable */
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}
      className="inline-flex text-muted-foreground hover:text-foreground cursor-pointer"
    >
      {copied ? <Check size={10} className="text-emerald-400" /> : icon}
    </button>
  );
};

const NodeActions = ({ value, path }: { value: unknown; path: string }) => (
  <span className="jn-actions ml-1.5 inline-flex items-center gap-1 opacity-0 transition-opacity align-middle">
    <CopyAction title="Copy value" getText={() => stringifyValue(value)} icon={<Copy size={10} />} />
    {path && (
      <CopyAction title={`Copy path: ${path}`} getText={() => path} icon={<Link2 size={10} />} />
    )}
  </span>
);

const Leaf = ({
  value,
  path,
  children,
}: {
  value: unknown;
  path: string;
  children: React.ReactNode;
}) => (
  <span className={ROW_HOVER_CLASS}>
    {children}
    <NodeActions value={value} path={path} />
  </span>
);

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
  forceExpand = 0,
}: {
  value: unknown;
  depth?: number;
  collapseFromDepth?: number;
  path?: string;
  highlightPaths?: Set<string>;
  forceExpand?: number;
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
  const [collapsed, setCollapsed] = useState(
    forceExpand === 0 && depth >= collapseFromDepth && !hasHighlightedDescendant,
  );
  const [visibleCount, setVisibleCount] = useState(ARRAY_CHUNK);
  // Bumped on ⌥/Alt+click; remounts children so the whole subtree opens
  const [expandGen, setExpandGen] = useState(0);

  if (value === null)
    return (
      <Leaf value={value} path={path}>
        <span className="text-muted-foreground">null</span>
      </Leaf>
    );
  if (typeof value === "boolean")
    return (
      <Leaf value={value} path={path}>
        <span className="text-orange-400 break-all">{String(value)}</span>
      </Leaf>
    );
  if (typeof value === "number")
    return (
      <Leaf value={value} path={path}>
        <span className={`text-orange-400 break-all${highlighted ? ` ${HIGHLIGHT_CLASS}` : ""}`}>
          {value}
        </span>
      </Leaf>
    );
  if (typeof value === "string")
    return (
      <Leaf value={value} path={path}>
        <StringValue value={value} highlighted={highlighted} />
      </Leaf>
    );

  const childForceExpand = expandGen > 0 ? expandGen : forceExpand;

  const toggle = (e: React.MouseEvent) => {
    if (e.altKey) {
      setExpandGen((g) => g + 1);
      setCollapsed(false);
      return;
    }
    setCollapsed((c) => !c);
  };

  const chevron = (
    <button
      onClick={toggle}
      title="⌥/Alt+click: expand subtree"
      className="inline-flex items-center text-muted-foreground hover:text-foreground cursor-pointer select-none"
    >
      {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
    </button>
  );

  if (Array.isArray(value)) {
    const items = value as unknown[];
    if (items.length === 0) return <span>{"[]"}</span>;

    const hiddenCount = Math.max(0, items.length - visibleCount);

    // Highlighted items beyond the visible window render anyway, so
    // props-matches never hide behind the "+N more" cut-off
    const extras: number[] = [];
    if (highlightPaths && hiddenCount > 0) {
      const prefix = `${path}[`;
      for (const p of highlightPaths) {
        if (!p.startsWith(prefix)) continue;
        const idx = parseInt(p.slice(prefix.length), 10);
        if (Number.isFinite(idx) && idx >= visibleCount && idx < items.length) extras.push(idx);
      }
    }
    const extraIndices = [...new Set(extras)].sort((a, b) => a - b);

    return (
      <span>
        <span className={ROW_HOVER_CLASS}>
          {chevron}
          {collapsed ? (
            <span className="text-muted-foreground"> [{items.length}]</span>
          ) : (
            " ["
          )}
          <NodeActions value={items} path={path} />
        </span>
        {!collapsed && (
          <>
            {items.slice(0, visibleCount).map((item, i) => (
              <div key={`${i}:${expandGen}`} style={{ paddingLeft: 16 }}>
                <JsonNode
                  value={item}
                  depth={depth + 1}
                  collapseFromDepth={collapseFromDepth}
                  path={`${path}[${i}]`}
                  highlightPaths={highlightPaths}
                  forceExpand={childForceExpand}
                />
                {i < items.length - 1 && <span className="text-muted-foreground">,</span>}
              </div>
            ))}
            {hiddenCount > 0 && (
              <div style={{ paddingLeft: 16 }} className="space-x-3">
                <button
                  onClick={() => setVisibleCount((c) => c + ARRAY_CHUNK)}
                  className="text-xs text-sky-400 underline cursor-pointer hover:text-sky-300"
                >
                  +{Math.min(ARRAY_CHUNK, hiddenCount)} more
                </button>
                {hiddenCount > ARRAY_CHUNK && (
                  <button
                    onClick={() => setVisibleCount(items.length)}
                    className="text-xs text-sky-400 underline cursor-pointer hover:text-sky-300"
                  >
                    show all {items.length}
                  </button>
                )}
              </div>
            )}
            {extraIndices.map((i) => (
              <div key={`${i}:${expandGen}`} style={{ paddingLeft: 16 }}>
                <span className="text-muted-foreground text-[10px] mr-1">[{i}]</span>
                <JsonNode
                  value={items[i]}
                  depth={depth + 1}
                  collapseFromDepth={collapseFromDepth}
                  path={`${path}[${i}]`}
                  highlightPaths={highlightPaths}
                  forceExpand={childForceExpand}
                />
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
        <span className={ROW_HOVER_CLASS}>
          {chevron}
          {collapsed ? (
            <span className="text-muted-foreground">
              {" {"}
              {entries.slice(0, 3).map(([k]) => k).join(", ")}
              {entries.length > 3 ? ", …" : ""}
              {"}"}
            </span>
          ) : (
            " {"
          )}
          <NodeActions value={value} path={path} />
        </span>
        {!collapsed && (
          <>
            {entries.map(([key, val], i) => (
              <div key={`${key}:${expandGen}`} style={{ paddingLeft: 16 }}>
                <span className="text-sky-400">"{key}"</span>
                <span className="text-muted-foreground">: </span>
                <JsonNode
                  value={val}
                  depth={depth + 1}
                  collapseFromDepth={collapseFromDepth}
                  path={path ? `${path}.${key}` : key}
                  highlightPaths={highlightPaths}
                  forceExpand={childForceExpand}
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
