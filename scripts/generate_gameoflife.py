#!/usr/bin/env python3
"""
32-Cell Rule 102 — Brainfuck Code Generator (Phase 5 Compact)
"""

def main():
    N = 32
    # Tape: [C0 ... C31] [T0 ... T31]
    code = ""
    # Read N bytes
    for _ in range(N): code += ",>"
    code += "<" * N # back to C0
    
    for i in range(N):
        target = N + i
        # Ti = Ci
        code += "[ " + ">" * N + " + " + "<" * N + " - ] "
        # XOR Ci+1 if exists
        if i < N - 1:
            code += " > [ " # If Ci+1 exists
            code += " < " + ">" * N # go to Ti
            code += " [ [ - ] > + < ] > [ < + > - ] < " # XOR bit flip
            code += " < " + ">" * 0 # back to Ci+1
            # Copy Ci+1 back
            code += " [ - > + < ] > [ - < + > ] < "
            code += " ] "
        code += " > " # next Ci
    
    # Output results
    code += ">" * (N - 1)
    for _ in range(N): code += "." + ">"
    
    print(f"32-cell GoL length: {len(code)}")
    with open("scripts/gameoflife_64_hex.txt", "w") as f:
        f.write(code.replace(" ", "").encode().hex())

if __name__ == "__main__":
    main()
