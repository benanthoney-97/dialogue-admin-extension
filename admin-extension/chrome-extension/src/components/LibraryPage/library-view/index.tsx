import React, { useCallback, useEffect, useState } from "react"

import { DecisionCard } from "../../decision-card"
import type { DecisionCardProps } from "../../decision-card"
import { LibraryDocumentsGrid } from "../library-documents-grid"
import type { LibraryDocument } from "../library-documents-grid"
import { LibraryProvidersGrid, type LibraryProvider } from "../library-providers-grid"
import { ConnectVideoLibrary } from "../../Auth/connect-video/connect-video-library"

export interface LibraryViewProps {
  showDecisionCard: boolean
  cardProps: DecisionCardProps
  decisionCardBackLabel: string
  decisionCardBackAriaLabel: string
  onDecisionSelect: (action: string) => void
  onDecisionBack: () => void
  providerTabLabel?: string
  selectedLibraryProviderId: number | null
  selectedLibraryProviderName?: string | null
  onLibraryProvidersBack: () => void
  onLibraryDocumentSelect: (doc: LibraryDocument) => void
  libraryTab: "provider" | "marketplace"
  providerId: number | null
  onLibraryTabChange: (tab: "provider" | "marketplace") => void
  onLibraryProviderSelect: (provider: LibraryProvider) => void
  onConnectLibrary: (libraryUrl: string) => Promise<void>
  libraryRefreshKey: number
}

export function LibraryView({
  showDecisionCard,
  cardProps,
  decisionCardBackLabel,
  decisionCardBackAriaLabel,
  onDecisionSelect,
  onDecisionBack,
  selectedLibraryProviderId,
  selectedLibraryProviderName,
  onLibraryProvidersBack,
  onLibraryDocumentSelect,
  libraryTab,
  providerId,
  onLibraryTabChange,
  onLibraryProviderSelect,
  providerTabLabel,
  onConnectLibrary,
  libraryRefreshKey,
}: LibraryViewProps) {
  const resolvedProviderTabLabel = providerTabLabel ?? "Your Library"
  const [showConnectPrompt, setShowConnectPrompt] = useState(true)

  useEffect(() => {
    setShowConnectPrompt(true)
  }, [providerId])

  const handleConnectLibraryPrompt = useCallback(
    async (libraryUrl: string) => {
      setShowConnectPrompt(false)
      await onConnectLibrary(libraryUrl)
    },
    [onConnectLibrary]
  )

  const handleDocumentsLoaded = useCallback((count: number) => {
    setShowConnectPrompt(count === 0)
  }, [])

  const renderConnectPrompt = () => (
    <ConnectVideoLibrary onNext={handleConnectLibraryPrompt} providerId={providerId} />
  )

  if (showDecisionCard) {
    return (
      <div className="decision-card-shell">
        <DecisionCard
          {...cardProps}
          backLabel={decisionCardBackLabel}
          backAriaLabel={decisionCardBackAriaLabel}
          onDecisionSelect={onDecisionSelect}
          onBack={onDecisionBack}
        />
      </div>
    )
  }

  if (selectedLibraryProviderId) {
    return (
      <div className="library-main-shell">
        <div className="library-documents-shell">
          <div className="library-documents-header">
            <button
              type="button"
              className="library-documents-back"
              onClick={onLibraryProvidersBack}
              aria-label="Back to providers"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"
                />
              </svg>
              <span className="sr-only">Back to providers</span>
            </button>
            <div>
              <div className="library-documents-title">
                {selectedLibraryProviderName ?? "Provider library"}
              </div>
            </div>
          </div>
          <LibraryDocumentsGrid
            providerId={selectedLibraryProviderId}
            onDocumentSelect={onLibraryDocumentSelect}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="library-main-shell">
        <div className="library-providers-shell">
          {!showConnectPrompt && (
            <div className="library-providers-shell__header">
              <div className="library-providers-shell__title">Video library</div>
              <p className="library-providers-shell__subtitle">
                Connect your video library and to partner channels
              </p>
            </div>
          )}
          {libraryTab === "provider" ? (
            providerId ? (
              <LibraryDocumentsGrid
                providerId={providerId}
                onDocumentSelect={onLibraryDocumentSelect}
              refreshKey={libraryRefreshKey}
              onDocumentsLoaded={handleDocumentsLoaded}
              showSearchBar={!showConnectPrompt}
              renderEmptyState={showConnectPrompt ? renderConnectPrompt : undefined}
            />
          ) : (
            <div className="panel__loading">
              <span>Loading provider data…</span>
            </div>
          )
        ) : (
          <LibraryProvidersGrid
            excludeProviderId={providerId ?? undefined}
            onSelect={onLibraryProviderSelect}
          />
        )}
      </div>
    </div>
  )
}
