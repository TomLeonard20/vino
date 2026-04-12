import FindClient from './FindClient'

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  return <FindClient initialQuery={q ?? ''} />
}
