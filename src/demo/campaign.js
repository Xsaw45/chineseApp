// Le parrainage reste dans le cookie du serveur ; seuls les paramètres de campagne suivent les liens publics.
export function keepCampaign(search = location.search) {
  const campaign = [...new URLSearchParams(search)].filter(([key]) => /^utm_[a-z_]+$/.test(key))
  if (campaign.length === 0) return
  for (const link of document.querySelectorAll('a[data-campaign]')) {
    const url = new URL(link.href)
    for (const [key, value] of campaign) url.searchParams.set(key, value)
    link.href = url.pathname + url.search + url.hash
  }
}
