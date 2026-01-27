import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../../lib/supabase"

export interface LibraryProvider {
  id: number
  name?: string
  logo_url?: string
}

export interface LibraryProvidersGridProps {
  onSelect: (provider: LibraryProvider) => void
  excludeProviderId?: number
}

export function LibraryProvidersGrid({ onSelect, excludeProviderId }: LibraryProvidersGridProps) {
  const [providers, setProviders] = useState<LibraryProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logoErrors, setLogoErrors] = useState<Record<number, boolean>>({})
  const [search, setSearch] = useState("")

  useEffect(() => {
    let canceled = false
    setLoading(true)
    setError(null)

    const fetchProviders = async () => {
      try {
        const { data, error } = await supabase
          .from("providers")
          .select("id,name,logo_url")
          .order("name", { ascending: true })
        if (canceled) return
        if (error) {
          throw error
        }
        const filtered = (data ?? []).filter((provider) => provider.id !== excludeProviderId)
        setProviders(filtered)
      } catch (err) {
        if (canceled) return
        console.error("[library-providers-grid] fetch error", err)
        setError(err?.message ?? "Unable to load providers")
      } finally {
        if (!canceled) {
          setLoading(false)
        }
      }
    }

    fetchProviders()

    return () => {
      canceled = true
    }
  }, [excludeProviderId])

  const initialsFor = useMemo(
    () => (name?: string) => {
      if (!name) return "?"
      return name
        .split(/\s+/)
        .map((segment) => segment[0])
        .filter(Boolean)
        .join("")
        .slice(0, 2)
        .toUpperCase()
    },
    []
  )

  const handleLogoError = (providerId: number) => {
    setLogoErrors((prev) => ({ ...prev, [providerId]: true }))
  }

  const renderState = (message: string) => (
    <div className="library-providers-grid__state">{message}</div>
  )

    const renderProviders = () => {
      if (loading) {
        return renderState("Loading providers…")
      }
      if (error) {
        return renderState(`Error: ${error}`)
      }
      const normalizedSearch = search.trim().toLowerCase()
      const filteredProviders =
        normalizedSearch === ""
          ? providers
          : providers.filter((provider) =>
              (provider.name || "").toLowerCase().includes(normalizedSearch)
            )
      if (filteredProviders.length === 0) {
        return renderState(
          normalizedSearch === ""
            ? "No providers found."
            : "No providers match your search."
        )
      }
      return filteredProviders.map((provider) => {
        const initials = initialsFor(provider.name)
        const showPlaceholder = !provider.logo_url || logoErrors[provider.id]

      return (
        <article
          key={provider.id}
          className="library-providers-grid__item"
          role="button"
          tabIndex={0}
          onClick={() => onSelect(provider)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onSelect(provider)
            }
          }}
        >
          <div className="library-providers-grid__logo">
            {provider.logo_url && !showPlaceholder ? (
              <img
                src={provider.logo_url}
                alt={provider.name ? `${provider.name} logo` : "Provider logo"}
                loading="lazy"
                onError={() => handleLogoError(provider.id)}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="library-providers-grid__name">
            {provider.name || "Unnamed provider"}
          </div>
        </article>
      )
    })
  }

  return (
    <div className="library-providers-grid">
      <div className="library-providers-grid__search">
        <input
          type="search"
          placeholder="Search providers"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="library-providers-grid__list">{renderProviders()}</div>
    </div>
  )
}
