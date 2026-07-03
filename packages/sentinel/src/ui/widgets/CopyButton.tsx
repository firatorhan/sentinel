import React from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "../components/Button";
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
    <Button
      variant="ghost"
      size="xs"
      onClick={copy}
      className={cn(
        "shrink-0 whitespace-nowrap",
        copied
          ? "text-emerald-400 hover:text-emerald-400"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? copiedLabel : label}
    </Button>
  );
};
