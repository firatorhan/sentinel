
import * as React from "react";
import * as PopoverPrimitive from "@huin-core/react-popover";
import { cn } from "../../utils/cn";

/* -------------------------------------------------------------------------------------------------
 * Popover
 * -----------------------------------------------------------------------------------------------*/

const Popover = PopoverPrimitive.Root;

/* -------------------------------------------------------------------------------------------------
 * PopoverTrigger
 * -----------------------------------------------------------------------------------------------*/

const PopoverTrigger = PopoverPrimitive.PopoverTrigger;

/* -------------------------------------------------------------------------------------------------
 * PopoverContent
 * -----------------------------------------------------------------------------------------------*/

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.PopoverContent>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.PopoverContent>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.PopoverPortal>
    <div className="sentinel-root">
      <PopoverPrimitive.PopoverContent
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4! text-popover-foreground shadow-md outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </div>
  </PopoverPrimitive.PopoverPortal>
));
PopoverContent.displayName = PopoverPrimitive.PopoverContent.displayName;
/* -----------------------------------------------------------------------------------------------*/

export { Popover, PopoverTrigger, PopoverContent };
