// @ts-nocheck
// ??$$$ - Groq client handler for 3D model generation

// ??$$$ - Component Auto-Arranger & CAD Casing Prompt
const COMPONENT_SYSTEM_PROMPT = `You are a professional 3D CAD designer and model generator.
Your job is to generate a 3D scene representation as a structured JSON object representing a physical layout.
Do not output any markdown formatting, explanations, or text surrounding the JSON. Output ONLY a valid JSON object.

The JSON schema must look EXACTLY like this:
{
  "name": "Descriptive Name of the 3D model/scene",
  "objects": [
    {
      "id": "unique_string_id",
      "type": "box" | "sphere" | "cylinder" | "cone" | "torus",
      "dimensions": [width, height, depth] for box, or [radius] for sphere, or [radius, height] for cylinder, or [radius, height] for cone, or [radius, tubeRadius] for torus,
      "position": [x, y, z],
      "rotation": [x_deg, y_deg, z_deg],
      "color": "#HEX_COLOR",
      "material": "standard" | "metal" | "glass" | "glowing" | "toon",
      "isElectronic": boolean, // true if it is an electronic component from the user's input, false for generated frames/casing
      "physics": {
        "isStatic": false | true,
        "mass": number_greater_than_zero,
        "restitution": number_between_0_and_1,
        "velocity": [vx, vy, vz]
      }
    }
  ]
}

Auto-Arrangement & CAD Casing Rules:
1. The user will provide a list of electronic components (e.g. Arduino, ESP32, batteries, propellers, servos) with their dimensions and current positions.
2. Your goal is to:
   - AUTO-ARRANGE all the electronic components into a compact, logical, and optimal configuration according to the prompt (e.g. side-by-side for a casing box, propellers placed symmetrically at the four corners for a drone frame, stacked or aligned).
   - Design and generate a structural frame, chassis plate, enclosure, brackets, or cover that fits around these components.
3. You MUST include ALL the user's original electronic components in the output JSON with their IDs unchanged. Set their "isElectronic" property to true.
4. You MUST update the "position" and "rotation" of these electronic components to place them in the newly arranged, non-overlapping design layout.
5. You must generate NEW structural objects (set "isElectronic" to false) representing the casing walls, struts, or brackets.
6. CRITICAL: Absolutely NO overlap or intersection is allowed. You must calculate component boundaries and coordinates precisely.
   - For example: if an ESP32 (width 5.0) and a Battery (width 7.0) are placed side-by-side along the X-axis:
     - Place the ESP32 at X = -3.7, Y = 0.5, Z = 0
     - Place the Battery at X = 2.5, Y = 1.3, Z = 0 (leaving a gap between them).
     - The bottom casing plate should stretch from X = -7 to +7 (width 14.5), at Y = 0.1, with thickness 0.2.
   - For a drone: place 4 propeller cylinders at X/Z coordinates: [-5, -5], [-5, 5], [5, -5], [5, 5] at Y=1.5, and the main controller/battery at the center [0, 0.8, 0]. Then create connection struts (cylinders or boxes) stretching from the center to each propeller.
7. Always place a floor or ground box (ID: "floor", dimensions: [25, 0.5, 25], position: [0, -0.25, 0], isStatic: true, color: "#12131a") to support simulation.
8. Keep total objects under 24. Make sure all IDs are unique.`;

/**
 * Generates a 3D model configuration by querying the backend API or falling back to a direct Groq API call.
 * @param {string} prompt - User request for 3D model
 * @param {string} apiKey - Optional direct Groq API Key
 * @param {string} model - Groq AI model name
 * @param {Array} existingObjects - List of active components to fit
 * @returns {Promise<Object>} - Parsed 3D scene JSON
 */
export async function generate3DModel(prompt, apiKey = '', model = 'llama-3.3-70b-versatile', existingObjects = []) {
  if (apiKey) {
    try {
      let userMessageContent = `Generate a 3D layout design for the prompt: "${prompt}".\n\n`;
      if (existingObjects.length > 0) {
        userMessageContent += `You must arrange the following electronic components and design the casing/frame around them. Do not let them overlap:\n`;
        existingObjects.forEach((obj) => {
          userMessageContent += `- Part Name: "${obj.name}" (ID: "${obj.id}"), Type: "${obj.type}", Size: [${obj.dimensions.join(', ')}], Current Pos: [${obj.position.join(', ')}]\n`;
        });
        userMessageContent += `\nArrange these parts logically to fit the prompt, recalculate their "position" and "rotation" to ensure zero overlap, and add the generated housing/frame objects around them. Return the entire updated object list.`;
      } else {
        userMessageContent += `No components are currently placed. Create a complete standalone assembly.`;
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: COMPONENT_SYSTEM_PROMPT },
            { role: 'user', content: userMessageContent }
          ],
          model: model,
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Groq API returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) throw new Error('Groq AI returned an empty response');
      
      return JSON.parse(content);
    } catch (err) {
      console.warn('Direct Groq API call failed, trying backend...', err);
    }
  }

  // Call our Express backend proxy
  const backendUrl = '/api/generate';
  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      model,
      apiKey,
      existingObjects
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server responded with ${response.status}`);
  }

  return await response.json();
}

