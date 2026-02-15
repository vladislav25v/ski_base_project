import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const form = await req.formData()
    const id = form.get('id')?.toString() ?? ''
    const title = form.get('title')?.toString().trim() ?? ''
    const text = form.get('text')?.toString().trim() ?? ''
    const removeImage = form.get('remove_image')?.toString() === 'true'
    const imageFile = form.get('image')

    if (!title) {
      return jsonResponse({ error: 'Missing title' }, 400)
    }
    if (!text) {
      return jsonResponse({ error: 'Missing text' }, 400)
    }

    let previousImageUrl: string | null = null
    if (id) {
      const { data, error } = await supabase
        .from('news')
        .select('image_url')
        .eq('id', id)
        .single()
      if (error) {
        return jsonResponse({ error: error.message }, 400)
      }
      previousImageUrl = data?.image_url ?? null
    }

    let newImageUrl = previousImageUrl ?? null
    let uploadedPath = ''

    if (imageFile instanceof File) {
      if (!imageFile.type.startsWith('image/')) {
        return jsonResponse({ error: 'Invalid file type' }, 400)
      }
      if (imageFile.size > MAX_IMAGE_SIZE) {
        return jsonResponse({ error: 'File too large' }, 400)
      }
      const extension = imageFile.name.split('.').pop() ?? 'jpg'
      const fileName = `news/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(fileName, imageFile, {
          contentType: imageFile.type || 'application/octet-stream',
          upsert: false,
        })
      if (uploadError) {
        return jsonResponse({ error: uploadError.message }, 400)
      }
      uploadedPath = fileName
      const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(fileName)
      newImageUrl = data.publicUrl
    } else if (removeImage) {
      newImageUrl = null
    }

    const payload = { title, text, image_url: newImageUrl }
    let result
    if (id) {
      result = await supabase
        .from('news')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
    } else {
      result = await supabase.from('news').insert(payload).select().single()
    }

    if (result.error || !result.data) {
      if (uploadedPath) {
        await supabase.storage.from(IMAGE_BUCKET).remove([uploadedPath])
      }
      return jsonResponse({ error: result.error?.message ?? 'Save failed' }, 400)
    }

    if (
      previousImageUrl &&
      (removeImage || (newImageUrl && newImageUrl !== previousImageUrl))
    ) {
      const previousPath = getStoragePathFromUrl(previousImageUrl)
      if (previousPath) {
        await supabase.storage.from(IMAGE_BUCKET).remove([previousPath])
      }
    }

    return jsonResponse(
      {
        item: {
          id: result.data.id,
          createdAt: result.data.created_at,
          title: result.data.title,
          text: result.data.text,
          imageUrl: result.data.image_url,
        },
      },
      200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return jsonResponse({ error: message }, 500)
  }
})
