const TOP_VIDEOS = [
  { title: "Founder Welcome Series", company: "SeedLegals", avatar: "F" },
  { title: "Product Tour Clips", company: "Dialogue AI", avatar: "P" },
  { title: "Client Success Stories", company: "Astra Ventures", avatar: "C" },
  { title: "Partner Highlights", company: "Northwind Labs", avatar: "N" },
]

const renderRow = ({ title, company, avatar }) => `
  <tr class="top-videos__row">
    <td class="top-videos__cell">
      <div class="top-videos__media">
        <div class="top-videos__avatar">${avatar}</div>
        <div class="top-videos__title">
          <span class="top-videos__title-text">${title}</span>
          <span class="top-videos__company">${company}</span>
        </div>
      </div>
    </td>
  </tr>
`

export function mountTopVideos(selector = "#top-videos-slot") {
  const slot = document.querySelector(selector)
  if (!slot) return

  slot.innerHTML = `
    <section class="top-videos">
      <div class="top-videos__header">Top Performing Video Matches</div>
      <table class="top-videos__table">
        <tbody>
          ${TOP_VIDEOS.map(renderRow).join("")}
        </tbody>
      </table>
    </section>
  `
}
