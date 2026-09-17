import re

with open("frontend/src/Glitch.ts", "r") as f:
    text = f.read()

# Update labels to just 4
text = re.sub(
    r'const labels = \["HP", "ENG", "ATK", "SHLD", "-", "BOSS", "-", "STS"\];\s*let html = '"''"';\s*for\(let i = 0; i < 8; i\+\+\) \{.*?\}',
    """const labels = ["SAÚDE", "ENERGIA", "CRÉDITOS", "NÍVEL SEC"];
  let html = '';
  
  for(let i = 0; i < 4; i++) {
    const valHex = hexTape.substring(i*2, i*2 + 2) || "00";
    const valInt = parseInt(valHex, 16);
    html += `
      <div class="tape-col">
        <div class="tape-cell">${valInt}</div>
        <div class="cell-label">${labels[i]}</div>
      </div>
    `;
  }
""",
    text,
    flags=re.DOTALL
)

with open("frontend/src/Glitch.ts", "w") as f:
    f.write(text)

