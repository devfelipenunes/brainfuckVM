#!/usr/bin/env python3
"""
Jogo do Contador Invertido — Brainfuck Code Generator

A validator for the "Contador Invertido" mathematical puzzle.

INPUT:
 - 1 byte: Initial number N
 - Variable bytes: Moves (1 for "Subtract 1", 2 for "Divide by 2")
 - 1 byte: 0 (EOF)

OUTPUT:
 - 1 byte: 1 (Win / Parou no 1 sem moves inválidos) or 0 (Loss / Erro)

Logic:
 Reads N. Sets Valid = 1.
 For each move:
  If move == 1: N = N - 1
  If move == 2:
    divmod(N, 2)
    N = Quotient
    If Remainder != 0: Valid = 0
 When moves end (move == 0):
  If N == 1 and Valid == 1: Output 1
  Else: Output 0
"""

def generate_contador_bf():
    code = []
    pos = 0

    def go(target):
        nonlocal pos
        if target > pos: code.append(">" * (target - pos))
        elif target < pos: code.append("<" * (pos - target))
        pos = target

    def emit(s): code.append(s)

    # 1. Read N into cell 1
    go(1); emit(",")
    # 2. Set Validation flag (cell 3) to 1
    go(3); emit("[-]+")

    # 3. Read first move
    go(2); emit(",")
    go(2); emit("[") # While move > 0

    # check move == 1
    go(4); emit("[-]"); go(5); emit("[-]")
    # copy cell 2 to 4
    go(2); emit("[-"); go(4); emit("+"); go(5); emit("+"); go(2); emit("]")
    go(5); emit("[-"); go(2); emit("+"); go(5); emit("]")

    go(4); emit("-") # subtract 1
    # NOT on 4 into 6
    go(6); emit("[-]+"); go(4); emit("["); go(6); emit("[-]"); go(4); emit("[-]]")
    
    go(6); emit("[") # IF move == 1
    go(1); emit("-") # N = N - 1
    go(6); emit("[-]")
    emit("]")

    # check move == 2
    go(4); emit("[-]"); go(5); emit("[-]")
    # copy cell 2 to 4
    go(2); emit("[-"); go(4); emit("+"); go(5); emit("+"); go(2); emit("]")
    go(5); emit("[-"); go(2); emit("+"); go(5); emit("]")

    go(4); emit("--") # subtract 2
    # NOT on 4 into 6
    go(6); emit("[-]+"); go(4); emit("["); go(6); emit("[-]"); go(4); emit("[-]]")
    
    go(6); emit("[") # IF move == 2
    # divmod N by 2
    # move N(1) to N_temp(14)
    go(1); emit("[-"); go(14); emit("+"); go(1); emit("]")
    
    go(12); emit("[-]") # Q
    go(13); emit("[-]") # R
    go(15); emit("[-]") # temp
    
    go(14); emit("[")
    go(14); emit("-")
    
    # copy R(13) to 15 using 16
    go(13); emit("[-"); go(15); emit("+"); go(16); emit("+"); go(13); emit("]")
    go(16); emit("[-"); go(13); emit("+"); go(16); emit("]")
    
    go(17); emit("[-]+") # NOT flag
    
    go(15); emit("[") # if R was 1
    go(13); emit("[-]") # R = 0
    go(12); emit("+") # Q++
    go(17); emit("[-]") # clear NOT
    go(15); emit("[-]")
    emit("]")
    
    go(17); emit("[") # if R was 0
    go(13); emit("+") # R = 1
    go(17); emit("[-]")
    emit("]")
    
    go(14); emit("]")
    
    # N = Q
    go(12); emit("[-"); go(1); emit("+"); go(12); emit("]")
    
    # If R != 0, Validation(3) = 0
    go(13); emit("[")
    go(3); emit("[-]")
    go(13); emit("[-]")
    emit("]")
    
    go(6); emit("[-]")
    emit("]")

    # read next move
    go(2); emit("[-]"); go(2); emit(",")
    emit("]")

    # loop ends. 
    # check if N == 1
    go(1); emit("-")
    go(6); emit("[-]+"); go(1); emit("["); go(6); emit("[-]"); go(1); emit("[-]]")
    
    # calculate result: Output = V(3) && N_is_1(6)
    go(8); emit("[-]")
    go(3); emit("[")
    go(6); emit("[")
    go(8); emit("+")
    go(6); emit("[-]")
    emit("]")
    go(3); emit("[-]")
    emit("]")
    
    # output the result (1 or 0)
    go(8); emit(".")
    
    return "".join(code)

def simulate_contador(n, moves):
    valid = 1
    for m in moves:
        if m == 1:
            n -= 1
        elif m == 2:
            q = n // 2
            r = n % 2
            n = q
            if r != 0:
                valid = 0
    return 1 if (n == 1 and valid) else 0

def run_bf_interpreter(code, inputs):
    # simplistic BF interpreter for test cases
    tape = [0] * 30000
    ptr = 0
    ip = 0
    input_idx = 0
    outputs = []
    
    # pair brackets
    brackets = {}
    stack = []
    for i, c in enumerate(code):
        if c == '[': stack.append(i)
        elif c == ']':
            start = stack.pop()
            brackets[start] = i
            brackets[i] = start
            
    while ip < len(code):
        c = code[ip]
        if c == '>': ptr += 1
        elif c == '<': ptr -= 1
        elif c == '+': tape[ptr] = (tape[ptr] + 1) % 256
        elif c == '-': tape[ptr] = (tape[ptr] - 1) % 256
        elif c == '.': outputs.append(tape[ptr])
        elif c == ',': 
            if input_idx < len(inputs):
                tape[ptr] = inputs[input_idx]
                input_idx += 1
            else:
                tape[ptr] = 0
        elif c == '[':
            if tape[ptr] == 0:
                ip = brackets[ip]
        elif c == ']':
            if tape[ptr] != 0:
                ip = brackets[ip]
        ip += 1
    return outputs

def main():
    bf_code = generate_contador_bf()
    print(f"Contador Invertido BF: {len(bf_code)} bytes")

    depth = 0
    for i, ch in enumerate(bf_code):
        if ch == "[": depth += 1
        elif ch == "]": depth -= 1
        if depth < 0: print(f"ERROR at {i}"); return
    if depth != 0: print(f"ERROR: {depth} unmatched"); return
    print("✓ Brackets OK")

    hex_code = bf_code.encode().hex()

    # Test cases: n, moves
    cases = [
        (15, [1, 2, 1, 2, 1, 2]), # Vitórias
        (15, [1, 2, 2]),          # Derrota (Invalid div 2)
        (15, [1] * 14),           # Vitória (Só subtracao)
        (10, [2, 1, 2]),          # Derrota (Para no 2, nao 1)
        (10, [2, 1, 2, 2]),       # Vitória
    ]
    
    for n, moves in cases:
        inputs = [n] + moves + [0]
        py_res = simulate_contador(n, moves)
        bf_res_arr = run_bf_interpreter(bf_code, inputs)
        bf_res = bf_res_arr[0] if bf_res_arr else -1
        status = "PASS" if py_res == bf_res else "FAIL"
        print(f"Test N={n}, Moves={moves}: Py={py_res}, BF={bf_res} [{status}]")

    with open("contador.bf", "w") as f: f.write(bf_code)
    with open("contador_hex.txt", "w") as f: f.write(hex_code)
    print(f"\\nFiles written. Hex: {len(hex_code)//2} bytes")

if __name__ == "__main__":
    main()
