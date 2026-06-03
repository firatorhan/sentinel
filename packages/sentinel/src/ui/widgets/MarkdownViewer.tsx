import React from "react";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

const parseInline = (text: string) => {
  const parts: React.ReactNode[] = [];

  const regex =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];

    // bold
    if (token.startsWith("**")) {
      parts.push(<strong>{token.slice(2, -2)}</strong>);
    }
    // italic
    else if (token.startsWith("*")) {
      parts.push(<em>{token.slice(1, -1)}</em>);
    }
    // code
    else if (token.startsWith("`")) {
      parts.push(<code className="px-1 py-0.5 bg-primary rounded text-sm text-primary-foreground">{token.slice(1, -1)}</code>);
    }
    // link
    else if (token.startsWith("[")) {
      const [, text, url] = token.match(/\[([^\]]+)\]\(([^)]+)\)/) || [];
      parts.push(
        <a href={url} target="_blank" rel="noreferrer" className="text-blue-400 underline">
          {text}
        </a>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
};

/* ---------------- CODE BLOCK ---------------- */

const CodeBlock = ({ code }: { code: string }) => (
  <div className="bg-[#0f172a] text-gray-200 rounded-xl overflow-hidden my-4 border border-gray-800">
    <div className="flex items-center justify-between px-3 py-2 bg-[#111827] text-xs text-gray-400">
      <span>code</span>
      <span>copy</span>
    </div>
    <pre className="p-4 text-sm overflow-x-auto">
      <code>{code}</code>
    </pre>
  </div>
);

/* ---------------- TABLE ---------------- */

const Table = ({ rows }: { rows: string[][] }) => (
  <div className="overflow-x-auto my-4">
    <table className="w-full border border-gray-700 text-sm">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-gray-800">
            {row.map((cell, j) => (
              <td key={j} className="px-3 py-2">
                {parseInline(cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ---------------- LIST ---------------- */

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc ml-6 my-2 space-y-1">
    {items.map((item, i) => (
      <li key={i}>{parseInline(item)}</li>
    ))}
  </ul>
);

/* ---------------- MAIN ---------------- */

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  className = "",
}) => {
  const lines = content.split("\n");

  const elements: React.ReactNode[] = [];

  let codeBuffer: string[] = [];
  let inCode = false;

  let listBuffer: string[] = [];
  let tableBuffer: string[][] = [];

  const flushList = () => {
    if (listBuffer.length) {
      elements.push(<List items={listBuffer} />);
      listBuffer = [];
    }
  };

  const flushTable = () => {
    if (tableBuffer.length) {
      elements.push(<Table rows={tableBuffer} />);
      tableBuffer = [];
    }
  };

  const flushCode = () => {
    if (codeBuffer.length) {
      elements.push(<CodeBlock code={codeBuffer.join("\n")} />);
      codeBuffer = [];
    }
  };

  for (const line of lines) {
    const t = line.trim();

    // code block
    if (t.startsWith("```")) {
      if (!inCode) {
        flushList();
        flushTable();
        inCode = true;
      } else {
        inCode = false;
        flushCode();
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // table (very simple markdown table)
    if (t.includes("|")) {
      const row = t.split("|").map((c) => c.trim()).filter(Boolean);
      tableBuffer.push(row);
      continue;
    } else {
      flushTable();
    }

    // list
    if (/^[-*]\s+/.test(t)) {
      listBuffer.push(t.replace(/^[-*]\s+/, ""));
      continue;
    } else {
      flushList();
    }

    // heading
    if (t.startsWith("# ")) {
      elements.push(<h1 className="text-3xl font-bold my-4">{parseInline(t.slice(2))}</h1>);
      continue;
    }

    if (t.startsWith("## ")) {
      elements.push(<h2 className="text-2xl font-semibold my-3">{parseInline(t.slice(3))}</h2>);
      continue;
    }

    if (t.startsWith("### ")) {
      elements.push(<h3 className="text-xl font-medium my-2">{parseInline(t.slice(4))}</h3>);
      continue;
    }

    if (!t) {
      elements.push(<div className="h-3" />);
      continue;
    }

    elements.push(<p className="text-sm leading-7">{parseInline(t)}</p>);
  }

  flushList();
  flushTable();
  flushCode();

  return <div className={`markdown-body ${className}`}>{elements}</div>;
};