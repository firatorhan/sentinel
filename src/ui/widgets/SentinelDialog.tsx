import { Button } from "../components/Button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/Tabs.tsx";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/Dialog";
import { useSentinel } from "../../react";

export const SentinelDialog = () => {
  const { openDialogId, closeDialog, dialogMeta } = useSentinel();

  return (
    <Dialog
      open={openDialogId !== null}
      onOpenChange={(open) => !open && closeDialog()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{"Senitel"}</DialogTitle>
          <DialogDescription>
            <Tabs className="mt-1" defaultValue="md">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="md">.md</TabsTrigger>
                <TabsTrigger value="props">Props</TabsTrigger>
              </TabsList>
              <TabsContent value="md">{dialogMeta.md}</TabsContent>
              <TabsContent value="props"></TabsContent>
            </Tabs>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={closeDialog}>
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
