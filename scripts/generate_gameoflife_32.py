#!/usr/bin/env python3
"""
Conway's Game of Life (1D) — Brainfuck Code Generator (32-Cell Ultra Lean)
"""

def generate_simple_gol_32():
    N = 32
    code = ">" # Start at 1 to have 0 at 0 as bound
    for _ in range(N):
        code += ",>"
    
    i = N + 1
    def move(target):
        nonlocal i
        dist = target - i
        res = (">" * dist) if dist > 0 else ("<" * abs(dist))
        i = target
        return res

    for cell_idx in range(1, N + 1):
        # Temp 150 (Sum), 151 (Copy), 152 (Result), 153 (Parity Temp)
        code += move(150) + "[-]" + move(151) + "[-]"
        
        for offset in [-1, 0, 1]:
            src = cell_idx + offset
            if src < 1 or src > N: continue 
            code += move(src) + "[-" + move(150) + "+" + move(151) + "+" + move(src) + "]"
            code += move(151) + "[-" + move(src) + "+" + move(151) + "]"
            
        code += move(152) + "[-]"
        code += move(150) + "[ - " + move(152) + "+" + move(153) + "[-" + move(152) + "-" + move(153) + "]" + move(150) + "]"
        
        idx = cell_idx - 1
        code += move(152) + "[-" + move(100 + idx) + "+" + move(152) + "]"
        
    code += move(100)
    for _ in range(N):
        code += ".>"
        
    return code

def main():
    bf_code = generate_simple_gol_32()
    print(f"Program length: {len(bf_code)} bytes")
    hex_code = bf_code.encode().hex()
    with open("scripts/gameoflife_32_hex.txt", "w") as f:
        f.write(hex_code)
    print(f"Hex saved to scripts/gameoflife_32_hex.txt")

if __name__ == "__main__":
    main()
