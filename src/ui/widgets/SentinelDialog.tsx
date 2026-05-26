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
import { Spotlight } from "../components/Spotlight";

export const SentinelDialog = ({ children }: { children: React.ReactNode }) => {
  return (
    <Dialog>
      <div className="flex flex-col items-center justify-center gap-4 relative">
        <Spotlight>
          <>
            {children}

            <DialogTrigger
              asChild
              className="absolute bottom-4 right-1/2 translate-x-1/2"
            >
              <Button variant="outline" size="sm">
                Information
              </Button>
            </DialogTrigger>
          </>
        </Spotlight>
      </div>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>

          <DialogDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
