#!/usr/bin/env python3
"""
Snake Minimalista — Brainfuck Code Generator

Generates a BF program for a minimal 5×5 Snake game, designed
to run on-chain via BrainfuckVM.sol.

INPUT FORMAT (repeating pairs until move==0):
  [move, seed, move, seed, ...]
  move: ASCII w(119)/a(97)/s(115)/d(100) or 0 = EOF
  seed: 0-255 (used to place food via seed%5 for X, seed/5%5 for Y)

OUTPUT FORMAT (2 bytes):
  [game_over_flag, score]
  game_over_flag: 0 = survived all moves, 1 = hit a wall
  score: number of foods collected

MEMORY LAYOUT:
  Cell 0:  Head X (0-4)
  Cell 1:  Head Y (0-4)
  Cell 2:  Food X (0-4)
  Cell 3:  Food Y (0-4)
  Cell 4:  Score
  Cell 5:  Game Over flag (0 = alive, nonzero = dead)
  Cell 6:  Current move input
  Cell 7:  Current seed input
  Cell 8+: Temporaries for arithmetic/comparisons

GAME RULES:
  - 5×5 grid. Head starts at (2,2). Food starts at (0,0).
  - Each turn: read move→update head position→check wall collision→
    check food collection→continue or end.
  - Wall collision: X or Y not in {0,1,2,3,4} → game over.
  - Food: if head == food, score++, reposition food from seed.
  - No tail tracking (simplified for BF feasibility).
"""

def generate_snake_bf():
    code = []
    pos = 0

    def go(target):
        nonlocal pos
        if target > pos:
            code.append(">" * (target - pos))
        elif target < pos:
            code.append("<" * (pos - target))
        pos = target

    def emit(s):
        code.append(s)

    def clear(cell):
        go(cell); emit("[-]")

    def copy(src, dst, tmp):
        """Copy src → dst (clears dst first), using tmp."""
        clear(dst); clear(tmp)
        go(src); emit("[-"); go(dst); emit("+"); go(tmp); emit("+"); go(src); emit("]")
        go(tmp); emit("[-"); go(src); emit("+"); go(tmp); emit("]")

    def not_gate(src, flag, tmp):
        """flag = 1 if src==0, else 0. Destroys src. Uses tmp for nothing extra."""
        clear(flag)
        go(flag); emit("+")  # flag = 1
        go(src); emit("["); go(flag); emit("-"); go(src); emit("[-]]")

    # ────────────────────────────────────────
    # INITIAL STATE
    # ────────────────────────────────────────
    # Head at (2, 2)
    go(0); emit("++")       # X = 2
    go(1); emit("++")       # Y = 2
    # Food at (0, 0) — cells 2,3 already 0
    # Score (cell 4) = 0
    # Game over (cell 5) = 0

    # ────────────────────────────────────────
    # READ FIRST MOVE
    # ────────────────────────────────────────
    go(6); emit(",")        # read move

    # ────────────────────────────────────────
    # MAIN GAME LOOP: while move != 0 AND game_over == 0
    # ────────────────────────────────────────
    # We loop on cell 6 (move). If move==0, loop ends.
    go(6)
    emit("[")  # while move != 0

    # Read seed into cell 7
    go(7); emit(",")

    # ─── DISPATCH MOVE ────────────────────
    # We need to check move against w(119), a(97), s(115), d(100).
    # Strategy: subtract known values from a copy of move, check if zero.
    # Use cells 9-14 as temps.
    #
    # For each direction, copy move(6) → temp, subtract ASCII value,
    # use NOT gate to get a flag, then conditionally adjust X or Y.

    # --- CHECK 'w' (119) → Y -= 1 ---
    copy(6, 9, 10)           # cell 9 = move
    go(9); emit("-" * 119)   # cell 9 = move - 119
    not_gate(9, 11, 12)      # cell 11 = 1 if move was 'w'
    go(11); emit("[")        # if 'w'
    go(1); emit("-")         # Y -= 1
    go(11); emit("[-]]")

    # --- CHECK 's' (115) → Y += 1 ---
    copy(6, 9, 10)
    go(9); emit("-" * 115)
    not_gate(9, 11, 12)
    go(11); emit("[")
    go(1); emit("+")         # Y += 1
    go(11); emit("[-]]")

    # --- CHECK 'a' (97) → X -= 1 ---
    copy(6, 9, 10)
    go(9); emit("-" * 97)
    not_gate(9, 11, 12)
    go(11); emit("[")
    go(0); emit("-")         # X -= 1
    go(11); emit("[-]]")

    # --- CHECK 'd' (100) → X += 1 ---
    copy(6, 9, 10)
    go(9); emit("-" * 100)
    not_gate(9, 11, 12)
    go(11); emit("[")
    go(0); emit("+")         # X += 1
    go(11); emit("[-]]")

    # ─── BOUNDARY CHECK ──────────────────
    # We need: if X not in {0,1,2,3,4} → game over.
    # With uint8 wrapping, invalid values are 5..255.
    # Method: set valid=0. Copy X → temp. For i in 0..4:
    #   if temp == i: valid = 1. (temp -= 1 each iteration, check if zero.)
    # After 5 checks, if valid still 0 → game over.
    #
    # Actually more elegantly: copy X → temp.
    # valid = 0.
    # Check temp==0 → valid=1. temp-- (wraps to 255 if was 0, but we already flagged).
    # Check temp==0 → valid=1, meaning original was 1. temp--.
    # ... repeat for values 0,1,2,3,4.
    # But destructive NOT consumes temp each time. Let's use a different approach:
    #
    # Copy X → temp(9). valid(11) = 0.
    # Iter 0: copy temp→ck(12) using 13. NOT(ck) → flag(14). if flag: valid=1.
    #         temp -= 1. (If X was 0, temp is now 255.)
    # Iter 1: copy temp→ck. NOT(ck)→flag. if flag: valid=1. temp-=1.
    # ... through iter 4.
    # After 5 iterations, if valid==0 → game_over=1.

    # --- CHECK X ---
    copy(0, 9, 10)          # cell 9 = X
    clear(11)               # valid = 0

    for _ in range(5):      # check 0, 1, 2, 3, 4
        copy(9, 12, 13)     # ck = temp copy
        not_gate(12, 14, 15) # flag = 1 if ck == 0
        # if flag: valid = 1
        go(14); emit("["); go(11); emit("[-]+"); go(14); emit("[-]]")
        go(9); emit("-")    # temp -= 1

    # if NOT valid → game over
    # not_gate on valid(11) → flag(14)
    copy(11, 12, 13)
    not_gate(12, 14, 15)    # 14 = 1 if valid was 0
    go(14); emit("["); go(5); emit("[-]+"); go(14); emit("[-]]")  # game_over = 1

    # --- CHECK Y ---
    copy(1, 9, 10)          # cell 9 = Y
    clear(11)               # valid = 0

    for _ in range(5):
        copy(9, 12, 13)
        not_gate(12, 14, 15)
        go(14); emit("["); go(11); emit("[-]+"); go(14); emit("[-]]")
        go(9); emit("-")

    copy(11, 12, 13)
    not_gate(12, 14, 15)
    go(14); emit("["); go(5); emit("[-]+"); go(14); emit("[-]]")

    # ─── IF GAME OVER, SKIP FOOD CHECK & BREAK LOOP ───
    # We'll check game_over(5). If set, clear move(6) to break loop.
    copy(5, 12, 13)
    go(12); emit("[")       # if game_over
    go(6); emit("[-]")     # clear move → loop will end
    go(12); emit("[-]]")

    # ─── FOOD COLLECTION CHECK ────────────
    # if head_x == food_x AND head_y == food_y: score++, reposition food.
    # Check X match: diff = |head_x - food_x|. If diff == 0 → x_match = 1.
    # We compute head_x - food_x in uint8.

    # x_diff = head_x - food_x (copy both, subtract)
    copy(0, 9, 10)           # cell 9 = head_x
    copy(2, 12, 13)          # cell 12 = food_x
    go(12); emit("[-"); go(9); emit("-"); go(12); emit("]")  # cell 9 = head_x - food_x
    not_gate(9, 11, 10)      # cell 11 = 1 if x matches

    # y_diff = head_y - food_y
    copy(1, 9, 10)           # cell 9 = head_y
    copy(3, 12, 13)          # cell 12 = food_y
    go(12); emit("[-"); go(9); emit("-"); go(12); emit("]")
    not_gate(9, 14, 10)      # cell 14 = 1 if y matches

    # AND: cell 15 = x_match(11) AND y_match(14)
    clear(15)
    go(11); emit("[")        # if x_match
    go(14); emit("[")        # if y_match
    go(15); emit("+")        # food_match = 1
    go(14); emit("[-]]")
    go(11); emit("[-]]")

    # if food_match(15):
    go(15); emit("[")
    # score++
    go(4); emit("+")
    # Reposition food: food_x = seed % 5, food_y = seed / 5 % 5
    # --- Compute seed(7) mod 5 → food_x(2) and seed(7)/5 → food_y(3) ---
    # We use divmod approach: quotient in cell 16, remainder (cycling 0-4) in cell 17.
    # Copy seed(7) → cell 9, then iterate: for each unit, increment counter(17),
    # if counter==5: counter=0, quotient(16)++.
    copy(7, 9, 10)
    clear(16)               # quotient
    clear(17)               # remainder counter

    go(9); emit("[")        # while seed_copy > 0
    go(9); emit("-")        # seed_copy--
    go(17); emit("+")       # counter++

    # Check if counter == 5
    copy(17, 12, 13)
    go(12); emit("-" * 5)   # subtract 5
    not_gate(12, 14, 13)    # 14 = 1 if counter was 5
    go(14); emit("[")       # if counter == 5
    clear(17)               # reset counter
    go(16); emit("+")       # quotient++
    go(14); emit("[-]]")

    go(9); emit("]")        # end while

    # food_x = remainder(17)
    clear(2)
    go(17); emit("[-"); go(2); emit("+"); go(17); emit("]")

    # food_y = quotient(16) mod 5
    # Same cycling counter approach
    copy(16, 9, 10)
    clear(18)               # q2
    clear(19)               # r2

    go(9); emit("[")
    go(9); emit("-")
    go(19); emit("+")

    copy(19, 12, 13)
    go(12); emit("-" * 5)
    not_gate(12, 14, 13)
    go(14); emit("[")
    clear(19)
    go(18); emit("+")
    go(14); emit("[-]]")

    go(9); emit("]")

    clear(3)
    go(19); emit("[-"); go(3); emit("+"); go(19); emit("]")

    go(15); emit("[-]]")    # end if food_match

    # ─── READ NEXT MOVE ──────────────────
    # Only read if game is still alive (cell 6 wasn't cleared by game over).
    # Since we already cleared cell 6 on game over above, we need to read
    # only if alive. But the loop condition checks cell 6 anyway.
    # If game_over cleared cell 6, loop will exit after this iteration.
    # We need to read next move only if alive.
    # Check game_over(5): if 0, read. If non-zero, skip read (cell 6 already 0).
    copy(5, 12, 13)
    not_gate(12, 14, 13)    # 14 = 1 if game_over is 0 (alive)
    go(14); emit("[")       # if alive
    go(6); emit(",")        # read next move
    go(14); emit("[-]]")

    go(6)
    emit("]")  # end main loop

    # ────────────────────────────────────────
    # OUTPUT
    # ────────────────────────────────────────
    go(5); emit(".")         # game_over flag
    go(4); emit(".")         # score

    return "".join(code)


def simulate_snake(moves, seeds):
    """
    Simulate the Snake game in Python for validation.
    moves: list of ASCII values (119,97,115,100) or 0 for EOF
    seeds: list of seed bytes (same length as moves)
    Returns (game_over, score).
    """
    hx, hy = 2, 2       # head
    fx, fy = 0, 0        # food
    score = 0
    game_over = 0

    for i, move in enumerate(moves):
        if move == 0:
            break

        # Apply move
        if move == 119:    # w
            hy = (hy - 1) & 0xFF
        elif move == 115:  # s
            hy = (hy + 1) & 0xFF
        elif move == 97:   # a
            hx = (hx - 1) & 0xFF
        elif move == 100:  # d
            hx = (hx + 1) & 0xFF

        # Boundary check
        if hx > 4:  # includes wrapped values like 255
            game_over = 1
            break
        if hy > 4:
            game_over = 1
            break

        # Food check
        if hx == fx and hy == fy:
            score += 1
            seed = seeds[i] if i < len(seeds) else 0
            fx = seed % 5
            fy = (seed // 5) % 5

    return game_over, score


def run_bf_interpreter(code, inputs):
    """Standard BF interpreter for test validation."""
    tape = [0] * 30000
    ptr = 0
    ip = 0
    input_idx = 0
    outputs = []

    # Build jump table
    brackets = {}
    stack = []
    for i, c in enumerate(code):
        if c == '[':
            stack.append(i)
        elif c == ']':
            start = stack.pop()
            brackets[start] = i
            brackets[i] = start

    max_steps = 50_000_000  # safety limit
    steps = 0

    while ip < len(code):
        c = code[ip]
        if c == '>':
            ptr += 1
        elif c == '<':
            ptr -= 1
            if ptr < 0:
                raise RuntimeError(f"Pointer underflow at ip={ip}, step={steps}")
        elif c == '+':
            tape[ptr] = (tape[ptr] + 1) % 256
        elif c == '-':
            tape[ptr] = (tape[ptr] - 1) % 256
        elif c == '.':
            outputs.append(tape[ptr])
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
        steps += 1
        if steps > max_steps:
            raise RuntimeError(f"Max steps exceeded ({max_steps})")

    return outputs


def main():
    bf_code = generate_snake_bf()
    print("=" * 60)
    print("SNAKE MINIMALISTA — BRAINFUCK CARTRIDGE")
    print("=" * 60)
    print(f"\nProgram length: {len(bf_code)} bytes")

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
    print("✓ Brackets matched correctly")

    hex_code = bf_code.encode().hex()

    # ─── TEST CASES ────────────────────────
    print("\n" + "=" * 60)
    print("TEST VECTORS")
    print("=" * 60)

    W = 119  # w = up
    A = 97   # a = left
    S = 115  # s = down
    D = 100  # d = right

    test_cases = [
        ("Move right (safe)",
         [D], [0],
         "Simple right move from center"),
        ("Move left (safe)",
         [A], [0],
         "Simple left move from center"),
        ("Move up (safe)",
         [W], [0],
         "Simple up move from center"),
        ("Move down (safe)",
         [S], [0],
         "Simple down move from center"),
        ("Hit right wall",
         [D, D, D], [0, 0, 0],
         "Start at x=2, move right 3 times → x=5 → game over"),
        ("Hit left wall",
         [A, A, A], [0, 0, 0],
         "Start at x=2, move left 3 times → x=-1 → game over"),
        ("Hit bottom wall",
         [S, S, S], [0, 0, 0],
         "Start at y=2, move down 3 times → y=5 → game over"),
        ("Hit top wall",
         [W, W, W], [0, 0, 0],
         "Start at y=2, move up 3 times → y=-1 → game over"),
        ("Collect food at (0,0)",
         [A, A, W, W], [10, 10, 10, 10],
         "Move to (0,0) from (2,2) → eat food → score=1"),
        ("Collect food then survive",
         [A, A, W, W, D], [10, 10, 10, 10, 0],
         "Eat food at (0,0), then move right → alive, score=1"),
        ("No food, survive several moves",
         [D, S, A, W], [0, 0, 0, 0],
         "Move in a square from center, no food eaten"),
        ("Multiple direction changes",
         [D, D, S, S, A, A], [0, 0, 0, 0, 0, 0],
         "Zig-zag within bounds"),
    ]

    all_passed = True
    for name, moves, seeds, desc in test_cases:
        # Python simulation
        py_go, py_score = simulate_snake(moves, seeds)

        # BF execution: interleave moves and seeds
        bf_inputs = []
        for m, s in zip(moves, seeds):
            bf_inputs.append(m)
            bf_inputs.append(s)

        try:
            bf_outputs = run_bf_interpreter(bf_code, bf_inputs)
        except RuntimeError as e:
            print(f"\n  ✗ {name}: BF ERROR → {e}")
            all_passed = False
            continue

        bf_go = bf_outputs[0] if len(bf_outputs) > 0 else -1
        bf_sc = bf_outputs[1] if len(bf_outputs) > 1 else -1

        match = py_go == bf_go and py_score == bf_sc
        status = "PASS ✓" if match else "FAIL ✗"
        if not match:
            all_passed = False

        print(f"\n  {status} {name}")
        print(f"         {desc}")
        print(f"         Moves={[chr(m) for m in moves]}")
        print(f"         Python: game_over={py_go}, score={py_score}")
        print(f"         BF:     game_over={bf_go}, score={bf_sc}")

    print("\n" + "=" * 60)
    if all_passed:
        print("✓ ALL TESTS PASSED")
    else:
        print("✗ SOME TESTS FAILED")
    print("=" * 60)

    # ─── WRITE OUTPUT FILES ───────────────
    with open("snake.bf", "w") as f:
        f.write(bf_code)
    with open("snake_hex.txt", "w") as f:
        f.write(hex_code)
    print(f"\nFiles written:")
    print(f"  snake.bf       ({len(bf_code)} bytes)")
    print(f"  snake_hex.txt  ({len(hex_code)//2} bytes)")
    print(f"\nSolidity hex:\nhex\"{hex_code}\"")


if __name__ == "__main__":
    main()
