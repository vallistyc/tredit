import { createClient } from '@/lib/supabase/client'

export type AppRole = 'user' | 'verifier'

export async function getCurrentAppRole() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, role: null as AppRole | null }
  }

  const { data } = await supabase
    .from('profiles')
    .select('is_verifier')
    .eq('id', user.id)
    .single()

  return {
    user,
    role: (data?.is_verifier ? 'verifier' : 'user') as AppRole,
  }
}