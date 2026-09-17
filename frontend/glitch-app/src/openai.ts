type Effects = {
  hp?: number
  eng?: number
  pub?: number
  sec?: number
}

type CardData = {
  title: string
  text: string
  rightChoice: string
  leftChoice: string
  rightEffects: Effects
  leftEffects: Effects
}

export async function generateGlitchCard(tape: number[]): Promise<CardData> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    return mockCard()
  }

  const sysPrompt = `You are the Kernel Observer of a cyberpunk game.
The player memory tape starts at 50. If any stat reaches 0 or 100 the player dies.
Current tape: [HP: ${tape[0]}, ENG: ${tape[1]}, PUB: ${tape[2]}, SEC: ${tape[3]}]
Create a dilemma in a Lapse/Reigns tone with two options.
IMPORTANT: For rightChoice and leftChoice, write only the action. Do not include numbers or explicit gains/losses.
Return a pure JSON with this exact schema (no markdown):
{
  "title": "EVENT TITLE IN UPPERCASE",
  "text": "Short narrative (max 3 lines).",
  "rightChoice": "Right action (no numbers)",
  "leftChoice": "Left action (no numbers)",
  "rightEffects": {"hp": Z, "eng": Y, "pub": X, "sec": W},
  "leftEffects": {"hp": Z, "eng": Y, "pub": X, "sec": W}
}
Effects must be reasonable (-15 to +15).
`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: sysPrompt }],
        temperature: 0.8,
      }),
    })

    const data = await res.json()
    if (data.choices && data.choices[0]) {
      return JSON.parse(data.choices[0].message.content)
    }
  } catch (err) {
    console.error('OpenAI error', err)
  }

  return mockCard()
}

function mockCard(): CardData {
  return {
    title: 'NODE CORRUPTED (MOCK)',
    text: 'An anomaly crosses your path in the lower grid.',
    rightChoice: 'Crack the relay',
    leftChoice: 'Fade into the alley',
    rightEffects: { hp: -10, eng: 0, pub: 10, sec: -5 },
    leftEffects: { hp: 0, eng: -10, pub: 0, sec: 5 },
  }
}
