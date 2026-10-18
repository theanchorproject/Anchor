// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/XrExE9yKIg1WjnnlVkGX`, {
      method: 'POST',
      headers: {
        'accept': 'audio/mpeg',
        'xi-api-key': ELEVENLABS_API_KEY || "",
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_flash_v2_5", // Updated to the new, ultra-fast model
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`ElevenLabs rejected: ${response.status} - ${errText}`)
      throw new Error(errText)
    }

    const audioBuffer = await response.arrayBuffer()

    return new Response(audioBuffer, {
      headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg' },
    })
  } catch (error) {
    console.error("Function Error:", (error as Error).message)
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    })
  }
})