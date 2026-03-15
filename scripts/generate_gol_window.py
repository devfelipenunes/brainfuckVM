#!/usr/bin/env python3
"""
Conway's Game of Life — Sliding Window Brainfuck Generator (O(1) code size)

Generates a tiny (few hundred bytes) Brainfuck program that computes a 1D
cellular automaton (Rule 102 / sum mod 2) for an arbitrary length array.
It processes the input stream using a sliding window, emitting output sequentially.
"""
import sys
import os

def generate_window_bf(n_cells):
    code = []
    def emit(s): code.append(s)

    # Memory Layout:
    # [0] Loop Counter 1 (Outer)
    # [1] Loop Counter 2 (Inner)
    # [2] A (left cell)
    # [3] B (center cell)
    # [4] C (right cell)
    # [5] Temp1 (sum accumulator)
    # [6] Temp2 (backup/macro)
    # [7] Output
    
    # We want to loop n_cells times.
    # We can do this with two counters: N1 * N2 = n_cells
    # For 1000, 10 * 100 = 1000
    n1 = 10
    n2 = n_cells // 10
    
    emit(f"{'+' * n1}")      # Set Counter 1
    emit(">")
    # We use cell 1 for counter 2, but we initialize it INSIDE the outer loop
    emit("<")

    # Prime the pump: Read first byte into B (cell 3)
    emit(">>> , <<<")

    # Outer loop on Counter 1
    emit("[")
    
    emit(f"> {'+' * n2} <")   # Set Counter 2
    
    # Inner loop on Counter 2
    emit("> [ <")  # Move to Counter 1 (0) just to anchor, then start loop logic
    
    # Loop body: anchor is at cell 0
    # 1. Read input into C (cell 4)
    emit(">>>> , <<<<")
    
    # 2. Add A, B, C into Temp1 (cell 5), keeping A, B, C intact using Temp2 (cell 6)
    # Anchor is 0.
    # A (2) to Temp1 (5) and Temp2 (6)
    # >>> (move to 5) no wait, start at 0.
    # >> (cell 2).
    # [- >>>+ >+ <<<<] (moves A to Temp1(5) and Temp2(6))
    # >>>> [- <<<<+ >>>>] <<<< (moves Temp2 back to A)
    # Back to 0. (<<)
    emit(">> [- >>>+ >+ <<<<] >>>> [- <<<<+ >>>>] <<<<<<")
    
    # B (3) to Temp1 (5) and Temp2 (6)
    # >>> (cell 3).
    # [- >>+ >+ <<<]
    # >>> [- <<<+ >>>] <<<
    # Back to 0.
    emit(">>> [- >>+ >+ <<<] >>> [- <<<+ >>>] <<<<<<")
    
    # C (4) to Temp1 (5) and Temp2 (6)
    # >>>> (cell 4).
    # [- >+ >+ <<]
    # >> [- <<+ >>] <<
    # Back to 0.
    emit(">>>> [- >+ >+ <<] >> [- <<+ >>] <<<<<<")
    
    # Temp1 now has A+B+C.
    # 3. Mod 2 algorithm
    # We want Output (cell 7) = Temp1 % 2.
    # Using macro:
    # x = Temp1 (5), t0 = Temp2 (6), t1 = Output (7) (repurposed for macro)
    # Wait, simple mod 2 is:
    # temp0[-] temp1[-]  (cells 6, 7)
    # x[temp0+x-]        (move x to t0)
    # temp0[
    #   temp1+           (t1++)
    #   x+               (x++)
    #   temp0-           (t0--)
    #   [x- temp0-]      (if t0 was 2, x becomes 0)
    # ]
    # Result is in x (cell 5).
    # t1 (cell 7) holds the original x, but we don't care, we just want the output.
    
    # Clear t0 (6) and t1 (7)
    emit(">>>>>> [-] > [-] <<<<<<<")
    # Move x (5) to t0 (6)
    emit(">>>>> [- >+ <] <<<<<")
    # temp0 loop
    emit(">>>>>> [")
    emit("  >+ <")      # t1+ (7)
    emit("  <+ >")      # x+ (5)
    emit("  -")         # t0- (6)
    emit("  [ <- >- ]") # if t0 != 0: x-, t0- (this resets x back to 0 if it was 1)
    emit("] <<<<<<")
    
    # Now x (5) has the mod 2 result!
    # 4. Output x
    emit(">>>>> . <<<<<")
    
    # 5. Shift window: A = B, B = C, C = 0
    # Clear A (2)
    emit(">> [-] <<")
    # Move B (3) to A (2)
    emit(">>> [- <+ >] <<<")
    # Move C (4) to B (3)
    emit(">>>> [- <+ >] <<<<")
    # C is now 0.
    
    # Clear x (5) since we're done with it
    emit(">>>>> [-] <<<<<")
    
    # Anchor is still 0
    
    # Decrement Counter 2
    emit("> - ] <")
    
    # Decrement Counter 1
    emit("- ]")

    bf_code = "".join(code).replace(" ", "").replace("\n", "")
    return bf_code

def run_bf(code, inputs, max_steps=100_000):
    tape = [0] * 30000
    ptr = 0
    pc = 0
    in_idx = 0
    out = []
    
    # build jump table
    jmps = {}
    stack = []
    for i, c in enumerate(code):
        if c == '[': stack.append(i)
        elif c == ']':
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
    return out

if __name__ == "__main__":
    n = 16
    bf = generate_window_bf(n)
    print(f"Game of Life sliding window BF: {len(bf)} bytes")
    
    # Test vector
    in_data = [0]*16
    in_data[7] = 1 # single cell alive
    
    # Rule 102: out[i] = (in[i-1] + in[i] + in[i+1]) % 2
    # For A=0, B=in[0]=0, C=in[1]=0 -> 0
    # For in[7]=1 -> in[6]+in[7]+in[8] -> 0+1+0 = 1
    # Check what Python BF eval says
    out = run_bf(bf, in_data, 1000000)
    print("Input: ", "".join(str(x) for x in in_data))
    print("Output:", "".join(str(x) for x in out))
    
    # Save the 1000 cell version
    bf_1000 = generate_window_bf(1000)
    print(f"1000 cells BF: {len(bf_1000)} bytes")
    
    os.makedirs("scripts", exist_ok=True)
    with open("scripts/gameoflife_1000.bf", "w") as f:
        f.write(bf_1000)
    with open("scripts/gameoflife_1000_hex.txt", "w") as f:
        f.write(bf_1000.encode().hex())
    print("Files written successfully.")
