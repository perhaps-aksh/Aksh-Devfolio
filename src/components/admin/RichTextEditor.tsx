import * as React from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Rows3,
  SquareCode,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";

import type { Editor } from "@tiptap/react";

import { safeUrl, type PMNode } from "@/lib/rich-text";

function toolbarState(e: Editor) {
  return {
    h1: e.isActive("heading", { level: 1 }),
    h2: e.isActive("heading", { level: 2 }),
    h3: e.isActive("heading", { level: 3 }),
    bold: e.isActive("bold"),
    italic: e.isActive("italic"),
    underline: e.isActive("underline"),
    strike: e.isActive("strike"),
    code: e.isActive("code"),
    bullet: e.isActive("bulletList"),
    ordered: e.isActive("orderedList"),
    quote: e.isActive("blockquote"),
    codeBlock: e.isActive("codeBlock"),
    link: e.isActive("link"),
    image: e.isActive("image"),
    table: e.isActive("table"),
    left: e.isActive({ textAlign: "left" }),
    center: e.isActive({ textAlign: "center" }),
    right: e.isActive({ textAlign: "right" }),
    canUndo: e.can().undo(),
    canRedo: e.can().redo(),
    imageAlt: (e.getAttributes("image")["alt"] as string | undefined) ?? "",
    imageTitle: (e.getAttributes("image")["title"] as string | undefined) ?? "",
    href: (e.getAttributes("link")["href"] as string | undefined) ?? "",
  };
}

type Props = {
  value: PMNode;
  onChange: (doc: PMNode) => void;
  /** Uploads a picture and resolves to its public URL. */
  onUploadImage: (file: File) => Promise<string>;
  onError: (message: string) => void;
};

type BtnProps = {
  label: string;
  on?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function Btn({ label, on, disabled, onClick, children }: BtnProps) {
  return (
    <button
      type="button"
      className={`rte-btn ${on ? "is-on" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={on === undefined ? undefined : on}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * TipTap (ProseMirror) editor. This module — and all of TipTap — is only downloaded when an editor page is
 * opened. It stores a JSON document; the server sanitises it on save and renders it to HTML for readers.
 */
export default function RichTextEditor({ value, onChange, onUploadImage, onError }: Props) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkValue, setLinkValue] = React.useState("");
  const [linkError, setLinkError] = React.useState("");

  const editor = useEditor({
    immediatelyRender: false,
    content: value as never,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer" },
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    editorProps: {
      attributes: { "aria-label": "Article body", role: "textbox", "aria-multiline": "true" },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as PMNode),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? toolbarState(e) : null),
  });

  // useEditorState only starts watching the editor for "transaction"/"update" events once the editor
  // already exists, so it misses the editor's own creation and stays null until the first real edit.
  // Gate rendering on `editor` alone, and compute the toolbar state directly for that one render.
  if (!editor) return <div className="rte-loading">PREPARING EDITOR…</div>;
  const s = state ?? toolbarState(editor);

  const run = () => editor.chain().focus();

  const openLink = () => {
    setLinkValue(s.href);
    setLinkError("");
    setLinkOpen((open) => !open);
  };

  const applyLink = () => {
    const raw = linkValue.trim();
    if (!raw) {
      run().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const url = safeUrl(/^[a-z][a-z0-9+.-]*:|^[/#]/i.test(raw) ? raw : `https://${raw}`);
    if (!url) {
      setLinkError("Use an http(s), mailto or tel link.");
      return;
    }
    run().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const src = await onUploadImage(file);
      run().setImage({ src, alt: "" }).run();
    } catch (error) {
      onError(error instanceof Error ? error.message : "The image upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="rte">
      <div className="rte-bar" role="toolbar" aria-label="Formatting">
        <div className="rte-group">
          <Btn label="Undo" disabled={!s.canUndo} onClick={() => run().undo().run()}>
            <Undo2 size={16} />
          </Btn>
          <Btn label="Redo" disabled={!s.canRedo} onClick={() => run().redo().run()}>
            <Redo2 size={16} />
          </Btn>
        </div>
        <div className="rte-group">
          <Btn label="Heading 1" on={s.h1} onClick={() => run().toggleHeading({ level: 1 }).run()}>
            <Heading1 size={16} />
          </Btn>
          <Btn label="Heading 2" on={s.h2} onClick={() => run().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={16} />
          </Btn>
          <Btn label="Heading 3" on={s.h3} onClick={() => run().toggleHeading({ level: 3 }).run()}>
            <Heading3 size={16} />
          </Btn>
        </div>
        <div className="rte-group">
          <Btn label="Bold" on={s.bold} onClick={() => run().toggleBold().run()}>
            <Bold size={16} />
          </Btn>
          <Btn label="Italic" on={s.italic} onClick={() => run().toggleItalic().run()}>
            <Italic size={16} />
          </Btn>
          <Btn label="Underline" on={s.underline} onClick={() => run().toggleUnderline().run()}>
            <Underline size={16} />
          </Btn>
          <Btn label="Strikethrough" on={s.strike} onClick={() => run().toggleStrike().run()}>
            <Strikethrough size={16} />
          </Btn>
          <Btn label="Inline code" on={s.code} onClick={() => run().toggleCode().run()}>
            <Code size={16} />
          </Btn>
        </div>
        <div className="rte-group">
          <Btn label="Bulleted list" on={s.bullet} onClick={() => run().toggleBulletList().run()}>
            <List size={16} />
          </Btn>
          <Btn label="Numbered list" on={s.ordered} onClick={() => run().toggleOrderedList().run()}>
            <ListOrdered size={16} />
          </Btn>
          <Btn label="Quote" on={s.quote} onClick={() => run().toggleBlockquote().run()}>
            <Quote size={16} />
          </Btn>
          <Btn label="Code block" on={s.codeBlock} onClick={() => run().toggleCodeBlock().run()}>
            <SquareCode size={16} />
          </Btn>
          <Btn label="Horizontal rule" onClick={() => run().setHorizontalRule().run()}>
            <Minus size={16} />
          </Btn>
        </div>
        <div className="rte-group">
          <Btn label="Align left" on={s.left} onClick={() => run().setTextAlign("left").run()}>
            <AlignLeft size={16} />
          </Btn>
          <Btn
            label="Align centre"
            on={s.center}
            onClick={() => run().setTextAlign("center").run()}
          >
            <AlignCenter size={16} />
          </Btn>
          <Btn label="Align right" on={s.right} onClick={() => run().setTextAlign("right").run()}>
            <AlignRight size={16} />
          </Btn>
        </div>
        <div className="rte-group">
          <Btn label="Link" on={s.link} onClick={openLink}>
            <Link2 size={16} />
          </Btn>
          {s.link ? (
            <Btn
              label="Remove link"
              onClick={() => run().extendMarkRange("link").unsetLink().run()}
            >
              <Unlink size={16} />
            </Btn>
          ) : null}
          <Btn label="Insert image" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 size={16} className="adm-spin" /> : <ImagePlus size={16} />}
          </Btn>
          <Btn
            label="Insert table"
            onClick={() => run().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            <Table2 size={16} />
          </Btn>
          <Btn label="Clear formatting" onClick={() => run().clearNodes().unsetAllMarks().run()}>
            <RemoveFormatting size={16} />
          </Btn>
        </div>
        {s.table ? (
          <div className="rte-group">
            <Btn label="Add row below" onClick={() => run().addRowAfter().run()}>
              <Rows3 size={16} />
            </Btn>
            <Btn label="Delete row" onClick={() => run().deleteRow().run()}>
              <Minus size={16} />
            </Btn>
            <Btn label="Add column after" onClick={() => run().addColumnAfter().run()}>
              <Columns3 size={16} />
            </Btn>
            <Btn label="Delete column" onClick={() => run().deleteColumn().run()}>
              <Minus size={16} style={{ transform: "rotate(90deg)" }} />
            </Btn>
            <Btn label="Delete table" onClick={() => run().deleteTable().run()}>
              <Trash2 size={16} />
            </Btn>
          </div>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          hidden
          onChange={(e) => void pickImage(e.target.files?.[0])}
          data-testid="editor-image-input"
        />
      </div>

      {linkOpen ? (
        <div className="rte-link-row">
          <input
            className="adm-input"
            type="text"
            value={linkValue}
            placeholder="https://example.com"
            aria-label="Link address"
            autoFocus
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") setLinkOpen(false);
            }}
          />
          <button type="button" className="adm-btn is-sm" onClick={applyLink}>
            Apply
          </button>
          {linkError ? (
            <span className="adm-error" style={{ alignSelf: "center" }}>
              {linkError}
            </span>
          ) : null}
        </div>
      ) : null}

      {s.image ? (
        <div className="rte-link-row">
          {/* editor.commands (not the focusing `run()` chain) so typing here doesn't kick focus back to the document. */}
          <input
            className="adm-input"
            type="text"
            value={s.imageAlt}
            placeholder="Alt text (describe the image)"
            aria-label="Image alt text"
            onChange={(e) => editor.commands.updateAttributes("image", { alt: e.target.value })}
          />
          <input
            className="adm-input"
            type="text"
            value={s.imageTitle}
            placeholder="Caption (optional)"
            aria-label="Image caption"
            onChange={(e) => editor.commands.updateAttributes("image", { title: e.target.value })}
          />
        </div>
      ) : null}

      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
}
