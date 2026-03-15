#!/usr/bin/env python3
"""
Pedra, Papel e Tesoura — Brainfuck Code Generator
"""

def generate_jokenpo_bf():
    code = []
    pos = 0

    def go(target):
        nonlocal pos
        if target > pos: code.append(">" * (target - pos))
        elif target < pos: code.append("<" * (pos - target))
        pos = target

    def emit(s): code.append(s)

    # Input 0: Player Move
    go(0); emit(",")
    
    # Input 1: Seed
    go(1); emit(",")

    # Modulo 3 on Seed
    # Calculate Opponent Move (Seed % 3) into Cell 2
    go(2); emit("[-]")
    go(1); emit("[")
    go(1); emit("-")
    go(2); emit("+")
    
    # Check if Cell 2 == 3
    go(2); emit("[-"); go(3); emit("+"); go(4); emit("+"); go(2); emit("]")
    go(4); emit("[-"); go(2); emit("+"); go(4); emit("]")
    
    go(3); emit("---")
    go(5); emit("[-]+"); go(3); emit("["); go(5); emit("[-]"); go(3); emit("[-]]")
    
    # If Cell 2 == 3
    go(5); emit("[")
    go(2); emit("[-]")
    go(5); emit("[-]")
    emit("]")
    
    go(1); emit("]")
    
    # Now Cell 2 has Opponent move (0, 1, or 2)
    # Target Equation: Result = (Player - Opponent + 3) % 3
    
    # Player is in Cell 0. Opponent in Cell 2.
    # Add 3 to Player
    go(0); emit("+++")
    
    # Subtract Opponent from Player
    go(2); emit("[-"); go(0); emit("-"); go(2); emit("]")
    
    # Now Cell 0 has Player - Opponent + 3
    # We must calculate Cell 0 % 3 and put the output exactly in a cell (say, 0) and print it.
    # To do that, we move Cell 0 to Cell 1, and calculate mod 3 into Cell 0.
    
    go(0); emit("[-"); go(1); emit("+"); go(0); emit("]")
    
    # Cell 1 has the value. Modulo 3 into Cell 0.
    go(0); emit("[-]")
    go(1); emit("[")
    go(1); emit("-")
    go(0); emit("+")
    
    # Check if Cell 0 == 3
    go(0); emit("[-"); go(3); emit("+"); go(4); emit("+"); go(0); emit("]")
    go(4); emit("[-"); go(0); emit("+"); go(4); emit("]")
    
    go(3); emit("---")
    go(5); emit("[-]+"); go(3); emit("["); go(5); emit("[-]"); go(3); emit("[-]]")
    
    go(5); emit("[")
    go(0); emit("[-]")
    go(5); emit("[-]")
    emit("]")
    
    go(1); emit("]")
    
    # Now Cell 0 has the final result. Print it.
    go(0); emit(".")
    
    return "".join(code)

def simulate_jokenpo(player, seed):
    opponent = seed % 3
    return (player - opponent + 3) % 3

def run_bf_interpreter(code, inputs):
    tape = [0] * 30000
    ptr = 0
    ip = 0
    input_idx = 0
    outputs = []
    
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
    bf_code = generate_jokenpo_bf()
    print(f"Jokenpo BF: {len(bf_code)} bytes")

    depth = 0
    for i, ch in enumerate(bf_code):
        if ch == "[": depth += 1
        elif ch == "]": depth -= 1
        if depth < 0: print(f"ERROR at {i}"); return
    if depth != 0: print(f"ERROR: {depth} unmatched"); return
    print("✓ Brackets OK")

    hex_code = bf_code.encode().hex()

    # Test cases: player (0, 1, 2) vs seeds from 0 to 10
    all_passed = True
    for player in range(3):
        for seed in range(11):
            py_res = simulate_jokenpo(player, seed)
            bf_res_arr = run_bf_interpreter(bf_code, [player, seed])
            bf_res = bf_res_arr[0] if bf_res_arr else -1
            status = "PASS" if py_res == bf_res else "FAIL"
            if status == "FAIL": all_passed = False
            print(f"Test P={player}, Seed={seed}: Py={py_res}, BF={bf_res} [{status}]")

    if all_passed:
        print("\\nAll tests passed successfully!")
    else:
        print("\\nSome tests failed!")

    with open("jokenpo.bf", "w") as f: f.write(bf_code)
    with open("jokenpo_hex.txt", "w") as f: f.write(hex_code)
    print(f"Files written. Hex: {len(hex_code)//2} bytes")

if __name__ == "__main__":
    main()
