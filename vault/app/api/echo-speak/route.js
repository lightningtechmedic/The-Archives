import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req) {
  try {
    const { text } = await req.json()
    if (!text) return new Response('No text', { status: 400 })

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',       // precise, calm, slightly cool — correct for Echo
      input: text,
      speed: 0.92,         // slightly slower than default — deliberate, not rushed
    })

    const buffer = Buffer.from(await mp3.arrayBuffer())

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[echo-speak] TTS error:', err)
    return new Response('TTS failed', { status: 500 })
  }
}
