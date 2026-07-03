import React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "../../utils/cn";

export const CopyButton = ({
  getText,
  label = "Copy",
  copiedLabel = "Copied",
  className,
}: {
  getText: () => string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) => {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    try {
      void navigator.clipboard?.writeText(getText());
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
        "shrink-0 inline-flex items-center gap-1 text-xs transition-colors cursor-pointer whitespace-nowrap",
        copied ? "text-emerald-400" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? copiedLabel : label}
    </button>
  );
};
