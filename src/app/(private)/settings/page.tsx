import { SettingsPageContent } from "@/modules/import-mapping/components/settings-page-content"

type SettingsPageProps = {
  searchParams?: Promise<{
    tab?: string | string[]
  }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams
  const tab = Array.isArray(params?.tab) ? params?.tab[0] : params?.tab

  return <SettingsPageContent initialTab={tab === "display" ? "display" : "mapping"} />
}
