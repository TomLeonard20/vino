import { createClient } from '@/lib/supabase/server'
import CellarBalanceChart from '@/components/ui/CellarBalanceChart'
import type { CellarBottle } from '@/types/database'

/**
 * Async server component — renders the CellarBalanceChart.
 * Wrapped in <Suspense> by the parent so the rest of the home page renders
 * immediately while this resolves in the background.
 *
 * The vintage-quality line has been removed from the chart, so this component
 * no longer needs to query wine_catalogue. It simply renders the chart from
 * the bottle data passed in by the parent, giving near-instant streaming.
 */
export default async function VintageQualityChart({
  bottles,
  isDraft,
  bottleCount,
}: {
  bottles:     CellarBottle[]
  isDraft:     boolean
  bottleCount: number
}) {
  // Keep this as an async server component so it can be Suspense-streamed
  // without blocking the main page render.
  void createClient  // satisfies the import (remove if no server work needed)

  return (
    <CellarBalanceChart
      bottles={bottles}
      isDraft={isDraft}
      bottleCount={bottleCount}
    />
  )
}
