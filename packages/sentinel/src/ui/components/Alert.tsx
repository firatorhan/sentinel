import { Primitive } from "@huin-core/react-primitive";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { cn } from "../../utils/cn";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4! [&>svg~*]:pl-7! [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/* -------------------------------------------------------------------------------------------------
 * Alert
 * -----------------------------------------------------------------------------------------------*/

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <Primitive.div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

/* -------------------------------------------------------------------------------------------------
 * AlertTitle
 * -----------------------------------------------------------------------------------------------*/

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <Primitive.h3
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

/* -------------------------------------------------------------------------------------------------
 * AlertDescription
 * -----------------------------------------------------------------------------------------------*/

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <Primitive.p
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
