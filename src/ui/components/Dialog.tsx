import * as React from "react";
import * as DialogPrimitive from "@huin-core/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";
import { Button } from "./Button";

const dialogVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      variant: {
        center:
          "left-[50%] top-[50%] grid w-full h-full max-w-5/6 max-h-5/6 translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      variant: "center",
    },
  },
);

/* -------------------------------------------------------------------------------------------------
 * Dialog
 * -----------------------------------------------------------------------------------------------*/

const Dialog = DialogPrimitive.Root;

/* -------------------------------------------------------------------------------------------------
 * DialogTrigger
 * -----------------------------------------------------------------------------------------------*/

const DialogTrigger = DialogPrimitive.DialogTrigger;

/* -------------------------------------------------------------------------------------------------
 * DialogPortal
 * -----------------------------------------------------------------------------------------------*/

const DialogPortal = DialogPrimitive.DialogPortal;

/* -------------------------------------------------------------------------------------------------
 * DialogClose
 * -----------------------------------------------------------------------------------------------*/

const DialogClose = DialogPrimitive.DialogClose;

/* -------------------------------------------------------------------------------------------------
 * DialogOverlay
 * -----------------------------------------------------------------------------------------------*/

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.DialogOverlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.DialogOverlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.DialogOverlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.DialogOverlay.displayName;

/* -------------------------------------------------------------------------------------------------
 * DialogContent
 * -----------------------------------------------------------------------------------------------*/

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.DialogContent> &
    VariantProps<typeof dialogVariants>
>(({ className, variant, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.DialogContent
      ref={ref}
      className={cn(dialogVariants({ variant, className }))}
      {...props}
    >
      {children}
      <DialogPrimitive.DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <Button variant={"ghost"} size={"icon"}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            // 2. Ünlem koyarak global CSS kurallarını ezdik
            className="!size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5" // Çizgilerin kalınlığı
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </Button>
        <span className="sr-only">Close</span>
      </DialogPrimitive.DialogClose>
    </DialogPrimitive.DialogContent>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.DialogContent.displayName;

/* -------------------------------------------------------------------------------------------------
 * DialogHeader
 * -----------------------------------------------------------------------------------------------*/

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

/* -------------------------------------------------------------------------------------------------
 * DialogFooter
 * -----------------------------------------------------------------------------------------------*/

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse h-fit sm:flex-row sm:justify-end sm:space-x-2 mt-auto",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

/* -------------------------------------------------------------------------------------------------
 * DialogTitle
 * -----------------------------------------------------------------------------------------------*/

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.DialogTitle>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.DialogTitle>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.DialogTitle
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.DialogTitle.displayName;

/* -------------------------------------------------------------------------------------------------
 * DialogDescription
 * -----------------------------------------------------------------------------------------------*/

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.DialogDescription>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.DialogDescription>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.DialogDescription
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.DialogDescription.displayName;
/* -----------------------------------------------------------------------------------------------*/

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
