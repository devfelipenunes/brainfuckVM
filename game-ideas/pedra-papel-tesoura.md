# 🪨📄✂️ Pedra, Papel e Tesoura (Brainfuck On-chain)

## 📜 Visão Geral
O **Pedra, Papel e Tesoura** (Rock, Paper, Scissors - Jokenpô) é uma implementação minimalista do clássico jogo, projetada para ser executada diretamente de forma determinística em uma Máquina Virtual Brainfuck na blockchain (utilizando o contrato `Brainfuck.sol` do repositório).

Este documento serve como especificação de contexto para que uma IA possa criar um **script Python** (aos moldes de `generate_dice.py` ou `generate_contador.py` presentes na pasta `scripts/`) que irá gerar, de forma programática, o código Brainfuck final otimizado.

---

## ⚙️ Entradas (Input)

O código Brainfuck deve consumir exatamente **2 bytes** de entrada sucessivos (utilizando a instrução `,` do Brainfuck em células de memória adjacentes).

1. **Primeiro Byte: Jogada do Player**
   Um valor de `0` a `2`.
   - `0` = 🪨 Pedra
   - `1` = 📄 Papel
   - `2` = ✂️ Tesoura
   
2. **Segundo Byte: Seed do Oponente (Ambiente/Casa)**
   Um número (normalmente `0` a `255`) que será providenciado pelo contrato na hora de rodar a VM (ex: derivado de `block.prevrandao` ou um pseudo-aleatório ofuscado).
   - O código Brainfuck deverá extrair a **Jogada do Oponente** calculando: `Oponente = Seed % 3`.

---

## 🎯 Lógica Central e Saídas (Output)

O código de Brainfuck deverá processar as duas jogadas e imprimir (via instrução `.`) exatamente **1 byte** de saída que demonstra o resultado final da partida sob a perspectiva do Player:

- **`0`**: 🤝 Empate (Player e Oponente jogaram a mesma coisa)
- **`1`**: 🏆 Vitória (O Player ganhou. Ex: Player `1` [Papel] vs Oponente `0` [Pedra])
- **`2`**: 💀 Derrota (A Casa ganhou. Ex: Player `0` [Pedra] vs Oponente `1` [Papel])

### 🧮 A Lógica Matemática (Diretriz para o Código)
Uma maneira canônica e eficiente de resolver quem ganha em Pedra-Papel-Tesoura mapeado para os inteiros `0, 1, 2` é observar o padrão circular da diferença entre as jogadas.
A equação recomendada para a IA implementar em Brainfuck é:

> **`Resultado = (Jogada_Player - Jogada_Oponente + 3) % 3`**

Com os possíveis valores de resultado:
- Se der **`0`**, é um empate.
- Se der **`1`**, o Player venceu.
- Se der **`2`**, o Oponente venceu.

*(Como o Brainfuck nativamente lida com células do tipo `uint8`, adicionar `+3` ou `+255` em subtrações ajuda a transpor o underflow mantendo as equações modulares concisas e seguras).*

---

## 💻 Requisitos do Script Python Gerador

A IA que ler este documento para criar o equivalente a `scripts/generate_jokenpo.py` deverá:
1. Usar a técnica de *helpers* e posicionamento de ponteiros (`go(target)`, `emit(str)`) já estabelecida no repositório.
2. Ler a jogada do player na Célula 0 e a seed na Célula 1.
3. Criar uma estrutura de repetição inteligente (loop Brainfuck) para calcular e aplicar o módulo `3` na Célula 1.
4. Aplicar a fórmula combinatória `(Célula0 - Célula1_mod_3 + 3) % 3`.
5. Mostrar testes de sanidade na simulação iterando por várias "Seeds" de 0 a 10 no terminal do python, comprovando que as regras batem (e que ele nunca emite um valor fora de 0, 1 ou 2).
6. Exportar o arquivo `.bf` e opcionalmente o `.txt` convertido para Hexadecimal pronto para colar no Solidity `BrainfuckVM`.

---

## 🚀 Utilidade no Ecossistema (Game Loop)
Essa versão é desenhada com o mínimo atrito e complexidade de bytes. No Smart Contract final:
* O usuário envia uma transação chamando `playJokenpo(uint8 myMove)`.
* O contrato puxa o código Brainfuck (`.bf` compilado), fornece `myMove` como o Input 1, provê pseudorandom block data como o Input 2 e aciona a `BrainfuckVM`.
* Mediante o byte de retorno (`1 == Vitoria`), o contrato realiza o *settlement* de prêmios on-chain.
