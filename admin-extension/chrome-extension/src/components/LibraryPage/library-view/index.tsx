import React, { useCallback, useEffect, useState } from "react"

import { DecisionCard } from "../../decision-card"
import type { DecisionCardProps } from "../../decision-card"
import { LibraryDocumentsGrid } from "../library-documents-grid"
import type { LibraryDocument } from "../library-documents-grid"
import type { LibraryProvider } from "../library-providers-grid"
import { ConnectVideoLibrary } from "../../Auth/connect-video/connect-video-library"

type ChannelPlaylist = {
  id: string
  title: string
  cover_image?: string | null
  video_count?: number | null
  description?: string | null
}

type ChannelSummary = {
  id: number
  platform: "youtube" | "vimeo" | string
  channel_url: string
  channel_description?: string | null
  name?: string | null
  video_count?: number | null
  cover_image?: string | null
  playlists?: ChannelPlaylist[]
  latest_video_at?: string | null
}

const formatChannelDate = (iso?: string | null) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}

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
  hideProvidersHeading?: boolean
  selectedChannelId?: number | null
  onLibraryChannelSelect?: (channel: ChannelSummary | null) => void
  onLibraryChannelBack?: () => void
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
  hideProvidersHeading,
  selectedChannelId,
  onLibraryChannelSelect,
  onLibraryChannelBack,
}: LibraryViewProps) {
  const [channels, setChannels] = useState<ChannelSummary[]>([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<ChannelSummary | null>(null)

  const handleConnectLibraryPrompt = useCallback(
    async (libraryUrl: string) => {
      await onConnectLibrary(libraryUrl)
    },
    [onConnectLibrary]
  )

  const renderConnectPrompt = () => (
    <ConnectVideoLibrary onNext={handleConnectLibraryPrompt} providerId={providerId} />
  )

  const fetchChannels = useCallback(async () => {
    if (!providerId) return
    setChannelsLoading(true)
    try {
      const base =
        (process.env.PLASMO_PUBLIC_BACKEND_URL || "https://app.dialogue-ai.co").replace(/\/+$/, "")
      const url = new URL("/api/provider-channels", base)
      url.searchParams.set("provider_id", String(providerId))
      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error("Unable to load channels")
      }
      const payload = await response.json()
      setChannels(Array.isArray(payload?.channels) ? payload.channels : [])
    } catch (error) {
      console.error("[LibraryView] fetch channels failed", error)
    } finally {
      setChannelsLoading(false)
    }
  }, [providerId])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels, libraryRefreshKey])

  useEffect(() => {
    setSelectedChannel(null)
  }, [providerId])

  const handleChannelSelect = (channel: ChannelSummary) => {
    setSelectedChannel(channel)
    onLibraryChannelSelect?.(channel)
  }

  const handleChannelBack = () => {
    setSelectedChannel(null)
    onLibraryChannelSelect?.(null)
    onLibraryChannelBack?.()
  }

  useEffect(() => {
    if (!selectedChannelId || !channels.length) return
    const candidate = channels.find((channel) => channel.id === selectedChannelId)
    if (candidate) {
      setSelectedChannel(candidate)
    }
  }, [selectedChannelId, channels])

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
          <div className="library-documents-header library-documents-header--spaced">
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

  if (selectedChannel) {
    return (
      <div className="library-main-shell">
        <div className="library-documents-shell">
          <div className="library-documents-header">
            <button
              type="button"
              className="library-documents-back"
              onClick={handleChannelBack}
              aria-label="Back to channels"
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
              <span className="sr-only">Back to channels</span>
            </button>
            <div>
              <div className="library-documents-title library-documents-title--with-cover">
                {selectedChannel.cover_image && (
                  <img
                    src={selectedChannel.cover_image}
                    alt={selectedChannel.name ?? selectedChannel.channel_url ?? "Channel cover"}
                    className="library-documents-title__cover"
                  />
                )}
                <span>
                  {selectedChannel.name ?? selectedChannel.channel_url ?? "Channel documents"}
                </span>
              </div>
            </div>
          </div>
          <LibraryDocumentsGrid
            providerId={providerId ?? 0}
            channelId={selectedChannel.id}
            onDocumentSelect={onLibraryDocumentSelect}
            refreshKey={libraryRefreshKey}
            renderEmptyState={() => (
              <div className="provider-documents__empty">
                No videos yet, add content via the connect flow.
              </div>
            )}
          />
        </div>
      </div>
    )
  }

  const renderChannelList = () => {
    if (channelsLoading) {
      return (
        <div className="library-channel-empty">
          <span>Loading connected channels…</span>
        </div>
      )
    }
    if (channels.length === 0) {
      return renderConnectPrompt()
    }
    return (
      <>
        <div className="library-channel-grid">
          {channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              className="connect-video-preview__card connect-video-preview__card--summary provider-channel-card"
              onClick={() => handleChannelSelect(channel)}
            >
              <div className="connect-video-preview__provider-badge">
                <img
                  src={
                    channel.platform === "youtube"
                      ? "https://lmnoftavsxqvkpcleehi.supabase.co/storage/v1/object/public/platform_logos/YouTube_full-color_icon_(2017).svg.png"
                      : "https://lmnoftavsxqvkpcleehi.supabase.co/storage/v1/object/public/platform_logos/1280px-Vimeo_Logo.svg.png"
                  }
                  alt={`${channel.platform} logo`}
                />
              </div>
              <div className="connect-video-preview__metadata-grid">
                {channel.cover_image && (
                  <img
                    src={channel.cover_image}
                    alt={channel.channel_description ?? channel.channel_url}
                    className="connect-video-preview__thumb"
                  />
                )}
                  <div className="connect-video-preview__content">
                    <div className="connect-video-preview__title">
                      {channel.name ?? channel.channel_url ?? "Connected channel"}
                    </div>
                    <p className="connect-video-preview__meta">
                      {channel.video_count ?? 0} videos
                      {channel.latest_video_at && (
                        <> • Latest {formatChannelDate(channel.latest_video_at)}</>
                      )}
                    </p>
                  </div>
              </div>
              {channel.channel_description && (
                <p className="connect-video-preview__description connect-video-preview__description--full">
                  {channel.channel_description}
                </p>
              )}
            </button>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="library-main-shell">
      <div className="library-providers-shell">
        {!hideProvidersHeading && (
          <div className="library-providers-shell__header">
            <div className="library-providers-shell__title">Video channels</div>
            <p className="library-providers-shell__subtitle">
              Connect your video library and partner channels.
            </p>
          </div>
        )}
        {renderChannelList()}
      </div>
    </div>
  )
}
