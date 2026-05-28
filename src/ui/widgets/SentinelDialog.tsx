import { Button } from "../components/Button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/Dialog";
import React from "react";
import { Spotlight } from "./Spotlight";
import { useSentinel } from "../../react";

export const SentinelDialog = ({
  children,
}: {
  children?: React.ReactNode;
}) => {
  const { openDialogId, closeDialog, dialogMeta } = useSentinel();

  return (
    <Dialog
      open={openDialogId !== null}
      onOpenChange={(open) => !open && closeDialog()}
    >
      <div className="flex flex-col items-center justify-center gap-4 relative">
        <Spotlight>
          <DialogTrigger asChild>{children}</DialogTrigger>
        </Spotlight>
      </div>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogMeta.title || "Senitel"}</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={closeDialog}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
