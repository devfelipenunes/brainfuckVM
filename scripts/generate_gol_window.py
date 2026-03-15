#!/usr/bin/env python3
import os

def generate_window_bf(n_cells):
    code = []
    def emit(s): code.append(s)

    # Memory Layout:
    # 0: Outer Counter (N1)
    # 1: Inner Counter (N2)
    # 2: A (left cell)
    # 3: B (center cell)
    # 4: C (right cell)
    # 5: Sum / result
    # 6: Temp1
    # 7: Temp2
    
    n1 = 10
    n2 = n_cells // 10
    
    # Prime the pump: read first byte into B (cell 3)
    emit(">>> , <<<")
    
    # Outer loop on 0
    emit("+" * n1 + "[")
    
    # Inner loop initialization: 1
    emit("> " + "+" * n2 + " [")
    
    # --- Inner Loop Body (at 1) ---
    # 1. Read input into C (4)
    emit(">>> , <<<") # 1 -> 4, back to 1
    
    # 2. Add A, B, C into 5 (Sum). Keep originals.
    # Add A(2) to 5,6. Move 6 to 2.
    emit("> [- >>>+ >+ <<<<] >>>> [- <<<<+ >>>>] <<<<<") # back to 1
    # Add B(3) to 5,6. Move 6 to 3.
    emit(">> [- >>+ >+ <<<] >>> [- <<<+ >>>] <<<<<") # back to 1
    # Add C(4) to 5,6. Move 6 to 4.
    emit(">>> [- >+ >+ <<] >> [- <<+ >>] <<<<<") # back to 1
    
    # 3. Robust Mod 2 (sum is in cell 5)
    # Logic: 5 [- 6+ 5] 6 [- 5+ 6 [ - 5- 6] ]
    # Anchor is 1. Move to 5.
    emit(">>>> [- >+ <] > [ - <+ > [ - <- > ] ] <<<<<") # back to 1
    
    # 4. Output cell 5
    emit(">>>> . <<<<")
    
    # 5. Shift window: A = B, B = C
    emit("> [-] <") # Clear A(2)
    emit(">> [- <+ >] <<") # B(3) to A(2), back to 1
    emit(">>> [- <+ >] <<<") # C(4) to B(3), back to 1
    
    # 6. Clear result (5)
    emit(">>>> [-] <<<<")
    
    # End inner loop
    emit("- ]") # back to 1
    
    # End outer loop
    emit("< - ]") # back to 0
    
    return "".join(code).replace(" ", "")

def run_bf(code, inputs, max_steps=1000000):
    tape = [0] * 30000
    ptr = 0
    pc = 0
    in_idx = 0
    out = []
    jmps = {}
    stack = []
    for i, c in enumerate(code):
        if c == '[': stack.append(i)
        elif c == ']':
            if not stack: raise Exception(f"Unmatched bracket at {i}")
            start = stack.pop()
            jmps[start] = i
            jmps[i] = start
    steps = 0
    while pc < len(code) and steps < max_steps:
        steps += 1
        c = code[pc]
        if c == '>': ptr += 1
        elif c == '<': ptr -= 1
        elif c == '+': tape[ptr] = (tape[ptr] + 1) & 255
        elif c == '-': tape[ptr] = (tape[ptr] - 1) & 255
        elif c == '.': out.append(tape[ptr])
        elif c == ',':
            if in_idx < len(inputs):
                tape[ptr] = inputs[in_idx]
                in_idx += 1
            else:
                tape[ptr] = 0
        elif c == '[':
            if tape[ptr] == 0: pc = jmps[pc]
        elif c == ']':
            if tape[ptr] != 0: pc = jmps[pc]
        pc += 1
        if ptr < 0 or ptr >= 30000:
            raise Exception(f"Pointer out of bounds: {ptr} at PC {pc-1}")
    return out

if __name__ == "__main__":
    n = 16
    bf = generate_window_bf(n)
    in_data = [0]*16
    in_data[7] = 1 # single cell alive
    try:
        out = run_bf(bf, in_data)
        print("Input:  ", "".join(str(x) for x in in_data))
        print("Output: ", "".join(str(x) for x in out))
    except Exception as e:
        print(f"BF Execution Error: {e}")
        # print first few instructions
        print("Code starting:", bf[:50])
    
    # 1000 cells
    bf_1000 = generate_window_bf(1000)
    os.makedirs("scripts", exist_ok=True)
    with open("scripts/gameoflife_1000.bf", "w") as f:
        f.write(bf_1000)
    with open("scripts/gameoflife_1000_hex.txt", "w") as f:
        f.write(bf_1000.encode().hex())
    print("Files written successfully.")
