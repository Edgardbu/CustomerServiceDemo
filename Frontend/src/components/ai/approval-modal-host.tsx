"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import { useApprovalStore } from "@/stores/approval-store";
import { useConversationStore } from "@/stores/conversation-store";
import { ApprovalModal } from "@/components/ai/approval-modal";

export function ApprovalModalHost() {
  const selectedId = useConversationStore((state) => state.selectedId);
  const pending = useApprovalStore((state) =>
    selectedId ? state.pendingByConversation[selectedId] : undefined,
  );
  const dismissed = useApprovalStore((state) =>
    selectedId ? state.isModalDismissed(selectedId) : false,
  );
  const inconsistent = useApprovalStore((state) =>
    selectedId ? state.isInconsistent(selectedId) : false,
  );
  const dismissModal = useApprovalStore((state) => state.dismissModal);
  const reopenModal = useApprovalStore((state) => state.reopenModal);
  const clearPendingApproval = useApprovalStore(
    (state) => state.clearPendingApproval,
  );
  const patchConversation = useConversationStore(
    (state) => state.patchConversation,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevSelectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedId && pending) {
      reopenModal(selectedId);
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId, pending, reopenModal]);

  const open = Boolean(selectedId && pending && !dismissed);

  function clearApprovalState(conversationId: string) {
    clearPendingApproval(conversationId);
    patchConversation(conversationId, {
      ai_status: "active",
      pending_ai_approval: null,
      updated_at: new Date().toISOString(),
    });
  }

  function handleClose(next: boolean) {
    if (!next && selectedId) dismissModal(selectedId);
  }

  async function handleApprove() {
    if (!pending || !selectedId) return;
    setLoading(true);
    setError(null);
    try {
      await api.approveAIApproval(pending.id, TENANT_ID);
      clearApprovalState(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve response");
    } finally {
      setLoading(false);
    }
  }

  async function handleEditAndSend(finalResponse: string) {
    if (!pending || !selectedId || !finalResponse.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.editAndSendAIApproval(pending.id, TENANT_ID, {
        final_response: finalResponse.trim(),
      });
      clearApprovalState(selectedId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send edited response",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!pending || !selectedId) return;
    setLoading(true);
    setError(null);
    try {
      await api.rejectAIApproval(pending.id, TENANT_ID);
      clearApprovalState(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject response");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {selectedId && inconsistent && !pending ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-lg items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 shadow-lg dark:text-amber-100">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>Approval state appears inconsistent.</p>
          </div>
        </div>
      ) : null}

      <ApprovalModal
        open={open}
        approval={pending ?? null}
        loading={loading}
        error={error}
        onOpenChange={handleClose}
        onApprove={handleApprove}
        onEditAndSend={handleEditAndSend}
        onReject={handleReject}
      />
    </>
  );
}
