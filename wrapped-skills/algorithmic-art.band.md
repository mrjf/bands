---
band: algorithmic-art
version: 1
icon: 🔧
description: Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this
  when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems. Create
  original algorithmic art rather than copying existing artists' work to avoid copyright violations.
allow:
  tools:
    - claude:edit
    - claude:read
    - claude:write
  read:
    - "**/*"
  write:
    - "**/*"
  net:
    - "*.githubusercontent.com"
    - api.github.com
    - pypi.org
    - registry.npmjs.org
limit:
  maxInputBytes: 1048576
  maxOutputBytes: 10485760
  maxRuntimeMs: 30000
execution:
  target: local-lima
---

# Skill: algorithmic-art

Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems. Create original algorithmic art rather than copying existing artists' work to avoid copyright violations.

## Instructions

Algorithmic philosophies are computational aesthetic movements that are then expressed through code. Output .md files (philosophy), .html files (interactive viewer), and .js files (generative algorithms).

This happens in two steps:
1. Algorithmic Philosophy Creation (.md file)
2. Express by creating p5.js generative art (.html + .js files)

First, undertake this task:

## ALGORITHMIC PHILOSOPHY CREATION

To begin, create an ALGORITHMIC PHILOSOPHY (not static images or templates) that will be interpreted through:
- Computational processes, emergent behavior, mathematical beauty
- Seeded randomness, noise fields, organic systems
- Particles, flows, fields, forces
- Parametric variation and controlled chaos

### THE CRITICAL UNDERSTANDING
- What is received: Some subtle input or instructions by the user to take into account, but use as a foundation; it should not constrain creative freedom.
- What is created: An algorithmic philosophy/generative aesthetic movement.
- What happens next: The same version receives the philosophy and EXPRESSES IT IN CODE - creating p5.js sketches that are 90% algorithmic generation, 10% essential parameters.

Consider this approach:
- Write a manifesto for a generative art movement
- The next phase involves writing the algorithm that brings it to life

The philosophy must emphasize: Algorithmic expression. Emergent behavior. Computational beauty. Seeded variation.

### HOW TO GENERATE AN ALGORITHMIC PHILOSOPHY

**Name the movement** (1-2 words): "Organic Turbulence" / "Quantum Harmonics" / "Emergent Stillness"

**Articulate the philosophy** (4-6 paragraphs - concise but complete):

To capture the ALGORITHMIC essence, express how this philosophy manifests through:
- Computational processes and mathematical relationships?
- Noise functions and randomness patterns?
- Particle behaviors and field dynamics?
- Temporal evolution and system states?
- Parametric variation and emergent complexity?

**CRITICAL GUIDELINES:**
- **Avoid redundancy**: Each algorithmic aspect should be mentioned once. Avoid repeating concepts about noise theory, particle dynamics, or mathematical principles unless adding new depth.
- **Emphasize craftsmanship REPEATEDLY**: The philosophy MUST stress multiple times that the final algorithm should appear as though it took countless hours to develop, was refined with care, and comes from someone at the absolute top of their field. This framing is essential - repeat phrases like "meticulously crafted algorithm," "the product of deep computational expertise," "painstaking optimization," "master-level implementation."
- **Leave creative space**: Be specific about the algorithmic direction, but concise enough that the next Claude has room to make interpretive implementation choices at an extremely high level of craftsmanship.

The philosophy must guide the next version to express ideas ALGORITHMICALLY, not through static images. Beauty lives in the process, not the final frame.

### PHILOSOPHY EXAMPLES

**"Organic Turbulence"**
Philosophy: Chaos constrained by natural law, order emerging from disorder.
Algorithmic expression: Flow fields driven by layered Perlin noise. Thousands of particles following vector forces, their trails accumulating into organic density maps. Multiple noise octaves create turbulent regions and calm zones. Color emerges from velocity and density - fast particles burn bright, slow ones fade to shadow. The algorithm runs until equilibrium - a meticulously tuned balance where every parameter was refined through countless iterations by a master of computational aesthetics.

**"Quantum Harmonics"**
Philosophy: Discrete entities exhibiting wave-like interference patterns.
Algorithmic expression: Particles initialized on a grid, each carrying a phase value that evolves through sine waves. When particles are near, their phases interfere - constructive interference creates bright nodes, destructive creates voids. Simple harmonic motion generates complex emergent mandalas. The result of painstaking frequency calibration where every ratio was carefully chosen to produce resonant beauty.

**"Recursive Whispers"**
Philosophy: Self-similarity across scales, infinite depth in finite space.
Algorithmic expression: Branching structures that subdivide recursively. Each branch slightly randomized but constrained by golden ratios. L-systems or recursive subdivision generate tree-like forms that feel both mathematical and organic. Subtle noise perturbations break perfect symmetry. Line weights diminish with each recursion level. Every branching angle the product of deep mathematical exploration.

**"Field Dynamics"**
Philosophy: Invisible forces made visible through their effects on matter.
Algorithmic expression: Vector fields constructed from mathematical functions or noise. Particles born at edges, flowing along field lines, dying when they reach equilibrium or boundaries. Multiple fields can attract, repel, or rotate particles. The visualization shows only the traces - ghost-like evidence of invisible forces. A computational dance meticulously choreographed through force balance.

**"Stochastic Crystallization"**
Philosophy: Random processes crystallizing into ordered structures.
Algorithmic expression: Randomized circle packing or Voronoi tessellation. Start with random points, let them evolve through relaxation algorithms. Cells push apart until equilibrium. Color based on cell size, neighbor count, or distance from center. The organic tiling that emerges feels both random and inevitable. Every seed produces unique crystalline beauty - the mark of a master-level generative algorithm.

*These are condensed examples. The actual algorithmic philosophy should be 4-6 substantial paragraphs.*

### ESSENTIAL PRINCIPLES
- **ALGORITHMIC PHILOSOPHY**: Creating a computational worldview to be expressed through code
- **PROCESS OVER PRODUCT**: Always emphasize that beauty emerges from the algorithm's execution - each run is unique
- **PARAMETRIC EXPRESSION**: Ideas communicate through mathematical relationships, forces, behaviors - not static composition
- **ARTISTIC FREEDOM**: The next Claude interprets the philosophy algorithmically - provide creative implementation room
- **PURE GENERATIVE ART**: This is about making LIVING ALGORITHMS, not static images with randomness
- **EXPERT CRAFTSMANSHIP**: Repeatedly emphasize the final algorithm must feel meticulously crafted, refined through countless iterations, the product of deep expertise by someone at the absolute top of their field in computational aesthetics

**The algorithmic philosophy should be 4-6 paragraphs long.** Fill it with poetic computational philosophy that brings together the intended vision. Avoid repeating the same points. Output this algorithmic philosophy as a .md file.

---

## DEDUCING THE CONCEPTUAL SEED

**CRITICAL STEP**: Before implementing the algorithm, identify the subtle conceptual thread from the original request.

**THE ESSENTIAL PRINCIPLE**:
The concept is a **subtle, niche reference embedded within the algorithm itself** - not always literal, always sophisticated. Someone familiar with the subject should feel it intuitively, while others simply experience a masterful generative composition. The algorithmic philosophy provides the computational language. The deduced concept provides the soul - the quiet conceptual DNA woven invisibly into parameters, behaviors, and emergence patterns.

This is **VERY IMPORTANT**: The reference must be so refined that it enhances the work's depth without announcing itself. Think like a jazz musician quoting another song through algorithmic harmony - only those who know will catch it, but everyone appreciates the generative beauty.

---

## P5.JS IMPLEMENTATION

With the philosophy AND conceptual framework established, express it through code. Pause to gather thoughts before proceeding. Use only the algorithmic philosophy created and the instructions below.

### ⚠️ STEP 0: READ THE TEMPLATE FIRST ⚠️

**CRITICAL: BEFORE writing any HTML:**

1. **Read** `templates/viewer.html` using the Read tool
2. **Study** the exact structure, styling, and Anthropic branding
3. **Use that file as the LITERAL STARTING POINT** - not just inspiration
4. **Keep all FIXED sections exactly as shown** (header, sidebar structure, Anthropic colors/fonts, seed controls, action buttons)
5. **Replace only the VARIABLE sections** marked in the file's comments (algorithm, parameters, UI controls for parameters)

**Avoid:**
- ❌ Creating HTML from scratch
- ❌ Inventing custom styling or color schemes
- ❌ Using system fonts or dark themes
- ❌ Changing the sidebar structure

**Follow these practices:**
- ✅ Copy the template's exact HTML structure
- ✅ Keep Anthropic branding (Poppins/Lora fonts, light colors, gradient backdrop)
- ✅ Maintain the sidebar layout (Seed → Parameters → Colors? → Actions)
- ✅ Replace only the p5.js algorithm and parameter controls

The template is the foundation. Build on it, don't rebuild it.

---

To create gallery-quality computational art that lives and breathes, use the algorithmic philosophy as the foundation.

### TECHNICAL REQUIREMENTS

**Seeded Randomness (Art Blocks Pattern)**:
```javascript
// ALWAYS use a seed for reproducibility
let seed = 12345; // or hash from user input
randomSeed(seed);
noiseSeed(seed);
```

**Parameter Structure - FOLLOW THE PHILOSOPHY**:

To establish parameters that emerge naturally from the algorithmic philosophy, consider: "What qualities of this system can be adjusted?"

```javascript
let params = {
  seed: 12345,  // Always include seed for reproducibility
  // colors
  // Add parameters that control YOUR algorithm:
  // - Quantities (how many?)
  // - Scales (how big? how fast?)
  // - Probabilities (how likely?)
  // - Ratios (what proportions?)
  // - Angles (what direction?)
  // - Thresholds (when does behavior change?)
};
```

**To design effective parameters, focus on the properties the system needs to be tunable rather than thinking in terms of "pattern types".**

**Core Algorithm - EXPRESS THE PHILOSOPHY**:

**CRITICAL**: The algorithmic philosophy should dictate what to build.

To express the philosophy through code, avoid thinking "which pattern should I use?" and instead think "how to express this philosophy through code?"

If the philosophy is about **organic emergence**, consider using:
- Elements that accumulate or grow over time
- Random processes constrained by natural rules
- Feedback loops and interactions

If the philosophy is about **mathematical beauty**, consider using:
- Geometric relationships and ratios
- Trigonometric functions and harmonics
- Precise calculations creating unexpected patterns

If the philosophy is about **controlled chaos**, consider using:
- Random variation within strict boundaries
- Bifurcation and phase transitions
- Order emerging from disorder

**The algorithm flows from the philosophy, not from a menu of options.**

To guide the implementation, let the conceptual essence inform creative and original choices. Build something that expresses the vision for this particular request.

**Canvas Setup**: Standard p5.js structure:
```javascript
function setup() {
  createCanvas(1200, 1200);
  // Initialize your system
}

function draw() {
  // Your generative algorithm
  // Can be static (noLoop) or animated
}
```

### CRAFTSMANSHIP REQUIREMENTS

**CRITICAL**: To achieve mastery, create algorithms that feel like they emerged through countless iterations by a master generative artist. Tune every parameter carefully. Ensure every pattern emerges with purpose. This is NOT random noise - this is CONTROLLED CHAOS refined through deep expertise.

- **Balance**: Complexity without visual noise, order without rigidity
- **Color Harmony**: Thoughtful palettes, not random RGB values
- **Composition**: Even in randomness, maintain visual hierarchy and flow
- **Performance**: Smooth execution, optimized for real-time if animated
- **Reproducibility**: Same seed ALWAYS produces identical output

### OUTPUT FORMAT

Output:
1. **Algorithmic Philosophy** - As markdown or text explaining the generative aesthetic
2. **Single HTML Artifact** - Self-contained interactive generative art built from `templates/viewer.html` (see STEP 0 and next section)

The HTML artifact contains everything: p5.js (from CDN), the algorithm, parameter controls, and UI - all in one file that works immediately in claude.ai artifacts or any browser. Start from the template file, not from scratch.

---

## INTERACTIVE ARTIFACT CREATION

**REMINDER: `templates/viewer.html` should have already been read (see STEP 0). Use that file as the starting point.**

To allow exploration of the generative art, create a single, self-contained HTML artifact. Ensure this artifact works immediately in claude.ai or any browser - no setup required. Embed everything inline.

### CRITICAL: WHAT'S FIXED VS VARIABLE

The `templates/viewer.html` file is the foundation. It contains the exact structure and styling needed.

**FIXED (always include exactly as shown):**
- Layout structure (header, sidebar, main canvas area)
- Anthropic branding (UI colors, fonts, gradients)
- Seed section in sidebar:
  - Seed display
  - Previous/Next buttons
  - Random button
  - Jump to seed input + Go button
- Actions section in sidebar:
  - Regenerate button
  - Reset button

**VARIABLE (customize for each artwork):**
- The entire p5.js algorithm (setup/draw/classes)
- The parameters object (define what the art needs)
- The Parameters section in sidebar:
  - Number of parameter controls
  - Parameter names
  - Min/max/step values for sliders
  - Control types (sliders, inputs, etc.)
- Colors section (optional):
  - Some art needs color pickers
  - Some art might use fixed colors
  - Some art might be monochrome (no color controls needed)
  - Decide based on the art's needs

**Every artwork should have unique parameters and algorithm!** The fixed parts provide consistent UX - everything else expresses the unique vision.

### REQUIRED FEATURES

**1. Parameter Controls**
- Sliders for numeric parameters (particle count, noise scale, speed, etc.)
- Color pickers for palette colors
- Real-time updates when parameters change
- Reset button to restore defaults

**2. Seed Navigation**
- Display current seed number
- "Previous" and "Next" buttons to cycle through seeds
- "Random" button for random seed
- Input field to jump to specific seed
- Generate 100 variations when requested (seeds 1-100)

**3. Single Artifact Structure**
```html
<!DOCTYPE html>
<html>
<head>
  <!-- p5.js from CDN - always available -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js"></script>
  <style>
    /* All styling inline - clean, minimal */
    /* Canvas on top, controls below */
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div id="controls">
    <!-- All parameter controls -->
  </div>
  <script>
    // ALL p5.js code inline here
    // Parameter objects, classes, functions
    // setup() and draw()
    // UI handlers
    // Everything self-contained
  </script>
</body>
</html>
```

**CRITICAL**: This is a single artifact. No external files, no imports (except p5.js CDN). Everything inline.

**4. Implementation Details - BUILD THE SIDEBAR**

The sidebar structure:

**1. Seed (FIXED)** - Always include exactly as shown:
- Seed display
- Prev/Next/Random/Jump buttons

**2. Parameters (VARIABLE)** - Create controls for the art:
```html
<div class="control-group">
    <label>Parameter Name</label>
    <input type="range" id="param" min="..." max="..." step="..." value="..." oninput="updateParam('param', this.value)">
    <span class="value-display" id="param-value">...</span>
</div>
```
Add as many control-group divs as there are parameters.

**3. Colors (OPTIONAL/VARIABLE)** - Include if the art needs adjustable colors:
- Add color pickers if users should control palette
- Skip this section if the art uses fixed colors
- Skip if the art is monochrome

**4. Actions (FIXED)** - Always include exactly as shown:
- Regenerate button
- Reset button
- Download PNG button

**Requirements**:
- Seed controls must work (prev/next/random/jump/display)
- All parameters must have UI controls
- Regenerate, Reset, Download buttons must work
- Keep Anthropic branding (UI styling, not art colors)

### USING THE ARTIFACT

The HTML artifact works immediately:
1. **In claude.ai**: Displayed as an interactive artifact - runs instantly
2. **As a file**: Save and open in any browser - no server needed
3. **Sharing**: Send the HTML file - it's completely self-contained

---

## VARIATIONS & EXPLORATION

The artifact includes seed navigation by default (prev/next/random buttons), allowing users to explore variations without creating multiple files. If the user wants specific variations highlighted:

- Include seed presets (buttons for "Variation 1: Seed 42", "Variation 2: Seed 127", etc.)
- Add a "Gallery Mode" that shows thumbnails of multiple seeds side-by-side
- All within the same single artifact

This is like creating a series of prints from the same plate - the algorithm is consistent, but each seed reveals different facets of its potential. The interactive nature means users discover their own favorites by exploring the seed space.

---

## THE CREATIVE PROCESS

**User request** → **Algorithmic philosophy** → **Implementation**

Each request is unique. The process involves:

1. **Interpret the user's intent** - What aesthetic is being sought?
2. **Create an algorithmic philosophy** (4-6 paragraphs) describing the computational approach
3. **Implement it in code** - Build the algorithm that expresses this philosophy
4. **Design appropriate parameters** - What should be tunable?
5. **Build matching UI controls** - Sliders/inputs for those parameters

**The constants**:
- Anthropic branding (colors, fonts, layout)
- Seed navigation (always present)
- Self-contained HTML artifact

**Everything else is variable**:
- The algorithm itself
- The parameters
- The UI controls
- The visual outcome

To achieve the best results, trust creativity and let the philosophy guide the implementation.

---

## RESOURCES

This skill includes helpful templates and documentation:

- **templates/viewer.html**: REQUIRED STARTING POINT for all HTML artifacts.
  - This is the foundation - contains the exact structure and Anthropic branding
  - **Keep unchanged**: Layout structure, sidebar organization, Anthropic colors/fonts, seed controls, action buttons
  - **Replace**: The p5.js algorithm, parameter definitions, and UI controls in Parameters section
  - The extensive comments in the file mark exactly what to keep vs replace

- **templates/generator_template.js**: Reference for p5.js best practices and code structure principles.
  - Shows how to organize parameters, use seeded randomness, structure classes
  - NOT a pattern menu - use these principles to build unique algorithms
  - Embed algorithms inline in the HTML artifact (don't create separate .js files)

**Critical reminder**:
- The **template is the STARTING POINT**, not inspiration
- The **algorithm is where to create** something unique
- Don't copy the flow field example - build what the philosophy demands
- But DO keep the exact UI structure and Anthropic branding from the template

## References

### templates/viewer.html

<!DOCTYPE html>
<!--
    THIS IS A TEMPLATE THAT SHOULD BE USED EVERY TIME AND MODIFIED.
    WHAT TO KEEP:
    ✓ Overall structure (header, sidebar, main content)
    ✓ Anthropic branding (colors, fonts, layout)
    ✓ Seed navigation section (always include this)
    ✓ Self-contained artifact (everything inline)

    WHAT TO CREATIVELY EDIT:
    ✗ The p5.js algorithm (implement YOUR vision)
    ✗ The parameters (define what YOUR art needs)
    ✗ The UI controls (match YOUR parameters)

    Let your philosophy guide the implementation.
    The world is your oyster - be creative!
-->
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generative Art Viewer</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Lora:wght@400;500&display=swap" rel="stylesheet">
    <style>
        /* Anthropic Brand Colors */
        :root {
            --anthropic-dark: #141413;
            --anthropic-light: #faf9f5;
            --anthropic-mid-gray: #b0aea5;
            --anthropic-light-gray: #e8e6dc;
            --anthropic-orange: #d97757;
            --anthropic-blue: #6a9bcc;
            --anthropic-green: #788c5d;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(135deg, var(--anthropic-light) 0%, #f5f3ee 100%);
            min-height: 100vh;
            color: var(--anthropic-dark);
        }

        .container {
            display: flex;
            min-height: 100vh;
            padding: 20px;
            gap: 20px;
        }

        /* Sidebar */
        .sidebar {
            width: 320px;
            flex-shrink: 0;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(20, 20, 19, 0.1);
            overflow-y: auto;
            overflow-x: hidden;
        }

        .sidebar h1 {
            font-family: 'Lora', serif;
            font-size: 24px;
            font-weight: 500;
            color: var(--anthropic-dark);
            margin-bottom: 8px;
        }

        .sidebar .subtitle {
            color: var(--anthropic-mid-gray);
            font-size: 14px;
            margin-bottom: 32px;
            line-height: 1.4;
        }

        /* Control Sections */
        .control-section {
            margin-bottom: 32px;
        }

        .control-section h3 {
            font-size: 16px;
            font-weight: 600;
            color: var(--anthropic-dark);
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .control-section h3::before {
            content: '•';
            color: var(--anthropic-orange);
            font-weight: bold;
        }

        /* Seed Controls */
        .seed-input {
            width: 100%;
            background: var(--anthropic-light);
            padding: 12px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            margin-bottom: 12px;
            border: 1px solid var(--anthropic-light-gray);
            text-align: center;
        }

        .seed-input:focus {
            outline: none;
            border-color: var(--anthropic-orange);
            box-shadow: 0 0 0 2px rgba(217, 119, 87, 0.1);
            background: white;
        }

        .seed-controls {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 8px;
        }

        .regen-button {
            margin-bottom: 0;
        }

        /* Parameter Controls */
        .control-group {
            margin-bottom: 20px;
        }

        .control-group label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: var(--anthropic-dark);
            margin-bottom: 8px;
        }

        .slider-container {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .slider-container input[type="range"] {
            flex: 1;
            height: 4px;
            background: var(--anthropic-light-gray);
            border-radius: 2px;
            outline: none;
            -webkit-appearance: none;
        }

        .slider-container input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            background: var(--anthropic-orange);
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .slider-container input[type="range"]::-webkit-slider-thumb:hover {
            transform: scale(1.1);
            background: #c86641;
        }

        .slider-container input[type="range"]::-moz-range-thumb {
            width: 16px;
            height: 16px;
            background: var(--anthropic-orange);
            border-radius: 50%;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .value-display {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: var(--anthropic-mid-gray);
            min-width: 60px;
            text-align: right;
        }

        /* Color Pickers */
        .color-group {
            margin-bottom: 16px;
        }

        .color-group label {
            display: block;
            font-size: 12px;
            color: var(--anthropic-mid-gray);
            margin-bottom: 4px;
        }

        .color-picker-container {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .color-picker-container input[type="color"] {
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            background: none;
            padding: 0;
        }

        .color-value {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: var(--anthropic-mid-gray);
        }

        /* Buttons */
        .button {
            background: var(--anthropic-orange);
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            width: 100%;
        }

        .button:hover {
            background: #c86641;
            transform: translateY(-1px);
        }

        .button:active {
            transform: translateY(0);
        }

        .button.secondary {
            background: var(--anthropic-blue);
        }

        .button.secondary:hover {
            background: #5a8bb8;
        }

        .button.tertiary {
            background: var(--anthropic-green);
        }

        .button.tertiary:hover {
            background: #6b7b52;
        }

        .button-row {
            display: flex;
            gap: 8px;
        }

        .button-row .button {
            flex: 1;
        }

        /* Canvas Area */
        .canvas-area {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 0;
        }

        #canvas-container {
            width: 100%;
            max-width: 1000px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(20, 20, 19, 0.1);
            background: white;
        }

        #canvas-container canvas {
            display: block;
            width: 100% !important;
            height: auto !important;
        }

        /* Loading State */
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: var(--anthropic-mid-gray);
        }

        /* Responsive - Stack on mobile */
        @media (max-width: 600px) {
            .container {
                flex-direction: column;
            }

            .sidebar {
                width: 100%;
            }

            .canvas-area {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Control Sidebar -->
        <div class="sidebar">
            <!-- Headers (CUSTOMIZE THIS FOR YOUR ART) -->
            <h1>TITLE - EDIT</h1>
            <div class="subtitle">SUBHEADER - EDIT</div>

            <!-- Seed Section (ALWAYS KEEP THIS) -->
            <div class="control-section">
                <h3>Seed</h3>
                <input type="number" id="seed-input" class="seed-input" value="12345" onchange="updateSeed()">
                <div class="seed-controls">
                    <button class="button secondary" onclick="previousSeed()">← Prev</button>
                    <button class="button secondary" onclick="nextSeed()">Next →</button>
                </div>
                <button class="button tertiary regen-button" onclick="randomSeedAndUpdate()">↻ Random</button>
            </div>

            <!-- Parameters Section (CUSTOMIZE THIS FOR YOUR ART) -->
            <div class="control-section">
                <h3>Parameters</h3>
                
                <!-- Particle Count -->
                <div class="control-group">
                    <label>Particle Count</label>
                    <div class="slider-container">
                        <input type="range" id="particleCount" min="1000" max="10000" step="500" value="5000" oninput="updateParam('particleCount', this.value)">
                        <span class="value-display" id="particleCount-value">5000</span>
                    </div>
                </div>

                <!-- Flow Speed -->
                <div class="control-group">
                    <label>Flow Speed</label>
                    <div class="slider-container">
                        <input type="range" id="flowSpeed" min="0.1" max="2.0" step="0.1" value="0.5" oninput="updateParam('flowSpeed', this.value)">
                        <span class="value-display" id="flowSpeed-value">0.5</span>
                    </div>
                </div>

                <!-- Noise Scale -->
                <div class="control-group">
                    <label>Noise Scale</label>
                    <div class="slider-container">
                        <input type="range" id="noiseScale" min="0.001" max="0.02" step="0.001" value="0.005" oninput="updateParam('noiseScale', this.value)">
                        <span class="value-display" id="noiseScale-value">0.005</span>
                    </div>
                </div>

                <!-- Trail Length -->
                <div class="control-group">
                    <label>Trail Length</label>
                    <div class="slider-container">
                        <input type="range" id="trailLength" min="2" max="20" step="1" value="8" oninput="updateParam('trailLength', this.value)">
                        <span class="value-display" id="trailLength-value">8</span>
                    </div>
                </div>
            </div>

            <!-- Colors Section (OPTIONAL - CUSTOMIZE OR REMOVE) -->
            <div class="control-section">
                <h3>Colors</h3>
                
                <!-- Color 1 -->
                <div class="color-group">
                    <label>Primary Color</label>
                    <div class="color-picker-container">
                        <input type="color" id="color1" value="#d97757" onchange="updateColor('color1', this.value)">
                        <span class="color-value" id="color1-value">#d97757</span>
                    </div>
                </div>

                <!-- Color 2 -->
                <div class="color-group">
                    <label>Secondary Color</label>
                    <div class="color-picker-container">
                        <input type="color" id="color2" value="#6a9bcc" onchange="updateColor('color2', this.value)">
                        <span class="color-value" id="color2-value">#6a9bcc</span>
                    </div>
                </div>

                <!-- Color 3 -->
                <div class="color-group">
                    <label>Accent Color</label>
                    <div class="color-picker-container">
                        <input type="color" id="color3" value="#788c5d" onchange="updateColor('color3', this.value)">
                        <span class="color-value" id="color3-value">#788c5d</span>
                    </div>
                </div>
            </div>

            <!-- Actions Section (ALWAYS KEEP THIS) -->
            <div class="control-section">
                <h3>Actions</h3>
                <div class="button-row">
                    <button class="button" onclick="resetParameters()">Reset</button>
                </div>
            </div>
        </div>

        <!-- Main Canvas Area -->
        <div class="canvas-area">
            <div id="canvas-container">
                <div class="loading">Initializing generative art...</div>
            </div>
        </div>
    </div>

    <script>
        // ═══════════════════════════════════════════════════════════════════════
        // GENERATIVE ART PARAMETERS - CUSTOMIZE FOR YOUR ALGORITHM
        // ═══════════════════════════════════════════════════════════════════════

        let params = {
            seed: 12345,
            particleCount: 5000,
            flowSpeed: 0.5,
            noiseScale: 0.005,
            trailLength: 8,
            colorPalette: ['#d97757', '#6a9bcc', '#788c5d']
        };

        let defaultParams = {...params}; // Store defaults for reset

        // ═══════════════════════════════════════════════════════════════════════
        // P5.JS GENERATIVE ART ALGORITHM - REPLACE WITH YOUR VISION
        // ═══════════════════════════════════════════════════════════════════════

        let particles = [];
        let flowField = [];
        let cols, rows;
        let scl = 10; // Flow field resolution

        function setup() {
            let canvas = createCanvas(1200, 1200);
            canvas.parent('canvas-container');
            
            initializeSystem();
            
            // Remove loading message
            document.querySelector('.loading').style.display = 'none';
        }

        function initializeSystem() {
            // Seed the randomness for reproducibility
            randomSeed(params.seed);
            noiseSeed(params.seed);

            // Clear particles and recreate
            particles = [];
            
            // Initialize particles
            for (let i = 0; i < params.particleCount; i++) {
                particles.push(new Particle());
            }

            // Calculate flow field dimensions
            cols = floor(width / scl);
            rows = floor(height / scl);
            
            // Generate flow field
            generateFlowField();

            // Clear background
            background(250, 249, 245); // Anthropic light background
        }

        function generateFlowField() {
          // fill this in
        }

        function draw() {
            // fill this in
        }

        // ═══════════════════════════════════════════════════════════════════════
        // PARTICLE SYSTEM - CUSTOMIZE FOR YOUR ALGORITHM
        // ═══════════════════════════════════════════════════════════════════════

        class Particle {
            constructor() {
                // fill this in
            }
            // fill this in
        }

        // ═══════════════════════════════════════════════════════════════════════
        // UI CONTROL HANDLERS - CUSTOMIZE FOR YOUR PARAMETERS
        // ═══════════════════════════════════════════════════════════════════════

        function updateParam(paramName, value) {
            // fill this in
        }

        function updateColor(colorId, value) {
            // fill this in
        }

        // ═══════════════════════════════════════════════════════════════════════
        // SEED CONTROL FUNCTIONS - ALWAYS KEEP THESE
        // ═══════════════════════════════════════════════════════════════════════

        function updateSeedDisplay() {
            document.getElementById('seed-input').value = params.seed;
        }

        function updateSeed() {
            let input = document.getElementById('seed-input');
            let newSeed = parseInt(input.value);
            if (newSeed && newSeed > 0) {
                params.seed = newSeed;
                initializeSystem();
            } else {
                // Reset to current seed if invalid
                updateSeedDisplay();
            }
        }

        function previousSeed() {
            params.seed = Math.max(1, params.seed - 1);
            updateSeedDisplay();
            initializeSystem();
        }

        function nextSeed() {
            params.seed = params.seed + 1;
            updateSeedDisplay();
            initializeSystem();
        }

        function randomSeedAndUpdate() {
            params.seed = Math.floor(Math.random() * 999999) + 1;
            updateSeedDisplay();
            initializeSystem();
        }

        function resetParameters() {
            params = {...defaultParams};
            
            // Update UI elements
            document.getElementById('particleCount').value = params.particleCount;
            document.getElementById('particleCount-value').textContent = params.particleCount;
            document.getElementById('flowSpeed').value = params.flowSpeed;
            document.getElementById('flowSpeed-value').textContent = params.flowSpeed;
            document.getElementById('noiseScale').value = params.noiseScale;
            document.getElementById('noiseScale-value').textContent = params.noiseScale;
            document.getElementById('trailLength').value = params.trailLength;
            document.getElementById('trailLength-value').textContent = params.trailLength;
            
            // Reset colors
            document.getElementById('color1').value = params.colorPalette[0];
            document.getElementById('color1-value').textContent = params.colorPalette[0];
            document.getElementById('color2').value = params.colorPalette[1];
            document.getElementById('color2-value').textContent = params.colorPalette[1];
            document.getElementById('color3').value = params.colorPalette[2];
            document.getElementById('color3-value').textContent = params.colorPalette[2];
            
            updateSeedDisplay();
            initializeSystem();
        }

        // Initialize UI on load
        window.addEventListener('load', function() {
            updateSeedDisplay();
        });
    </script>
</body>
</html>

### templates/generator_template.js

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                  P5.JS GENERATIVE ART - BEST PRACTICES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file shows STRUCTURE and PRINCIPLES for p5.js generative art.
 * It does NOT prescribe what art you should create.
 *
 * Your algorithmic philosophy should guide what you build.
 * These are just best practices for how to structure your code.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ============================================================================
// 1. PARAMETER ORGANIZATION
// ============================================================================
// Keep all tunable parameters in one object
// This makes it easy to:
// - Connect to UI controls
// - Reset to defaults
// - Serialize/save configurations

let params = {
    // Define parameters that match YOUR algorithm
    // Examples (customize for your art):
    // - Counts: how many elements (particles, circles, branches, etc.)
    // - Scales: size, speed, spacing
    // - Probabilities: likelihood of events
    // - Angles: rotation, direction
    // - Colors: palette arrays

    seed: 12345,
    // define colorPalette as an array -- choose whatever colors you'd like ['#d97757', '#6a9bcc', '#788c5d', '#b0aea5']
    // Add YOUR parameters here based on your algorithm
};

// ============================================================================
// 2. SEEDED RANDOMNESS (Critical for reproducibility)
// ============================================================================
// ALWAYS use seeded random for Art Blocks-style reproducible output

function initializeSeed(seed) {
    randomSeed(seed);
    noiseSeed(seed);
    // Now all random() and noise() calls will be deterministic
}

// ============================================================================
// 3. P5.JS LIFECYCLE
// ============================================================================

function setup() {
    createCanvas(800, 800);

    // Initialize seed first
    initializeSeed(params.seed);

    // Set up your generative system
    // This is where you initialize:
    // - Arrays of objects
    // - Grid structures
    // - Initial positions
    // - Starting states

    // For static art: call noLoop() at the end of setup
    // For animated art: let draw() keep running
}

function draw() {
    // Option 1: Static generation (runs once, then stops)
    // - Generate everything in setup()
    // - Call noLoop() in setup()
    // - draw() doesn't do much or can be empty

    // Option 2: Animated generation (continuous)
    // - Update your system each frame
    // - Common patterns: particle movement, growth, evolution
    // - Can optionally call noLoop() after N frames

    // Option 3: User-triggered regeneration
    // - Use noLoop() by default
    // - Call redraw() when parameters change
}

// ============================================================================
// 4. CLASS STRUCTURE (When you need objects)
// ============================================================================
// Use classes when your algorithm involves multiple entities
// Examples: particles, agents, cells, nodes, etc.

class Entity {
    constructor() {
        // Initialize entity properties
        // Use random() here - it will be seeded
    }

    update() {
        // Update entity state
        // This might involve:
        // - Physics calculations
        // - Behavioral rules
        // - Interactions with neighbors
    }

    display() {
        // Render the entity
        // Keep rendering logic separate from update logic
    }
}

// ============================================================================
// 5. PERFORMANCE CONSIDERATIONS
// ============================================================================

// For large numbers of elements:
// - Pre-calculate what you can
// - Use simple collision detection (spatial hashing if needed)
// - Limit expensive operations (sqrt, trig) when possible
// - Consider using p5 vectors efficiently

// For smooth animation:
// - Aim for 60fps
// - Profile if things are slow
// - Consider reducing particle counts or simplifying calculations

// ============================================================================
// 6. UTILITY FUNCTIONS
// ============================================================================

// Color utilities
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function colorFromPalette(index) {
    return params.colorPalette[index % params.colorPalette.length];
}

// Mapping and easing
function mapRange(value, inMin, inMax, outMin, outMax) {
    return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Constrain to bounds
function wrapAround(value, max) {
    if (value < 0) return max;
    if (value > max) return 0;
    return value;
}

// ============================================================================
// 7. PARAMETER UPDATES (Connect to UI)
// ============================================================================

function updateParameter(paramName, value) {
    params[paramName] = value;
    // Decide if you need to regenerate or just update
    // Some params can update in real-time, others need full regeneration
}

function regenerate() {
    // Reinitialize your generative system
    // Useful when parameters change significantly
    initializeSeed(params.seed);
    // Then regenerate your system
}

// ============================================================================
// 8. COMMON P5.JS PATTERNS
// ============================================================================

// Drawing with transparency for trails/fading
function fadeBackground(opacity) {
    fill(250, 249, 245, opacity); // Anthropic light with alpha
    noStroke();
    rect(0, 0, width, height);
}

// Using noise for organic variation
function getNoiseValue(x, y, scale = 0.01) {
    return noise(x * scale, y * scale);
}

// Creating vectors from angles
function vectorFromAngle(angle, magnitude = 1) {
    return createVector(cos(angle), sin(angle)).mult(magnitude);
}

// ============================================================================
// 9. EXPORT FUNCTIONS
// ============================================================================

function exportImage() {
    saveCanvas('generative-art-' + params.seed, 'png');
}

// ============================================================================
// REMEMBER
// ============================================================================
//
// These are TOOLS and PRINCIPLES, not a recipe.
// Your algorithmic philosophy should guide WHAT you create.
// This structure helps you create it WELL.
//
// Focus on:
// - Clean, readable code
// - Parameterized for exploration
// - Seeded for reproducibility
// - Performant execution
//
// The art itself is entirely up to you!
//
// ============================================================================

