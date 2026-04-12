/**
 * One-off import script: downloads the winemag 130k CSV and bulk-inserts
 * it into the Supabase wine_catalogue table.
 *
 * Usage:
 *   npx tsx scripts/import-wine-catalogue.ts
 *
 * Requires .env.local to have:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← add this from Supabase → Settings → API
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse'
import { Readable } from 'stream'

const CSV_URL =
  'https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2019/2019-05-28/winemag-data-130k-v2.csv'

const BATCH_SIZE = 500

// ── Load env ──────────────────────────────────────────────────
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// ── Helpers ───────────────────────────────────────────────────
function parseVintage(title: string): number | null {
  const m = title.match(/\b(19[5-9]\d|20[012]\d)\b/)
  return m ? parseInt(m[1]) : null
}

interface Row {
  title:   string
  winery:  string
  variety: string
  country: string
  province: string
  region_1: string
  points:   string
  price:    string
  description: string
}

interface CatalogueRow {
  title:       string
  winery:      string
  variety:     string
  country:     string
  province:    string
  region:      string
  vintage:     number | null
  points:      number | null
  price_usd:   number | null
  description: string
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('⬇️  Downloading winemag CSV (~50 MB)…')
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`)
  const csvText = await res.text()
  console.log(`✓  Downloaded ${(csvText.length / 1_000_000).toFixed(1)} MB`)

  // ── Check if already populated ────────────────────────────
  const { count } = await supabase
    .from('wine_catalogue')
    .select('*', { count: 'exact', head: true })

  if ((count ?? 0) > 1000) {
    console.log(`ℹ️  Table already has ${count?.toLocaleString()} rows — skipping import.`)
    console.log('   Delete all rows first if you want to re-import.')
    process.exit(0)
  }

  // ── Parse CSV ─────────────────────────────────────────────
  console.log('🔍  Parsing CSV…')
  const records: Row[] = await new Promise((resolve, reject) => {
    const rows: Row[] = []
    Readable.from([csvText])
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', (r: Row) => rows.push(r))
      .on('end',  () => resolve(rows))
      .on('error', reject)
  })
  console.log(`✓  Parsed ${records.length.toLocaleString()} rows`)

  // ── Transform ─────────────────────────────────────────────
  const rows: CatalogueRow[] = records
    .filter(r => r.title?.trim())
    .map(r => ({
      title:       r.title?.trim()    || '',
      winery:      r.winery?.trim()   || '',
      variety:     r.variety?.trim()  || '',
      country:     r.country?.trim()  || '',
      province:    r.province?.trim() || '',
      region:      r.region_1?.trim() || '',
      vintage:     parseVintage(r.title ?? ''),
      points:      r.points ? parseInt(r.points) : null,
      price_usd:   r.price  ? parseFloat(r.price)  : null,
      description: r.description?.trim() || '',
    }))

  // ── Bulk insert in batches ─────────────────────────────────
  console.log(`⬆️  Inserting ${rows.length.toLocaleString()} rows in batches of ${BATCH_SIZE}…`)
  let inserted = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('wine_catalogue').insert(batch)
    if (error) {
      errors.push(`Batch ${i}–${i + BATCH_SIZE}: ${error.message}`)
      if (errors.length > 5) { console.error('Too many errors, aborting'); break }
    } else {
      inserted += batch.length
    }
    // Progress every 10k rows
    if (inserted % 10_000 < BATCH_SIZE) {
      process.stdout.write(`\r   ${inserted.toLocaleString()} / ${rows.length.toLocaleString()}`)
    }
  }

  console.log(`\n✅  Import complete — ${inserted.toLocaleString()} rows inserted`)
  if (errors.length) {
    console.error('⚠️  Errors:', errors)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
