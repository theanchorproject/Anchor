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
    const { targetWord, category } = await req.json()
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

    if (!GEMINI_API_KEY) throw new Error("Missing Gemini API Key")

    const prompt = `You are a clinical semantic engine for a memory care application.
    Your task is to generate a trivia challenge for a patient with cognitive decline.
    Target Word: "${targetWord}"
    Category: "${category || 'everyday items'}"
    
    Provide a JSON response with exactly three keys:
    1. "clue": A simple, clear question asking what the item is. Do not use the target word in the clue.
    2. "distractors": An array of exactly 3 words. These MUST be semantically adjacent to the target word (same category, similar use), but distinctly incorrect. (e.g., if target is "toothbrush", distractors should be "hairbrush", "floss", "razor").
    3. "hint": A short, helpful sentence describing a physical characteristic or primary use of the target word. Do not use the target word.
    
    Output strictly valid JSON.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" } 
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini Error: ${await response.text()}`)
    }

    const data = await response.json()
    const aiText = data.candidates[0].content.parts[0].text
    
    const parsedJSON = JSON.parse(aiText)

    return new Response(JSON.stringify(parsedJSON), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error("Brain Error:", (error as Error).message)
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    })
  }
})