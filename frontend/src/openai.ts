export async function generateGlitchCard(tape: number[]) {
    // API KEY SHOULD BE IN .env AS VITE_OPENAI_API_KEY
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("Sem chave API da OpenAI. Usando cartas mocadas.");
      return mockCard();
    }

    const sysPrompt = `Você é o Kernel Observer de um jogo cyberpunk. 
A fita de memória do jogador (começa em 50, se chegar em 0 ou 100 ele morre e o jogo acaba) está assim: 
[HP: ${tape[0]}, ENERGIA: ${tape[1]}, OPINIAO_PUB: ${tape[2]}, SEGURANCA: ${tape[3]}]
Crie um dilema no estilo 'Lapse/Reigns' com uma opção que gaste ou resgate recursos.
IMPORTANTÍSSIMO: Em 'rightChoice' e 'leftChoice', escreva APENAS a ação do jogador (ex: "Invadir sistema"). NÃO coloque NENHUM número (-10, +20) ou dica explícita do que vai perder ou ganhar nos textos!!
Retorne um JSON puro neste exato formato (sem marcações markdown, apenas o json):
{
  "title": "TITULO DO EVENTO EM MAIUSCULAS",
  "text": "Narrativa curta do que está acontecendo (máx 3 linhas).",
  "rightChoice": "Ação Direita (Sem números)",
  "leftChoice": "Ação Esquerda (Sem números)",
  "rightEffects": {"hp": Z, "eng": Y, "pub": X, "sec": W},
  "leftEffects": {"hp": Z, "eng": Y, "pub": X, "sec": W}
}
Importante: Os efeitos nos atributos (hp, eng, pub, sec) devem ser de magnitude razoável (-15 a +15). 
`;

   try {
       const res = await fetch("https://api.openai.com/v1/chat/completions", {
           method: "POST",
           headers: {
               "Content-Type": "application/json",
               "Authorization": `Bearer ${apiKey}`
           },
           body: JSON.stringify({
               model: "gpt-4o-mini",
               messages: [{role: "system", content: sysPrompt}],
               temperature: 0.8
           })
       });
       const data = await res.json();
       if (data.choices && data.choices[0]) {
           return JSON.parse(data.choices[0].message.content);
       }
   } catch(e) {
       console.error("Erro no openAI:", e);
   }
   return mockCard();
}

function mockCard() {
    return {
        title: "NODE CORROMPIDO (Mock)",
        text: "Uma anomalia cruza seu caminho...",
        rightChoice: "Invadir Terminal",
        leftChoice: "Fugir para as Sombras",
        rightEffects: { hp: -10, eng: 0, pub: 10, sec: -5 },
        leftEffects: { hp: 0, eng: -10, pub: 0, sec: 5 }
    };
}
