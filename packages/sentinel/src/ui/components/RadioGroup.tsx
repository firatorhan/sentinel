"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@huin-core/react-radio-group";
import { Circle } from "lucide-react";
import { cn } from "../../utils/cn";

/* -------------------------------------------------------------------------------------------------
 * RadioGroup
 * -----------------------------------------------------------------------------------------------*/

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;
/* -------------------------------------------------------------------------------------------------
 * RadioGroupItem
 * -----------------------------------------------------------------------------------------------*/

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.RadioGroupItem>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.RadioGroupItem>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.RadioGroupItem
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.RadioGroupIndicator className="flex items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </RadioGroupPrimitive.RadioGroupIndicator>
    </RadioGroupPrimitive.RadioGroupItem>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.RadioGroupItem.displayName;
/* -----------------------------------------------------------------------------------------------*/

export { RadioGroup, RadioGroupItem };
