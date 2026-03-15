# 🐍 Snake Minimalista (Brainfuck On-chain)

## 📜 Visão Geral
O **Snake Minimalista** é uma implementação ultra-simplificada do clássico jogo da cobrinha, desenhada especificamente para ser executada de forma on-chain pelo interpretador `BrainfuckVM.sol`.

Este documento serve como especificação de contexto para que uma IA ou desenvolvedor possa criar um **script Python gerador** (ex: `scripts/generate_snake.py`) que produzirá o complexo código Brainfuck final gerenciando a memória do jogo.

---

## 🕹️ Representação e Regras

- **Grid Lógico:** Um pequeno espaço de **5x5** para manter o estado gerenciável dentro das células da memória limitadas e economizar ciclos da VM.
- **Corpo da Cobra:** Representado visualmente/logicamente pelo caractere `o` ou `*`.
- **Comida:** Representada pelo caractere `+`.
- **Movimentação:** Feita usando as teclas de direção padrão (W, A, S, D).
- **Objetivo:** Coletar as comidas (`+`) para crescer o máximo possível em pontos sem bater nas paredes do grid.

*Nota:* Como é um ambiente de Smart Contract, o principal ponto de falha do jogador será **bater nas paredes do grid 5x5** (tentar ir além da coordenada 0 ou 4 de largura/altura).

---

## ⚙️ Entradas (Input)

A execução pode funcionar fornecendo a sequência de movimentos acumulados ou turno-a-turno. O programa deverá consumir bytes seguidos usando a instrução `,`:

1. **Bytes de Movimento:**
   A cada ciclo game-loop, o interpretador lê 1 byte correspondente à ação:
   - `w` (ASCII 119) = Cima (Y - 1)
   - `a` (ASCII 97) = Esquerda (X - 1)
   - `s` (ASCII 115) = Baixo (Y + 1)
   - `d` (ASCII 100) = Direita (X + 1)
   
2. **Bytes de Entropia (Comida):**
   Logo após ler o movimento, pode ler 1 byte extra providenciado pelo contrato (uma seed como `block.prevrandao % 25`) para calcular onde a próxima comida `+` aparecerá caso a comida atual seja consumida neste turno.

---

## 🎯 Lógica Central e Saídas (Output)

A fita do Brainfuck precisará manter persistência do estado das coordenadas da cobra e o tamanho. 

1. **Atualização da Posição:** Ao ler `w/a/s/d`, a VM deve alterar a coordenada X ou Y da cabeça da cobra.
2. **Verificação de Colisão (Game Over):** 
   - Se X ficar menor que 0 ou maior que 4.
   - Se Y ficar menor que 0 ou maior que 4.
   - Se ocorrer colisão, o programa encerra e emite uma flag indicando Derrota (ex: exibe o byte `0`).
3. **Coleta de Comida:** 
   - Se as novas coordenadas `[X, Y]` forem iguais às coordenadas da comida, o escore (tamanho da cobra) aumenta em 1.
   - A posição da nova comida é definida pela entropia recebida.
4. **Renderização/Saída:**
   - Em cada passo bem-sucedido, o código pode imprimir o estado (score atual) ou até mesmo desenhar o array de grid 5x5 plotando os caracteres no output (usando `.`), facilitando para o Frontend ler o retorno on-chain.

---

## 💻 Requisitos do Script Python Gerador

A IA/Script gerador de `generate_snake.py` deverá considerar:

1. **Mapeamento de Memória:** Definir claramente em quais células da fita Brainfuck residem: Coordenada X, Coordenada Y, Tamanho da Cobra, Coordenada da Comida e os inputs atuais.
2. **Loops e Condicionais em BF:** Lógica matemática de if/else usando ponteiros para lidar com `w, a, s, d` e comparar com limites de 0 a 4.
3. **Tamanho do Corpo:** Um sistema dinâmico (buffer circular na fita) caso se queira ter colisões com o próprio rabo, ou apenas guardar a última posição lida na simplificação.
4. **Otimização:** Código não otimizado de Brainfuck para estados 2D gasta muitos passos (steps). O Python deve usar padrões que minimizem as idas e vindas de ponteiros (`<` e `>`).

---

## 🚀 Utilidade no Ecossistema (Game Loop)

Enquanto jogos como *Jokenpô* ou *Cara ou Coroa* rodam em um turno, o Snake testa os limites estatais da `BrainfuckVM`.

**Como jogar via Blockchain:**
1. O jogador faz uma transação na dApp enviando uma string com seus passos desejados, ex: `playSnake("wddsa")`.
2. O Smart Contract empacota isso, intercala com valores de seed psuedo-aleatórias.
3. A `BrainfuckVM.sol` executa o arquivo de bytecodes gerado, validando passo a passo. 
4. Ao final, o output diz qual pontuação o jogador atingiu antes de morrer (ou sobreviver aquela sequência de teclas), atualizando uma Leaderboard on-chain.
