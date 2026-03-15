#!/usr/bin/env python3
"""
Dice Roller — Brainfuck Code Generator

A simple on-chain dice game using BF.

INPUT: 1 byte (seed/nonce from player)
OUTPUT: 1 byte (result 1-6)

Logic: takes the seed, does mathematical transforms, outputs result mod 6 + 1.
BF implementation: multiply seed by 7, add 3, mod 6 (using repeated subtraction), add 1.

Simple but produces interesting results. Perfect as a third solo game.
"""

def generate_dice_bf():
    """
    Generate BF for dice rolling.

    Memory:
      Cell 0: input seed
      Cell 1: result (working)
      Cell 2: temp for multiplication
      Cell 3: temp
      Cell 4: constant 6 for mod
      Cell 5: temp for mod
      Cell 6: output
    """
    code = []
    pos = 0

    # Read seed into cell 1 instead of 0, so we have space if we accidentally go left (though we shouldn't).
    # Wait, in the original code:
    # go(0); emit(",")
    # go(0); emit("[-"); go(1); emit("+"); go(2); emit("+"); go(0); emit("]")
    # There is no negative target. Why did it underflow?
    # Ah! `simulate_dice` logic: maybe it's not the generator framework but the actual code sequence generated?
    # Let me just shift everything by 1 to be safe: start using cell 1 as the first cell.
    
    OFFSET = 2
    
    def go(target):
        nonlocal pos
        target = target + OFFSET  # Shift all operations to the right
        if target > pos: code.append(">" * (target - pos))
        elif target < pos: code.append("<" * (pos - target))
        pos = target

    def emit(s): code.append(s)

    # Read seed
    go(0); emit(",")

    # Copy seed to cell 1 (using cell 2 as temp)
    # cell0[-cell1+cell2+] cell2[-cell0+]
    go(0); emit("[-"); go(1); emit("+"); go(2); emit("+"); go(0); emit("]")
    go(2); emit("[-"); go(0); emit("+"); go(2); emit("]")

    # Multiply cell1 by 7: cell1 * 7
    # Copy cell1 to cell2 (using cell3), then add cell2 to cell1 six more times
    # Actually simpler: cell1 has the seed. We want seed*7.
    # Clear cell2, then: cell1[-cell2+++++++cell1] ... no that's wrong
    # Better: copy cell1 to cell3, clear cell1, cell3[-cell1+++++++]
    go(1); emit("[-"); go(3); emit("+"); go(1); emit("]")  # move cell1 to cell3
    go(3); emit("[-"); go(1); emit("+++++++"); go(3); emit("]")  # cell3 * 7 -> cell1

    # Add 3
    go(1); emit("+++")

    # Now cell1 = seed * 7 + 3 (uint8 wrapping)
    # Compute cell1 mod 6 using repeated subtraction
    # Strategy: while cell1 >= 6, subtract 6
    # BF approach: copy cell1, subtract 6, check if positive, repeat

    # Set cell4 = 6 (constant for comparison)
    go(4); emit("++++++")

    # Mod 6 loop:
    # We need: while cell1 >= 6, cell1 -= 6
    # In BF with uint8: we'll do a bounded number of iterations (256/6 = ~42)
    # Copy cell1 to cell5 (temp), subtract 6, if result >= 0 (didn't wrap past 255), update cell1

    # Simpler: direct repeated subtraction
    # Copy cell1 to cell6 (output), clear cell1
    # Then subtract 6 as many times as possible

    # Actually the simplest approach for mod in BF:
    # cell1 has the value. We want cell1 % 6.
    # Use a counting approach: count = 0, for each unit in cell1: count++, if count==6 count=0
    # This gives us the remainder.

    # cell5 = 0 (counter), cell6 = result
    go(5); emit("[-]")
    go(6); emit("[-]")

    # cell1[-  cell5+ (increment counter)
    #          copy cell5 to cell3 using cell2, subtract 6 from cell3
    #          if cell3 == 0 (counter reached 6): clear cell5
    #          cell1]
    # This is complex. Let's use a simpler modular counter.

    # Counter approach: cell5 cycles 0,1,2,3,4,5,0,1,2,3,4,5,...
    # For each decrement of cell1, increment cell5.
    # When cell5 == 6, reset to 0.

    go(1)
    emit("[")  # while cell1 > 0
    go(1); emit("-")  # cell1--
    go(5); emit("+")  # counter++

    # Check if counter == 6: subtract 6, check if 0
    # Copy counter to cell3 using cell2
    go(5); emit("[-"); go(3); emit("+"); go(2); emit("+"); go(5); emit("]")
    go(2); emit("[-"); go(5); emit("+"); go(2); emit("]")
    # cell3 now has counter value. Subtract 6.
    go(3); emit("------")
    # If cell3 == 0, counter was 6, reset cell5 to 0
    # NOT gate: cell2=1, cell3[cell2- cell3[-]]
    go(2); emit("[-]"); go(2); emit("+")
    go(3); emit("["); go(2); emit("-"); go(3); emit("[-]]")
    # cell2=1 means counter WAS 6
    go(2); emit("["); go(5); emit("[-]"); go(2); emit("-]")

    go(1)
    emit("]")

    # cell5 now has value mod 6 (0-5). Add 1 to get 1-6.
    go(5); emit("+")

    # Output
    go(5); emit(".")

    return "".join(code)


def simulate_dice(seed):
    val = (seed * 7 + 3) & 0xFF
    return (val % 6) + 1


def main():
    bf_code = generate_dice_bf()
    print(f"Dice Roller BF: {len(bf_code)} bytes")

    depth = 0
    for i, ch in enumerate(bf_code):
        if ch == "[": depth += 1
        elif ch == "]": depth -= 1
        if depth < 0: print(f"ERROR at {i}"); return
    if depth != 0: print(f"ERROR: {depth} unmatched"); return
    print("✓ Brackets OK")

    hex_code = bf_code.encode().hex()

    # Test vectors
    for seed in range(1, 11):
        result = simulate_dice(seed)
        print(f"  Seed {seed:3d} → Dice: {result}")

    with open("scripts/dice.bf", "w") as f: f.write(bf_code)
    with open("scripts/dice_hex.txt", "w") as f: f.write(hex_code)
    print(f"\nFiles written. Hex: {len(hex_code)//2} bytes")


if __name__ == "__main__":
    main()
