# 🧮 Jogo do Contador Invertido

## 📜 Visão Geral
O **Contador Invertido** é um puzzle matemático minimalista e estratégico. O jogador recebe um número inicial $N$ e deve reduzi-lo exatamente a $1$ utilizando o menor número de movimentos possível. 

O jogo testa a capacidade de planejamento reverso e otimização do jogador, sendo fácil de aprender, mas complexo de dominar nos níveis mais altos.

---

## ⚙️ Mecânicas Principais

O jogo começa com um número aleatório ou predefinido **N** (ex: 15, 50, 100, 999). 
A cada turno, o jogador pode escolher uma de duas ações:

1. **Subtrair 1**: Diminui o valor atual do contador em `1` unidade (ex: de 15 vai para 14).
2. **Dividir por 2**: Divide o valor atual pela metade. 
   * **Regra de Ouro**: Esta ação **só pode ser usada se o número atual for PAR**.

---

## 🎯 Objetivo e Condições
- **Vitória**: Alcançar exatamente o número **1**.
- **Desafio Principal**: Completar o puzzle no **menor número de passos (turnos)** possível (caminho ótimo).
- **Derrota (Opcional)**: Ultrapassar o limite máximo de movimentos (par).

---

## 📈 Progressão e Dificuldade
A dificuldade do jogo pode escalar através das seguintes variações:

* **Escala Numérica**: O jogo começa com números $N$ pequenos (ex: N=10) e vai aumentando gradativamente até números colossais.
* **Tempo Limite (Time Attack)**: Você tem 60 segundos para resolver o máximo de contadores possíveis.
* **Cargas Limitadas**: Uso limitado da operação "Dividir por 2" (ex: "Você só tem 3 divisões disponíveis no nível").

---

## 🕹️ Exemplo de Partida (Gameplay)
**Desafio**: Reduzir **N = 15** para **1** no menor número de passos.

* **Turno 1**: 15 (ímpar) -> Escolhe **Subtrair 1** ➡️ `14`
* **Turno 2**: 14 (par) -> Escolhe **Dividir por 2** ➡️ `7`
* **Turno 3**: 7 (ímpar) -> Escolhe **Subtrair 1** ➡️ `6`
* **Turno 4**: 6 (par) -> Escolhe **Dividir por 2** ➡️ `3`
* **Turno 5**: 3 (ímpar) -> Escolhe **Subtrair 1** ➡️ `2`
* **Turno 6**: 2 (par) -> Escolhe **Dividir por 2** ➡️ `1`

🎉 **Vitória em 6 passos!** (Este é comprovadamente o caminho perfeito para 15).

---

## 💡 Ideias de Implementação Analítica (On-chain / Brainfuck VM)
Dado o contexto do repositório, o jogo se encaixa perfeitamente em mecânicas web3 ou de baixo nível:

* **Gas Efficiency as a Feature**: Cada operação subtrai pontos ou consome recursos. A eficiência matemática do jogador reflete diretamente no custo do puzzle.
* **Daily Seed (Estilo Wordle)**: Um cron job ou Smart Contract atualiza um valor $N$ diário global usando o blockhash, e toda a comunidade tenta achar a resposta no menor número de passos (e os empates são resolvidos por quem fez primeiro).
* **Leaderboards de Otimização**: Salvar on-chain apenas os scores daqueles que encontrarem o chamado *"caminho de ouro"*, provando via transação a validação da sequência de cálculos.