"use client";

import * as React from "react";
import * as AccordionPrimitive from "@huin-core/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";

/* -------------------------------------------------------------------------------------------------
 * Accordion
 * -----------------------------------------------------------------------------------------------*/

const Accordion = AccordionPrimitive.Accordion;

/* -------------------------------------------------------------------------------------------------
 * AccordionItem
 * -----------------------------------------------------------------------------------------------*/

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.AccordionItem>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.AccordionItem>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.AccordionItem
    ref={ref}
    className={cn("border-b", className)}
    {...props}
  />
));
AccordionItem.displayName = AccordionPrimitive.AccordionItem.displayName;

/* -------------------------------------------------------------------------------------------------
 * AccordionHeader
 * -----------------------------------------------------------------------------------------------*/

const AccordionHeader = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.AccordionHeader>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.AccordionHeader>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.AccordionHeader
    ref={ref}
    className={cn("d-flex", className)}
    {...props}
  />
));
AccordionHeader.displayName = AccordionPrimitive.AccordionHeader.displayName;

/* -------------------------------------------------------------------------------------------------
 * AccordionTrigger
 * -----------------------------------------------------------------------------------------------*/

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.AccordionTrigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.AccordionTrigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.AccordionTrigger
    ref={ref}
    className={cn(
      "flex flex-1 w-full items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
      className
    )}
    {...props}
  >
    {children}
    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
  </AccordionPrimitive.AccordionTrigger>
));
AccordionTrigger.displayName = AccordionPrimitive.AccordionTrigger.displayName;

/* -------------------------------------------------------------------------------------------------
 * AccordionContent
 * -----------------------------------------------------------------------------------------------*/

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.AccordionContent>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.AccordionContent>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.AccordionContent
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.AccordionContent>
));
AccordionContent.displayName = AccordionPrimitive.AccordionContent.displayName;
/* -----------------------------------------------------------------------------------------------*/

export {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionContent,
};
