export function getSupabaseEnv() {
  const clean = (val: string | undefined): string => {
    if (!val) return ''
    const lines = val.trim().split(/[\r\n]+/)
    return (lines[0] || '').trim().replace(/^['"]|['"]$/g, '')
  }

  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  return { url, anonKey }
}
