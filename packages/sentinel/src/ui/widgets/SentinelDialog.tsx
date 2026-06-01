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
import { MarkdownHooks } from "react-markdown";
import type { Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css"; // Tema stili
import remarkGfm from "remark-gfm";
import type { ComponentPropsWithoutRef } from "react";
export const SentinelDialog = () => {
  const { openDialogId, closeDialog, dialogMeta } = useSentinel();

  const components: Components = {
    h1: ({ children }: ComponentPropsWithoutRef<"h1">) => (
      <h1 className="text-3xl font-bold text-primary mt-6 mb-4">{children}</h1>
    ),

    h2: ({ children }: ComponentPropsWithoutRef<"h2">) => (
      <h2 className="text-2xl font-semibold text-primary mt-5 mb-3">
        {children}
      </h2>
    ),

    h3: ({ children }: ComponentPropsWithoutRef<"h3">) => (
      <h3 className="text-xl font-semibold text-primary mt-4 mb-2">
        {children}
      </h3>
    ),

    p: ({ children }: ComponentPropsWithoutRef<"p">) => (
      <p className="text-sm text-muted-foreground leading-7 mb-3">{children}</p>
    ),

    a: ({ href, children }: ComponentPropsWithoutRef<"a">) => (
      <a
        href={href ?? "#"}
        className="text-indigo-500 underline hover:text-indigo-400 transition"
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </a>
    ),

    ul: ({ children }: ComponentPropsWithoutRef<"ul">) => (
      <ul className="list-disc ml-6 space-y-1 text-sm">{children}</ul>
    ),

    ol: ({ children }: ComponentPropsWithoutRef<"ol">) => (
      <ol className="list-decimal ml-6 space-y-1 text-sm">{children}</ol>
    ),

    li: ({ children }: ComponentPropsWithoutRef<"li">) => (
      <li className="text-sm text-foreground">{children}</li>
    ),

    blockquote: ({ children }: ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote className="border-l-4 border-muted pl-4 italic text-muted-foreground my-4">
        {children}
      </blockquote>
    ),

    // code: ({ inline, children }: any) =>
    //   inline ? (
    //     <code className="bg-muted px-1 py-0.5 rounded text-sm">{children}</code>
    //   ) : (
    //     <code className="block bg-black text-green-300 p-4 rounded-md overflow-x-auto text-sm">
    //       {children}
    //     </code>
    //   ),

    pre: ({ children }: ComponentPropsWithoutRef<"pre">) => (
      <pre className="bg-secondary text-primary p-4 rounded-md overflow-x-auto my-4">
        {children}
      </pre>
    ),

    hr: () => <hr className="my-6 border-border" />,

    img: ({ src, alt }: ComponentPropsWithoutRef<"img">) => (
      <img
        src={src}
        alt={alt}
        className="rounded-lg my-4 border border-border"
      />
    ),

    table: ({ children }: ComponentPropsWithoutRef<"table">) => (
      <div className="overflow-x-auto my-4">
        <table className="w-full border border-border text-sm">
          {children}
        </table>
      </div>
    ),

    thead: ({ children }: ComponentPropsWithoutRef<"thead">) => (
      <thead className="bg-muted">{children}</thead>
    ),

    tbody: ({ children }: ComponentPropsWithoutRef<"tbody">) => (
      <tbody>{children}</tbody>
    ),

    tr: ({ children }: ComponentPropsWithoutRef<"tr">) => (
      <tr className="border-b border-border">{children}</tr>
    ),

    th: ({ children }: ComponentPropsWithoutRef<"th">) => (
      <th className="text-left p-2 font-semibold">{children}</th>
    ),

    td: ({ children }: ComponentPropsWithoutRef<"td">) => (
      <td className="p-2">{children}</td>
    ),

    strong: ({ children }: ComponentPropsWithoutRef<"strong">) => (
      <strong className="font-bold text-foreground">{children}</strong>
    ),

    em: ({ children }: ComponentPropsWithoutRef<"em">) => (
      <em className="italic">{children}</em>
    ),
  };
  return (
    <Dialog
      open={openDialogId !== null}
      onOpenChange={(open) => !open && closeDialog()}
    >
      <Tabs className="mt-1" defaultValue="md">
        <DialogContent className="h-fit overflow-y-auto">
          <DialogHeader className="">
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
          <TabsContent value="md" className="">
            <div className="markdown-body">
              <MarkdownHooks
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={components}
              >
                {dialogMeta.md}
              </MarkdownHooks>
            </div>
          </TabsContent>
          <TabsContent value="props-tracker">
            {dialogMeta.componentProps && (
              <pre className="bg-primary text-primary-foreground p-4 rounded-md overflow-x-auto h-full">
                <code className="text-wrap">
                  {JSON.stringify(dialogMeta.componentProps, null, 2)}
                </code>
              </pre>
            )}
          </TabsContent>
          <TabsContent value="api-layer"></TabsContent>
          <TabsContent value="event-tracker"></TabsContent>
          <DialogFooter>
            {/* <Button type="button" onClick={closeDialog}>
              Copy
            </Button> */}
          </DialogFooter>
        </DialogContent>
      </Tabs>
    </Dialog>
  );
};
