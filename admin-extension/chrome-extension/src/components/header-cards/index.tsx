import React from "react"

export interface HeaderCardItem {
  label: React.ReactNode
  value: React.ReactNode
  isStatus?: boolean
  statusClass?: string
}

export interface HeaderCardsProps {
  items: HeaderCardItem[]
}

export function HeaderCards({ items }: HeaderCardsProps) {
  return (
    <div className="page-summary__overview-row">
      {items.map((item, index) => {
        const rootClass = [
          "page-summary__overview-card",
          item.isStatus ? "page-summary__overview-card--status" : "",
          item.statusClass ? item.statusClass : "",
        ]
          .filter(Boolean)
          .join(" ")
        const labelClass = [
          "page-summary__overview-label",
          item.statusClass ? item.statusClass : "",
        ]
          .filter(Boolean)
          .join(" ")
        return (
          <div className={rootClass} key={`${item.label}-${index}`}>
            <strong className={item.statusClass}>{item.value}</strong>
            <span className={labelClass}>{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}
