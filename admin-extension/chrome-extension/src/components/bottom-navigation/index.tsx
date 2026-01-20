import React from "react"

export type BottomNavigationId = "page" | "sitemap" | "library" | "measure" | "account"
export type BottomNavigationActive = BottomNavigationId | "new-match"

export interface BottomNavigationItem {
  id: BottomNavigationId
  label: string
  icon: React.ReactNode
}

export interface BottomNavigationProps {
  active: BottomNavigationActive
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
    id: "library",
    label: "Library",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="currentColor"
        className="bi bi-play-btn-fill"
        viewBox="0 0 16 16"
      >
        <path d="M0 12V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2m6.79-6.907A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814z"/>
      </svg>
    ),
  },
  {
    id: "sitemap",
    label: "Controls",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-sliders" viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M11.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M9.05 3a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0V3zM4.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M2.05 8a2.5 2.5 0 0 1 4.9 0H16v1H6.95a2.5 2.5 0 0 1-4.9 0H0V8zm9.45 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-2.45 1a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0v-1z"/>
      </svg>
    ),
  },
  {
    id: "measure",
    label: "Measure",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-flask-fill" viewBox="0 0 16 16">
        <path d="M11.5 0a.5.5 0 0 1 0 1H11v5.358l4.497 7.36c.099.162.16.332.192.503l.013.063.008.083q.006.053.007.107l-.003.09q-.001.047-.005.095-.006.053-.017.106l-.016.079q-.012.049-.028.096l-.028.086a1.5 1.5 0 0 1-.17.322 1.5 1.5 0 0 1-.395.394q-.04.028-.082.054-.045.026-.095.049l-.073.035-.09.033q-.05.02-.103.034-.04.01-.08.017-.053.012-.108.021l-.006.002-.202.013H1.783l-.214-.015a1.503 1.503 0 0 1-1.066-2.268L5 6.359V1h-.5a.499.499 0 0 1-.354-.854A.5.5 0 0 1 4.5 0zm.5 12a.5.5 0 0 0 0 1h1.885l-.61-1zm-1-2a.5.5 0 0 0 0 1h1.664l-.612-1zm-1-2a.5.5 0 0 0 0 1h1.441l-.61-1zM9 6a.5.5 0 0 0 0 1h1.22l-.147-.24A.5.5 0 0 1 10 6.5V6zm0-2a.5.5 0 0 0 0 1h1V4zm0-2a.5.5 0 0 0 0 1h1V2z"/>
      </svg>
    ),
  },
  {
    id: "account",
    label: "Account",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-person-fill" viewBox="0 0 16 16">
        <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/>
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
          background: #f6f7fb;
          padding: 8px;
        }
        .sidepanel-bottom-nav__inner {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
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
          background: #1f2937;
          color: #f8fafc;
          border: 1px solid #ffffff;
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
