import PairingClient from './PairingClient'

// Server component: reads ?meal= from URL and passes it to the interactive client
export default async function PairingPage({
  searchParams,
}: {
  searchParams: Promise<{ meal?: string }>
}) {
  const { meal } = await searchParams
  return <PairingClient initialMeal={meal ?? ''} />
}
