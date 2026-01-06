import React from "react"

export interface BottomNavigationItem {
  id: "page" | "threshold" | "sitemap" | "new-match"
  label: string
  icon: React.ReactNode
}

export interface BottomNavigationProps {
  active: BottomNavigationItem["id"]
  onSelect: (item: BottomNavigationItem["id"]) => void
}

const NAV_ITEMS: BottomNavigationItem[] = [
  {
    id: "page",
    label: "Page",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-file-earmark-break-fill" viewBox="0 0 16 16">
        <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V9H2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2zM2 12h12v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM.5 10a.5.5 0 0 0 0 1h15a.5.5 0 0 0 0-1z"/>
      </svg>
    ),
  },
  {
    id: "threshold",
    label: "Threshold",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-sliders" viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M11.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M9.05 3a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0V3zM4.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M2.05 8a2.5 2.5 0 0 1 4.9 0H16v1H6.95a2.5 2.5 0 0 1-4.9 0H0V8zm9.45 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-2.45 1a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0v-1z"/>
      </svg>
    ),
  },
  {
    id: "sitemap",
    label: "Sitemap",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-map-fill" viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M16 .5a.5.5 0 0 0-.598-.49L10.5.99 5.598.01a.5.5 0 0 0-.196 0l-5 1A.5.5 0 0 0 0 1.5v14a.5.5 0 0 0 .598.49l4.902-.98 4.902.98a.5.5 0 0 0 .196 0l5-1A.5.5 0 0 0 16 14.5zM5 14.09V1.11l.5-.1.5.1v12.98l-.402-.08a.5.5 0 0 0-.196 0zm5 .8V1.91l.402.08a.5.5 0 0 0 .196 0L11 1.91v12.98l-.5.1z"/>
      </svg>
    ),
  },
  {
    id: "new-match",
    label: "New match",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-plus-lg" viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"/>
      </svg>
    ),
  },
]

export function BottomNavigation({ active, onSelect }: BottomNavigationProps) {
  return (
    <nav className="sidepanel-bottom-nav">
      <div className="sidepanel-bottom-nav__inner">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item${item.id === active ? " nav-item--active" : ""}`}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <span className="nav-item__icon">{item.icon}</span>
            <span className="nav-item__label">{item.label}</span>
          </button>
        ))}
      </div>
      <style>{`
        .sidepanel-bottom-nav {
          border-top: 1px solid #e2e8f0;
          background: #fff;
          padding: 8px;
        }
        .sidepanel-bottom-nav__inner {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
        }
        .nav-item {
          border: none;
          border-radius: 12px;
          padding: 8px 6px;
          background: #f8fafc;
          color: #475467;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .nav-item--active {
          background: #0f172a;
          color: #f8fafc;
        }
        .nav-item svg {
          width: 20px;
          height: 20px;
        }
        .nav-item--active svg {
          fill: currentColor;
        }
      `}</style>
    </nav>
  )
}
