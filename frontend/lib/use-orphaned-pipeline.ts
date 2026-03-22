"use client";

import { useState, useCallback } from "react";

/**
 * Hook for managing orphaned pipeline modal state.
 * Use this in any pipeline step page to show the save prompt
 * after an orphaned (no-session) run completes.
 */
export function useOrphanedPipeline() {
  const [showModal, setShowModal] = useState(false);
  const [orphanedOutput, setOrphanedOutput] = useState<Record<string, unknown> | null>(null);

  const triggerOrphanedPrompt = useCallback(
    (output: Record<string, unknown>) => {
      setOrphanedOutput(output);
      setShowModal(true);
    },
    []
  );

  const closeModal = useCallback(() => {
    setShowModal(false);
    setOrphanedOutput(null);
  }, []);

  return {
    showOrphanedModal: showModal,
    orphanedOutput,
    triggerOrphanedPrompt,
    closeOrphanedModal: closeModal,
  };
}
