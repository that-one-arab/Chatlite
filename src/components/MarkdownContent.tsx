import { memo, useRef, useState } from "preact/compat";
import type { HTMLAttributes, AnchorHTMLAttributes, TableHTMLAttributes } from "preact/compat";
import Markdown from "react-markdown";
import type { Components, ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { openUrl } from "@tauri-apps/plugin-opener";

interface MarkdownContentProps {
  content: string;
}

function CodeBlock({ node: _node, children, ...props }: HTMLAttributes<HTMLPreElement> & ExtraProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = preRef.current?.textContent ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="md-codeblock">
      <button className="md-copy-btn" onClick={handleCopy} aria-label="Copy code">
        {copied ? "Copied" : "Copy"}
      </button>
      <pre ref={preRef} {...props}>
        {children}
      </pre>
    </div>
  );
}

function Code({ node: _node, className, children, ...props }: HTMLAttributes<HTMLElement> & ExtraProps) {
  // Fenced blocks get a `language-*`/`hljs` class from rehype-highlight;
  // anything else is inline code
  const isBlock = !!className;
  return isBlock ? (
    <code className={className} {...props}>
      {children}
    </code>
  ) : (
    <code className="md-inline-code" {...props}>
      {children}
    </code>
  );
}

function Link({ node: _node, href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & ExtraProps) {
  const handleClick = (e: Event) => {
    e.preventDefault();
    if (typeof href === "string" && /^https?:\/\//.test(href)) {
      openUrl(href).catch(() => window.open(href, "_blank"));
    }
  };
  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}

function Table({ node: _node, children, ...props }: TableHTMLAttributes<HTMLTableElement> & ExtraProps) {
  return (
    <div className="md-table-wrap">
      <table {...props}>{children}</table>
    </div>
  );
}

const components: Components = {
  pre: CodeBlock,
  code: Code,
  a: Link,
  table: Table,
};

export const MarkdownContent = memo(function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-body">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: true }]]} components={components}>
        {content}
      </Markdown>
    </div>
  );
});
