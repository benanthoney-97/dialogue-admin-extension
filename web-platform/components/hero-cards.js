const HERO_CARDS = [
  {
    label: "Library Size",
    value: "1,240",
    meta: "(+12 this week)",
  },
  {
    label: "Distribution",
    value: "3",
    meta: "Web · iOS · Marketing Site",
  },
  {
    label: "Engagement Volume",
    value: "45.2k",
    meta: "versus 40k last month",
  },
  {
    label: "Estimated Production Saved",
    value: "$620,000",
    meta: "1,240 videos @ $500 each",
  },
]

const renderCard = ({ label, value, meta }) => `
  <article class="hero-card">
    <div class="hero-card__label">${label}</div>
    <div class="hero-card__value">${value}</div>
    <p class="hero-card__meta">${meta}</p>
  </article>
`

export function mountHeroCards(selector = "#hero-cards-slot") {
  const slot = document.querySelector(selector)
  if (!slot) return
  slot.innerHTML = HERO_CARDS.map(renderCard).join("")
}
