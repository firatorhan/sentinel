"use client";

import * as React from "react";
import * as TabsPrimitive from "@huin-core/react-tabs";
import { cn } from "../../utils/cn";

/* -------------------------------------------------------------------------------------------------
 * Tabs
 * -----------------------------------------------------------------------------------------------*/

const Tabs = TabsPrimitive.Tabs;

/* -------------------------------------------------------------------------------------------------
 * TabsList
 * -----------------------------------------------------------------------------------------------*/

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.TabsList>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.TabsList>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.TabsList
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.TabsList.displayName;

/* -------------------------------------------------------------------------------------------------
 * TabsTrigger
 * -----------------------------------------------------------------------------------------------*/

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.TabsTrigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.TabsTrigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.TabsTrigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.TabsTrigger.displayName;

/* -------------------------------------------------------------------------------------------------
 * TabsContent
 * -----------------------------------------------------------------------------------------------*/

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.TabsContent>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.TabsContent>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.TabsContent
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.TabsContent.displayName;
/* -----------------------------------------------------------------------------------------------*/

export { Tabs, TabsList, TabsTrigger, TabsContent };
