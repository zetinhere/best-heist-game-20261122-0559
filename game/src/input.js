// Keyboard and mouse state, in logical (960x600) canvas coordinates.
// The game reads this, never the DOM events directly, so the simulation
// stays testable and the shot stager can drive it without a browser.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    // A click the game has not consumed yet: {x, y} in logical coords,
    // or null. The world consumes it (coin toss) and clears it.
    click: null,
    // Edge-triggered keys the world consumes once per press.
    pressed: new Set(),
  };

  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 960,
      y: ((e.clientY - r.top) / r.height) * 600,
    };
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(k);
    input.keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    input.keys.delete(k);
  });
  canvas.addEventListener('mousemove', (e) => {
    const p = toLogical(e);
    input.mouseX = p.x;
    input.mouseY = p.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = toLogical(e);
    input.mouseX = p.x;
    input.mouseY = p.y;
    input.click = { x: p.x, y: p.y };
  });
  // If the page loses focus, forget held keys so the thief never walks
  // off on his own.
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.pressed.clear();
  });

  input.held = (k) => input.keys.has(k);
  input.wasPressed = (k) => input.pressed.has(k);
  input.endFrame = () => {
    input.pressed.clear();
    // NOTE: click is NOT cleared here — the world consumes it.
  };
  return input;
}

// The four movement keys, as unit vectors. WASD and arrows both work.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (input.held('a') || input.held('ArrowLeft')) x -= 1;
  if (input.held('d') || input.held('ArrowRight')) x += 1;
  if (input.held('w') || input.held('ArrowUp')) y -= 1;
  if (input.held('s') || input.held('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.sqrt(2);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
