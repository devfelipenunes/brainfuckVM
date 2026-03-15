#!/usr/bin/env python3
"""
Tamagotchi Brainfuck Code Generator (v2 - fixed pointer tracking)

Generates a BF program that implements a Tamagotchi game.

INPUT FORMAT (5 bytes):
  [action, hunger, happiness, energy, age]
  action: 1=Feed, 2=Play, 3=Sleep, 4=Status

OUTPUT FORMAT (5 bytes):
  [hunger, happiness, energy, age, alive]
  alive: 1=alive, 0=dead

GAME RULES (using uint8 wrapping arithmetic):
  Feed:   hunger -= 30, happiness += 5, age += 1
  Play:   happiness += 20, energy -= 15, hunger += 10, age += 1
  Sleep:  energy += 30, happiness -= 5, age += 1
  Status: no changes, just output current state

  Death: happiness == 0 OR energy == 0

MEMORY LAYOUT:
  Cell 0:  action (consumed during dispatch)
  Cell 1:  hunger
  Cell 2:  happiness
  Cell 3:  energy
  Cell 4:  age
  Cell 5:  alive flag
  Cell 6+: temporaries (flag, copy temps)
"""

import json


def generate_tamagotchi_bf():
    """
    Generate the Tamagotchi BF program using a clean dispatch approach.

    Strategy:
    - Read 5 inputs into cells 0-4
    - Set alive=1 in cell 5
    - For action dispatch, use a careful "decrement cell 0 and check if zero" pattern
    - Each action block applies effects to cells 1-4
    - After all actions, check death conditions
    - Output cells 1-5
    """

    # We'll track pointer position manually to avoid bugs
    code = []
    pos = 0  # current pointer position

    def go(target):
        """Move pointer to target cell"""
        nonlocal pos
        if target > pos:
            code.append(">" * (target - pos))
        elif target < pos:
            code.append("<" * (pos - target))
        pos = target

    def emit(s):
        code.append(s)

    # ────────────────────────────────────────
    # READ INPUTS
    # ────────────────────────────────────────
    # Cell 0: action, Cell 1: hunger, Cell 2: happiness, Cell 3: energy, Cell 4: age
    emit(",")       # cell 0 = action
    go(1); emit(",")  # cell 1 = hunger
    go(2); emit(",")  # cell 2 = happiness
    go(3); emit(",")  # cell 3 = energy
    go(4); emit(",")  # cell 4 = age

    # Set alive = 1 (cell 5)
    go(5); emit("+")

    # ────────────────────────────────────────
    # ACTION DISPATCH
    # ────────────────────────────────────────
    # We use cell 0 as action counter.
    # Decrement and check zero for each action.
    # Cell 6 = NOT(cell0) flag (1 if cell0 was 0)
    # Cell 7 = temp for copy

    # === ACTION 1: FEED ===
    go(0)
    emit("-")  # action -= 1. If action was 1, cell0 = 0 now

    # We need: if cell0 == 0, execute feed
    # Pattern: set cell6=1, then cell0[cell6- cell0[-]], if cell6 still 1 → was zero
    go(6); emit("[-]")  # clear cell 6
    go(6); emit("+")    # cell 6 = 1 (assume action was 1)
    go(0)
    emit("[")          # if cell0 != 0
    go(6); emit("-")   # cell6 = 0 (action was NOT 1)
    go(0); emit("[-]") # clear cell0 (but preserve value... we need to save it)
    emit("]")
    pos = 0

    # Problem: we destroyed cell0. We need to preserve the remaining count.
    # Better approach: copy cell0 to cell7, check cell7, then restore.

    # Let me restart with a cleaner approach using a nondestructive check.

    code.clear()
    pos = 0

    # ────────────────────────────────────────
    # READ INPUTS
    # ────────────────────────────────────────
    emit(",")            # cell 0 = action
    go(1); emit(",")     # cell 1 = hunger
    go(2); emit(",")     # cell 2 = happiness
    go(3); emit(",")     # cell 3 = energy
    go(4); emit(",")     # cell 4 = age

    # Set alive = 1 (cell 5)
    go(5); emit("+")

    # ────────────────────────────────────────
    # APPROACH: Destructive dispatch on cell 0
    # After each check, cell 0 is decremented.
    # We use cell 6 as a "flag" and cell 7 as temp.
    #
    # For "if cell==0": cell6=1, cell[cell6- cell[-]], check cell6
    # But this destroys cell. Since we're decrementing through actions
    # sequentially, we WANT to consume cell 0.
    #
    # Key insight: after each action check, we only care about the
    # remaining value. So destructive is fine.
    # But the problem is: after action 1 fires, we still run through
    # action 2,3 checks. The action counter is 0, so action 2 check:
    # -1 from 0 = 255 (wrapping), which is nonzero, so action 2 won't fire.
    # This is correct! The wrapping actually helps us.
    #
    # But we need to handle the case where after feed executes,
    # subsequent checks see cell0=255 (wrapping from 0-1) and skip.
    # That's fine because 255 != 0.
    #
    # The REAL issue in v1 was the back-to-cell-0 navigation.
    # Let me be very careful about pointer tracking.
    # ────────────────────────────────────────

    # === ACTION 1: FEED (action=1 → after -1, cell0=0) ===
    go(0); emit("-")  # cell0 -= 1

    # Copy cell0 to cell7, using cell8 as temp
    # cell0[-cell7+cell8+] cell8[-cell0+]
    go(0); emit("[-"); go(7); emit("+"); go(8); emit("+"); go(0); emit("]")
    go(8); emit("[-"); go(0); emit("+"); go(8); emit("]")
    pos = 8

    # NOT gate: cell6=1, cell7[cell6- cell7[-]]
    go(6); emit("+")       # cell6 = 1
    go(7); emit("["); go(6); emit("-"); go(7); emit("[-]]")
    pos = 7

    # Now cell6 = 1 if action was FEED
    go(6)
    emit("[")  # IF FEED
    # hunger (cell1) -= 30
    go(1); emit("-" * 30)
    # happiness (cell2) += 5
    go(2); emit("+" * 5)
    # age (cell4) += 1
    go(4); emit("+")
    # clear flag
    go(6); emit("-")
    emit("]")
    pos = 6

    # Clear temps
    go(6); emit("[-]")
    go(7); emit("[-]")
    go(8); emit("[-]")

    # === ACTION 2: PLAY (action=2 → after -1-1, cell0=0) ===
    go(0); emit("-")  # cell0 -= 1 again

    # Copy cell0 to cell7
    go(0); emit("[-"); go(7); emit("+"); go(8); emit("+"); go(0); emit("]")
    go(8); emit("[-"); go(0); emit("+"); go(8); emit("]")
    pos = 8

    # NOT gate
    go(6); emit("+")
    go(7); emit("["); go(6); emit("-"); go(7); emit("[-]]")
    pos = 7

    go(6)
    emit("[")  # IF PLAY
    # happiness (cell2) += 20
    go(2); emit("+" * 20)
    # energy (cell3) -= 15
    go(3); emit("-" * 15)
    # hunger (cell1) += 10
    go(1); emit("+" * 10)
    # age (cell4) += 1
    go(4); emit("+")
    # clear flag
    go(6); emit("-")
    emit("]")
    pos = 6

    go(6); emit("[-]")
    go(7); emit("[-]")
    go(8); emit("[-]")

    # === ACTION 3: SLEEP (action=3 → after -1-1-1, cell0=0) ===
    go(0); emit("-")

    go(0); emit("[-"); go(7); emit("+"); go(8); emit("+"); go(0); emit("]")
    go(8); emit("[-"); go(0); emit("+"); go(8); emit("]")
    pos = 8

    go(6); emit("+")
    go(7); emit("["); go(6); emit("-"); go(7); emit("[-]]")
    pos = 7

    go(6)
    emit("[")  # IF SLEEP
    # energy (cell3) += 30
    go(3); emit("+" * 30)
    # happiness (cell2) -= 5
    go(2); emit("-" * 5)
    # age (cell4) += 1
    go(4); emit("+")
    go(6); emit("-")
    emit("]")
    pos = 6

    go(6); emit("[-]")
    go(7); emit("[-]")
    go(8); emit("[-]")

    # ACTION 4 (Status): No changes needed, we just output below.

    # ────────────────────────────────────────
    # DEATH CHECK
    # ────────────────────────────────────────
    # Check happiness (cell 2) == 0 → set alive (cell 5) = 0
    # Copy cell2 to cell7 using cell8
    go(2); emit("[-"); go(7); emit("+"); go(8); emit("+"); go(2); emit("]")
    go(8); emit("[-"); go(2); emit("+"); go(8); emit("]")
    pos = 8

    # NOT: cell6=1, cell7[cell6- cell7[-]]
    go(6); emit("+")
    go(7); emit("["); go(6); emit("-"); go(7); emit("[-]]")
    pos = 7

    # cell6=1 means happiness IS 0 → kill
    # if cell6: cell5--, cell6=0
    go(6); emit("["); go(5); emit("-"); go(6); emit("-]")
    pos = 6

    go(6); emit("[-]")
    go(7); emit("[-]")
    go(8); emit("[-]")

    # Check energy (cell 3) == 0 → set alive (cell 5) = 0
    go(3); emit("[-"); go(7); emit("+"); go(8); emit("+"); go(3); emit("]")
    go(8); emit("[-"); go(3); emit("+"); go(8); emit("]")
    pos = 8

    go(6); emit("+")
    go(7); emit("["); go(6); emit("-"); go(7); emit("[-]]")
    pos = 7

    go(6); emit("["); go(5); emit("-"); go(6); emit("-]")
    pos = 6

    go(6); emit("[-]")
    go(7); emit("[-]")
    go(8); emit("[-]")

    # ────────────────────────────────────────
    # OUTPUT: hunger, happiness, energy, age, alive
    # ────────────────────────────────────────
    go(1); emit(".")  # hunger
    go(2); emit(".")  # happiness
    go(3); emit(".")  # energy
    go(4); emit(".")  # age
    go(5); emit(".")  # alive

    return "".join(code)


def simulate_tamagotchi(action, hunger, happiness, energy, age):
    """Simulate the Tamagotchi logic in Python (uint8 wrapping)."""
    # Use uint8 wrapping arithmetic to match BF behavior
    if action == 1:  # Feed
        hunger = (hunger - 30) & 0xFF
        happiness = (happiness + 5) & 0xFF
        age = (age + 1) & 0xFF
    elif action == 2:  # Play
        happiness = (happiness + 20) & 0xFF
        energy = (energy - 15) & 0xFF
        hunger = (hunger + 10) & 0xFF
        age = (age + 1) & 0xFF
    elif action == 3:  # Sleep
        energy = (energy + 30) & 0xFF
        happiness = (happiness - 5) & 0xFF
        age = (age + 1) & 0xFF
    # action 4: no changes

    alive = 1
    if happiness == 0:
        alive = 0
    if energy == 0:
        alive = 0

    return hunger, happiness, energy, age, alive


def main():
    bf_code = generate_tamagotchi_bf()

    print("=" * 60)
    print("TAMAGOTCHI BRAINFUCK CARTRIDGE (v2)")
    print("=" * 60)
    print(f"\nProgram length: {len(bf_code)} bytes")
    print(f"\nBF Code:\n{bf_code}")

    # Verify bracket matching
    depth = 0
    for i, ch in enumerate(bf_code):
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
        if depth < 0:
            print(f"\nERROR: Unmatched ] at position {i}")
            return
    if depth != 0:
        print(f"\nERROR: {depth} unmatched [ brackets")
        return
    print("\n✓ Brackets matched correctly")

    # Generate hex for Solidity
    hex_code = bf_code.encode().hex()
    print(f"\nSolidity hex ({len(hex_code)//2} bytes):\nhex\"{hex_code}\"")

    # Generate test vectors
    print("\n" + "=" * 60)
    print("TEST VECTORS")
    print("=" * 60)

    test_cases = [
        ("Feed (normal)", 1, 100, 50, 80, 10),
        ("Feed (low hunger, wraps)", 1, 20, 50, 80, 10),
        ("Play (normal)", 2, 50, 30, 100, 10),
        ("Play (low energy, wraps)", 2, 50, 30, 10, 10),
        ("Sleep (normal)", 3, 50, 80, 30, 10),
        ("Sleep (happiness=5 → dies)", 3, 50, 5, 30, 10),
        ("Status (alive)", 4, 50, 80, 60, 10),
        ("Status (dead, happiness=0)", 4, 50, 0, 60, 10),
        ("Status (dead, energy=0)", 4, 50, 80, 0, 10),
    ]

    for name, action, hunger, happiness, energy, age in test_cases:
        h, hp, e, a, alive = simulate_tamagotchi(
            action, hunger, happiness, energy, age
        )
        status = "ALIVE ✓" if alive else "DEAD ✗"
        print(f"\n  {name}:")
        print(f"    Input:    action={action} hunger={hunger} happy={happiness} energy={energy} age={age}")
        print(f"    Expected: hunger={h} happy={hp} energy={e} age={a} [{status}]")

    # Write outputs
    with open("scripts/tamagotchi.bf", "w") as f:
        f.write(bf_code)
    print(f"\n\nBF program written to scripts/tamagotchi.bf")

    sol_hex = hex_code
    with open("scripts/tamagotchi_hex.txt", "w") as f:
        f.write(sol_hex)
    print(f"Hex written to scripts/tamagotchi_hex.txt")


if __name__ == "__main__":
    main()
