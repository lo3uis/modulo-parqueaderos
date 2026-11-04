export function getSupabaseEnv() {
  const clean = (val: string | undefined): string => {
    if (!val) return ''
    const lines = val.trim().split(/[\r\n]+/)
    return (lines[0] || '').trim().replace(/^['"]|['"]$/g, '')
  }

  let url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  let anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // Si la URL apunta al proyecto antiguo pausado (kukkulay...) o está vacía, usar el nuevo proyecto activo
  if (!url || url.includes('kukkulayjjhdfcuqkbme')) {
    url = 'https://jxtatucpbiwacqnkcdsc.supabase.co'
  }

  // Si la clave es la antigua o está vacía, usar la del nuevo proyecto activo
  if (!anonKey || anonKey.includes('cvXr1txDv3sb1R1d')) {
    anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6Imp4dGF0dWNwYml3YWNxbmtjZHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDUzMTAsImV4cCI6MjEwOTI4MTMxMH0.xjPGYD86wtcKVIhtKThTsaZTugVv4kMV4xkOjkbWQWY'
  }

  return { url, anonKey }
}
