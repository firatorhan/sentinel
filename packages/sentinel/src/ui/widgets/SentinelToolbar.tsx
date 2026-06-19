import React from "react";
import { ScanEye } from "lucide-react";
import { Portal } from "@huin-core/react-portal";
import { Popover, PopoverContent, PopoverTrigger } from "../components/Popover";
import { Switch } from "../components/Switch";
import { Label } from "../components/Label";
import { Separator } from "../components/Separator";
import { Input } from "../components/Input";
import { useSentinelInteraction } from "../../react";
import { cn } from "../../utils/cn";

export const SentinelToolbar = () => {
  const { isActive, setIsActive, showOutlines, setShowOutlines, highlightName, setHighlightName } =
    useSentinelInteraction();
  const [open, setOpen] = React.useState(false);

  return (
    <Portal>
      <div className="fixed bottom-4 right-4 z-[9999]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
              isActive
                ? "bg-primary text-primary-foreground border-primary/30"
                : "bg-background text-muted-foreground border-border hover:text-foreground",
            )}
          >
            <ScanEye size={18} />
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-56 p-0">
            <div className="flex items-center justify-between px-4! py-3!">
              <div className="flex items-center gap-2">
                <ScanEye size={14} className="text-muted-foreground" />
                <span className="text-sm font-semibold">Sentinel</span>
              </div>
              <kbd className="text-sm text-muted-foreground bg-muted px-1.5! py-0.5! rounded font-mono">
                ⌃ ⇧ S
              </kbd>
            </div>

            <Separator />

            <div className="flex items-center justify-between px-4! py-3!">
              <Label htmlFor="sentinel-active-switch" className="cursor-pointer">
                Active
              </Label>
              <Switch
                id="sentinel-active-switch"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <div className="flex items-center justify-between px-4! pb-3!">
              <Label
                htmlFor="sentinel-outline-switch"
                className={cn("cursor-pointer", !isActive && "opacity-40")}
              >
                Outline All
              </Label>
              <Switch
                id="sentinel-outline-switch"
                checked={showOutlines}
                onCheckedChange={setShowOutlines}
                disabled={!isActive}
              />
            </div>

            <Separator />

            <div className="px-4! py-3! space-y-1.5">
              <Label
                htmlFor="sentinel-filter-input"
                className={cn("text-xs text-muted-foreground", !isActive && "opacity-40")}
              >
                Filter component
              </Label>
              <Input
                id="sentinel-filter-input"
                placeholder="e.g. ProductCard"
                value={highlightName}
                onChange={(e) => setHighlightName(e.target.value)}
                disabled={!isActive}
                className="h-8 text-sm"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </Portal>
  );
};
