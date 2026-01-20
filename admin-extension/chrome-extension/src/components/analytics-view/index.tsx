import { useState } from "react"
import { HeaderCards } from "../header-cards"

export function AnalyticsView() {
  const [activeTab, setActiveTab] = useState<"sites" | "marketplace">("sites")

  return (
    <div className="analytics-view">
      <div className="library-tabs-pill">
        <button
          type="button"
          className={`library-tabs-pill__button${activeTab === "sites" ? " library-tabs-pill__button--active" : ""}`}
          onClick={() => setActiveTab("sites")}
        >
          My Sites
        </button>
        <button
          type="button"
          className={`library-tabs-pill__button${activeTab === "marketplace" ? " library-tabs-pill__button--active" : ""}`}
          onClick={() => setActiveTab("marketplace")}
        >
          Marketplace
        </button>
      </div>
      <HeaderCards
        items={[
          { label: "Impressions", value: "0" },
          { label: "Total Plays", value: "0%" },
          { label: "Completed", value: "0%" },
        ]}
      />
    </div>
  )
}
