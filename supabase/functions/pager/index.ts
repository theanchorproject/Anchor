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
    const { targetContact, patientName } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Anchor Emergency <onboarding@resend.dev>',
        to: targetContact,
        subject: '🚨 URGENT: Anchor Assistance Required',
        text: `EMERGENCY ALERT: ${patientName || 'The patient'} has pressed the emergency assistance button in the Anchor app and requires immediate help.`
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(errText)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error("Pager Error:", (error as Error).message)
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    })
  }
})