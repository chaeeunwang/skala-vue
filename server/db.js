import { createClient } from '@supabase/supabase-js'

let supabase

export const getSupabase = () => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseSecretKey) {
    const error = new Error('SUPABASE_URL 또는 SUPABASE_SECRET_KEY가 설정되지 않았어요.')
    error.code = 'DATABASE_NOT_CONFIGURED'
    throw error
  }

  if (!supabase) {
    // 서버리스 인스턴스가 재사용되는 동안 클라이언트를 한 번만 생성한다.
    supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  return supabase
}
