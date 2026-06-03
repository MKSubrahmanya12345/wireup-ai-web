// ??$$$ non-important
// ??$$$ newer code — KiCad S-Expression parsing verification script
async function main() {
  const url = "https://raw.githubusercontent.com/KiCad/kicad-footprints/master/Package_TO_SOT_THT.pretty/TO-92_Inline.kicad_mod";
  console.log(`[Test] Fetching sample footprint from: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }
    const content = await res.text();
    console.log(`[Test] Fetched footprint successfully (${content.length} characters).`);

    // Regex that handles:
    // - Quoted or unquoted path: (?:"([^"]+)"|([^\s\)]+))
    // - Offset keyword 'at' or 'offset': (?:offset|at)
    // - Any combination of newlines/whitespace: \s* / \s+
    const modelRegex = /\(model\s+(?:"([^"]+)"|([^\s\)]+))\s*\(at\s+\(xyz\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)\)\s*\(scale\s+\(xyz\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)\)\s*\(rotate\s+\(xyz\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)\)\s*\)/i;

    const match = content.match(modelRegex);

    if (match) {
      console.log("\n=========================================");
      console.log("MATCH FOUND!");
      console.log("=========================================");
      const rawPath = match[1] || match[2];
      const offsetX = match[3];
      const offsetY = match[4];
      const offsetZ = match[5];
      const scaleX = match[6];
      const scaleY = match[7];
      const scaleZ = match[8];
      const rotateX = match[9];
      const rotateY = match[10];
      const rotateZ = match[11];

      console.log("1. Path:", rawPath);
      console.log("2. Offset X, Y, Z:", offsetX, offsetY, offsetZ);
      console.log("3. Scale X, Y, Z:", scaleX, scaleY, scaleZ);
      console.log("4. Rotate X, Y, Z:", rotateX, rotateY, rotateZ);
      console.log("=========================================");

      const parsedData = {
        path: rawPath,
        offset: { x: parseFloat(offsetX), y: parseFloat(offsetY), z: parseFloat(offsetZ) },
        scale: { x: parseFloat(scaleX), y: parseFloat(scaleY), z: parseFloat(scaleZ) },
        rotate: { x: parseFloat(rotateX), y: parseFloat(rotateY), z: parseFloat(rotateZ) }
      };

      console.log("JSON Output Preview:\n", JSON.stringify(parsedData, null, 2));
      console.log("\nDone");
    } else {
      console.error("\n[Test] FAILED: Regex could not match the model block.");
    }
  } catch (err: any) {
    console.error("[Test] Error in execution:", err.message);
  }
}

main().catch(console.error);
