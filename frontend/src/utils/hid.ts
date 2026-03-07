// Mapping JS KeyboardEvent.code to USB HID keycodes
// https://gist.github.com/MightyPork/6da26e382a7ad91b5496ee55fdc73db2

export const KEY_CODE_TO_HID: Record<string, number> = {
  KeyA: 4, KeyB: 5, KeyC: 6, KeyD: 7, KeyE: 8, KeyF: 9, KeyG: 10, KeyH: 11,
  KeyI: 12, KeyJ: 13, KeyK: 14, KeyL: 15, KeyM: 16, KeyN: 17, KeyO: 18, KeyP: 19,
  KeyQ: 20, KeyR: 21, KeyS: 22, KeyT: 23, KeyU: 24, KeyV: 25, KeyW: 26, KeyX: 27,
  KeyY: 28, KeyZ: 29,
  Digit1: 30, Digit2: 31, Digit3: 32, Digit4: 33, Digit5: 34,
  Digit6: 35, Digit7: 36, Digit8: 37, Digit9: 38, Digit0: 39,
  Enter: 40, Escape: 41, Backspace: 42, Tab: 43, Space: 44,
  Minus: 45, Equal: 46, BracketLeft: 47, BracketRight: 48, Backslash: 49,
  // 50 non-US # and ~
  Semicolon: 51, Quote: 52, Backquote: 53, Comma: 54, Period: 55, Slash: 56,
  CapsLock: 57,
  F1: 58, F2: 59, F3: 60, F4: 61, F5: 62, F6: 63,
  F7: 64, F8: 65, F9: 66, F10: 67, F11: 68, F12: 69,
  PrintScreen: 70, ScrollLock: 71, Pause: 72, Insert: 73, Home: 74, PageUp: 75,
  Delete: 76, End: 77, PageDown: 78,
  ArrowRight: 79, ArrowLeft: 80, ArrowDown: 81, ArrowUp: 82,
  NumLock: 83, NumpadDivide: 84, NumpadMultiply: 85, NumpadSubtract: 86, NumpadAdd: 87,
  NumpadEnter: 88, Numpad1: 89, Numpad2: 90, Numpad3: 91, Numpad4: 92, Numpad5: 93,
  Numpad6: 94, Numpad7: 95, Numpad8: 96, Numpad9: 97, Numpad0: 98, NumpadDecimal: 99
};

export const getModifiersByte = (e: KeyboardEvent | MouseEvent): number => {
  let mod = 0;
  if (e.ctrlKey) mod |= 1;      // Left Ctrl
  if (e.shiftKey) mod |= 2;     // Left Shift
  if (e.altKey) mod |= 4;       // Left Alt
  if (e.metaKey) mod |= 8;      // Left GUI/Meta
  // Note: we can't easily distinguish generic e.shiftKey from right shift in some browsers without e.code
  // but for basic KVM, left modifier is sufficient
  return mod;
};

const MODIFIER_CODES = new Set([
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 
  'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'
]);

// Returns standard format for backend websocket
export const createKeyboardEventMessage = (e: KeyboardEvent, isDown: boolean) => {
  const code = KEY_CODE_TO_HID[e.code];
  const modifiers = getModifiersByte(e);
  
  // If it's a completely unknown key, ignore it. 
  // We explicitly check MODIFIER_CODES so we don't drop the keyup event when a modifier is released 
  // (which would have code=undefined and modifiers=0).
  if (!code && !MODIFIER_CODES.has(e.code)) return null;

  // In Go, []byte in a standard JSON struct unmarshals from a Base64 encoded string.
  // The test script worked because it passed the struct, which Go marshaled to Base64 automatically over WS,
  // but from JS, we are sending a raw number array `[4]`. We need to use base64 exactly like Go does.
  const keysArray = isDown && code ? [code] : [];
  // Convert JS number array to Uint8Array, then to base64 string
  const base64Keys = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(keysArray))));

  return {
    type: "keyboard",
    data: {
      modifiers: modifiers,
      keys: base64Keys 
    }
  };
};

export const createMouseEventMessage = (
  buttons: number, // Web buttons: 1:Left, 2:Right, 4:Middle
  dx: number,
  dy: number,
  wheel: number
) => {
  // Scale the raw movement to make it usable (raw browser `movementX/Y` is 1-3 pixels per event, 
  // which is very slow without OS acceleration).
  // Changed back to 1.0 now that the 4-byte descriptor works properly.
  const scale = 1.0; 
  
  // Calculate scaled movement and constrain it to an 8-bit signed integer [-127, 127]
  const scaledX = Math.round(Math.max(-127, Math.min(127, dx * scale)));
  const scaledY = Math.round(Math.max(-127, Math.min(127, dy * scale)));

  // HID standard is:
  // Bit 0: Left (Value 1)
  // Bit 1: Right (Value 2)
  // Bit 2: Middle (Value 4)
  // e.buttons matches this exactly! 
  // However, `MouseEvent.button` (singular) is different, but we use `e.buttons` (plural) from MouseEvent during mousemove/down
  return {
    type: "mouse",
    data: {
      buttons: buttons,
      x: scaledX,           // Sent as int8 on Go side
      y: scaledY,           // Sent as int8 on Go side
      wheel: wheel          // Sent as int8 on Go side
    }
  };
};
