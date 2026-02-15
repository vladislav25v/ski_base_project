import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const IMAGE_BUCKET = 'news_images'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const getSupabaseClient = (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
}

const assertAdmin = async (supabase: ReturnType<typeof createClient>) => {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (error || !data || data.role !== 'admin') {
    return { ok: false, status: 403, message: 'Forbidden' }
  }
  return { ok: true }
}

const getStoragePathFromUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    const publicPrefix = `/storage/v1/object/public/${IMAGE_BUCKET}/`
    if (parsedUrl.pathname.startsWith(publicPrefix)) {
      return decodeURIComponent(parsedUrl.pathname.slice(publicPrefix.length))
    }
    return null
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabase = getSupabaseClient(req)
  const adminCheck = await assertAdmin(supabase)
  if (!adminCheck.ok) {
    return jsonResponse({ error: adminCheck.message }, adminCheck.status)
  }

  try {
    const { id } = await req.json()
    if (!id) {
      return jsonResponse({ error: 'Missing id' }, 400)
    }

    const { data, error } = await supabase
      .from('news')
      .select('image_url')
      .eq('id', id)
      .single()
    if (error || !data) {
      return jsonResponse({ error: error?.message ?? 'Not found' }, 404)
    }

    const imageUrl = data.image_url
    if (imageUrl) {
      const path = getStoragePathFromUrl(imageUrl)
      if (path) {
        const { error: storageError } = await supabase.storage
          .from(IMAGE_BUCKET)
          .remove([path])
        if (storageError) {
          return jsonResponse({ error: storageError.message }, 400)
        }
      }
    }

    const { error: deleteError } = await supabase.from('news').delete().eq('id', id)
    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 400)
    }

    return jsonResponse({ success: true }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return jsonResponse({ error: message }, 500)
  }
})
