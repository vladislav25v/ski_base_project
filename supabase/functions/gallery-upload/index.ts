import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type GalleryMeta = {
  width: number
  height: number
  blurhash: string
  caption?: string | null
}

const IMAGE_BUCKET = 'news_images'
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

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
  return { ok: true, userId: userData.user.id }
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
    const form = await req.formData()
    const files = form
      .getAll('files')
      .filter((item): item is File => item instanceof File)
    if (files.length === 0) {
      return jsonResponse({ error: 'No files provided' }, 400)
    }

    const metaRaw = form.get('meta')?.toString() ?? '[]'
    let metaList: GalleryMeta[] = []
    try {
      metaList = JSON.parse(metaRaw) as GalleryMeta[]
    } catch {
      metaList = []
    }

    const items: Array<{
      id: string
      createdAt: string
      storagePath: string
      caption: string | null
      width: number | null
      height: number | null
      blurhash: string | null
    }> = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      if (!file.type.startsWith('image/')) {
        return jsonResponse({ error: 'Invalid file type' }, 400)
      }
      if (file.size > MAX_IMAGE_SIZE) {
        return jsonResponse({ error: 'File too large' }, 400)
      }
      const extension = file.name.split('.').pop() ?? 'jpg'
      const storagePath = `gallery/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })
      if (uploadError) {
        return jsonResponse({ error: uploadError.message }, 400)
      }

      const meta = metaList[index]
      const payload = {
        storage_path: storagePath,
        caption: meta?.caption ?? null,
        width: meta?.width ?? null,
        height: meta?.height ?? null,
        blurhash: meta?.blurhash ?? null,
      }
      const { data, error } = await supabase
        .from('gallery_pictures')
        .insert(payload)
        .select()
        .single()
      if (error || !data) {
        await supabase.storage.from(IMAGE_BUCKET).remove([storagePath])
        return jsonResponse({ error: error?.message ?? 'Insert failed' }, 400)
      }
      items.push({
        id: data.id,
        createdAt: data.created_at,
        storagePath: data.storage_path,
        caption: data.caption,
        width: data.width,
        height: data.height,
        blurhash: data.blurhash,
      })
    }

    return jsonResponse({ items }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return jsonResponse({ error: message }, 500)
  }
})
