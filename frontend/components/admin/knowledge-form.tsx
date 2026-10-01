"use client";

import { FormEvent, useState } from "react";

import { AdminField, FormFeedback, SubmitButton, Warning } from "@/components/admin/form-parts";
import { adminInputClass } from "@/components/admin/ui";
import { useAdminMutation } from "@/components/admin/use-admin-mutation";
import type { AdminKnowledgeDocument } from "@/lib/admin/types";

const MAX_CONTENT = 200_000;

export function KnowledgeForm({ document }: { document?: AdminKnowledgeDocument }) {
  const [title, setTitle] = useState(document?.title ?? "");
  const [content, setContent] = useState(document?.content ?? "");
  const { busy, error, success, run } = useAdminMutation();
  const contentChanged = document !== undefined && content !== document.content;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document) {
      await run<AdminKnowledgeDocument>("/api/admin/knowledge", "POST", { title: title.trim(), content: content.trim() }, {
        success: "Document created.",
        fallbackError: "The document could not be created.",
        redirect: (created) => `/admin/knowledge/${created.id}`,
      });
      return;
    }
    const body: Record<string, string> = {};
    if (title !== document.title) body.title = title.trim();
    if (contentChanged) body.content = content.trim();
    await run(`/api/admin/knowledge/${document.id}`, "PATCH", { ...body, expected_updated_at: document.updated_at }, {
      success: Object.keys(body).length ? "Document saved. The voice agent uses it from the next question." : "No changes to save.",
      fallbackError: "The document could not be saved.",
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Warning>
        The voice agent answers customer questions from this text. Write only verified studio policies and facts;
        anything here may be repeated to customers word for word.
      </Warning>
      <AdminField label="Title" htmlFor="knowledge-title">
        <input id="knowledge-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={500} className={adminInputClass} />
      </AdminField>
      <AdminField label="Content" htmlFor="knowledge-content" hint={`${content.length.toLocaleString()} / ${MAX_CONTENT.toLocaleString()} characters`}>
        <textarea id="knowledge-content" value={content} onChange={(event) => setContent(event.target.value)} required maxLength={MAX_CONTENT} rows={18} className={`${adminInputClass} h-auto py-3 leading-6`} />
      </AdminField>
      {contentChanged && document?.has_embedding ? (
        <p className="text-xs leading-5 text-ink/45">Saving new content replaces this document&apos;s stored semantic embedding, so search never matches outdated text.</p>
      ) : null}
      <div className="flex flex-col gap-4 border-t border-ink/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <FormFeedback error={error} success={success} />
        <SubmitButton busy={busy} label={document ? "Save document" : "Create document"} busyLabel="Saving" />
      </div>
    </form>
  );
}
