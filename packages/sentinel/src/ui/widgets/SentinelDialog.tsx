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
import { useSentinelDialog } from "../../react";
import { MarkdownViewer } from "./MarkdownViewer";
import { PropsViewer } from "./PropsViewer";
import React from "react";

const getDisplayPath = (sourceFile: string) => {
  const [filePath] = sourceFile.split(":");
  const segments = filePath.replace(/\\/g, "/").split("/");
  return segments.slice(-3).join("/");
};

export const SentinelDialog = () => {
  const { openDialogId, closeDialog, dialogMeta } = useSentinelDialog();

  return (
    <Dialog
      open={openDialogId !== null}
      onOpenChange={(open) => !open && closeDialog()}
    >
      <Tabs className="mt-1" defaultValue="md">
        <DialogContent className="h-fit overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">
              <span className="flex items-center justify-center gap-2">
                {dialogMeta?.componentName ? (
                  <span>
                    <span className="text-muted-foreground font-normal">&lt;</span>
                    {dialogMeta.componentName}
                    <span className="text-muted-foreground font-normal"> /&gt;</span>
                  </span>
                ) : (
                  "Sentinel"
                )}
                {dialogMeta?.renderCount !== undefined && (
                  <span className="text-xs font-normal bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                    ×{dialogMeta.renderCount}
                  </span>
                )}
              </span>
              {dialogMeta?.sourceFile && (
                <a
                  href={`vscode://file/${dialogMeta.sourceFile}`}
                  className="block text-xs font-normal text-muted-foreground hover:text-sky-400 transition-colors mt-0.5 font-mono"
                >
                  {getDisplayPath(dialogMeta.sourceFile)}
                </a>
              )}
            </DialogTitle>
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
            <MarkdownViewer content={dialogMeta?.md || ""} />
          </TabsContent>

          <TabsContent value="props-tracker">
            {dialogMeta.componentProps && (
              <PropsViewer
                data={dialogMeta.componentProps as Record<string, unknown>}
                history={dialogMeta.propHistory}
              />
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
