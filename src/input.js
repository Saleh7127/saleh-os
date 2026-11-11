// Keyboard, pointer-lock mouse look and touch controls.
export function createInput(canvas) {
  const keys = new Set(), pressed = new Set();
  const st = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, sprint: false, walk: false, jump: false, brake: false, act: false, map: false, help: false, touch: false, enabled: true };
  const isTyping = (e) => e.target.closest?.("input, textarea, dialog");

  addEventListener("keydown", (e) => {
    if (!st.enabled || isTyping(e)) return;
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());

  // mouse look: pointer lock when available, drag otherwise
  let dragging = false;
  canvas.addEventListener("mousedown", (e) => {
    if (!st.enabled) return;
    if (document.pointerLockElement === canvas && e.button === 0) pressed.add("Click");
    if (document.pointerLockElement !== canvas && e.button === 0 && !st.touch) canvas.requestPointerLock?.();
    dragging = true;
  });
  addEventListener("mouseup", () => (dragging = false));
  addEventListener("mousemove", (e) => {
    if (!st.enabled) return;
    if (document.pointerLockElement === canvas || dragging) { st.look.x += e.movementX; st.look.y += e.movementY; }
  });
  addEventListener("wheel", (e) => { st.zoom = (st.zoom || 0) + Math.sign(e.deltaY); }, { passive: true });

  // touch: left joystick, right half drags the camera, buttons
  const joy = document.getElementById("joy"), knob = joy?.querySelector("i");
  let joyId = null, joyC = { x: 0, y: 0 }, lookId = null, lookP = { x: 0, y: 0 };
  const tmove = { x: 0, y: 0 };
  addEventListener("touchstart", (e) => {
    st.touch = true;
    document.documentElement.classList.add("touch");
    for (const t of e.changedTouches) {
      if (t.target.closest?.(".tbtn, button, a, dialog, .card, #prompt")) continue;
      if (t.clientX < innerWidth * 0.45 && joyId === null) {
        joyId = t.identifier; joyC = { x: t.clientX, y: t.clientY };
        joy.style.left = t.clientX - 60 + "px"; joy.style.top = t.clientY - 60 + "px"; joy.classList.add("on");
      } else if (lookId === null) { lookId = t.identifier; lookP = { x: t.clientX, y: t.clientY }; }
    }
  }, { passive: true });
  addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        let dx = (t.clientX - joyC.x) / 50, dy = (t.clientY - joyC.y) / 50;
        const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        tmove.x = dx; tmove.y = -dy;
        knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
      } else if (t.identifier === lookId) {
        st.look.x += (t.clientX - lookP.x) * 1.6; st.look.y += (t.clientY - lookP.y) * 1.6;
        lookP = { x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: true });
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; tmove.x = tmove.y = 0; knob.style.transform = ""; joy.classList.remove("on"); }
      if (t.identifier === lookId) lookId = null;
    }
  };
  addEventListener("touchend", endTouch);
  addEventListener("touchcancel", endTouch);
  const hold = {};
  document.querySelectorAll("[data-btn]").forEach((b) => {
    const k = b.dataset.btn;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); hold[k] = true; pressed.add("btn-" + k); });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => (hold[k] = false));
  });
  // touch: tapping the on-screen prompt performs the action (ride, open, board)
  document.getElementById("prompt")?.addEventListener("pointerdown", (e) => {
    if (!st.touch) return;
    e.preventDefault();
    pressed.add("btn-act");
  });

  st.poll = () => {
    const k = (c) => keys.has(c);
    let x = (k("KeyD") || k("ArrowRight") ? 1 : 0) - (k("KeyA") || k("ArrowLeft") ? 1 : 0);
    let y = (k("KeyW") || k("ArrowUp") ? 1 : 0) - (k("KeyS") || k("ArrowDown") ? 1 : 0);
    if (tmove.x || tmove.y) { x = tmove.x; y = tmove.y; }
    st.move.x = x; st.move.y = y;
    st.sprint = k("ShiftLeft") || k("ShiftRight") || !!hold.run;
    st.walk = k("AltLeft") || k("KeyC");
    st.brake = k("Space") || !!hold.jump;
    st.jump = pressed.has("Space") || pressed.has("btn-jump");
    st.act = pressed.has("KeyE") || pressed.has("Enter") || pressed.has("btn-act");
    st.punch = pressed.has("KeyF") || pressed.has("Click") || pressed.has("btn-punch");
    st.map = pressed.has("KeyM") || pressed.has("btn-map");
    st.help = pressed.has("KeyH");
    st.escape = pressed.has("Escape");
    pressed.clear();
  };
  st.consumeLook = () => { const l = { ...st.look }; st.look.x = st.look.y = 0; const z = st.zoom || 0; st.zoom = 0; return { ...l, zoom: z }; };
  st.clear = () => { keys.clear(); pressed.clear(); };
  return st;
}
