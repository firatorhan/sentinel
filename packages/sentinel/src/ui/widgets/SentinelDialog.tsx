import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/Tabs";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/Dialog";
import { useSentinel } from "../../react";
import { MarkdownViewer } from "./MarkdownViewer"; // <-- Yeni component'i import ediyoruz

export const SentinelDialog = () => {
  const { openDialogId, closeDialog, dialogMeta } = useSentinel();

  return (
    <Dialog
      open={openDialogId !== null}
      onOpenChange={(open) => !open && closeDialog()}
    >
      <Tabs className="mt-1" defaultValue="md">
        <DialogContent className="h-fit overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{"Sentinel"}</DialogTitle>
            <DialogDescription>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="md">.md</TabsTrigger>
                <TabsTrigger value="props-tracker">Props Tracker</TabsTrigger>
                <TabsTrigger value="api-layer">API Layer</TabsTrigger>
                <TabsTrigger value="event-tracker">Event Tracker</TabsTrigger>
              </TabsList>
            </DialogDescription>
          </DialogHeader>
          
          <TabsContent value="md">
            {/* Yeni ayırdığımız bileşeni burada tertemiz çağırıyoruz */}
            <MarkdownViewer content={dialogMeta?.md || ""} />
          </TabsContent>
          
          <TabsContent value="props-tracker">
            {dialogMeta.componentProps && (
              <pre className="bg-primary text-primary-foreground p-4 rounded-md overflow-x-auto h-full">
                <code className="text-wrap block whitespace-pre text-sm">
                  {JSON.stringify(dialogMeta.componentProps, null, 2)}
                </code>
              </pre>
            )}
          </TabsContent>
          
          <TabsContent value="api-layer"></TabsContent>
          <TabsContent value="event-tracker"></TabsContent>
          <DialogFooter />
        </DialogContent>
      </Tabs>
    </Dialog>
  );
};