import { Ref, onMounted, onBeforeUnmount } from "vue";
import {
  createKeyboardEventMessage,
  createMouseEventMessage,
} from "../utils/hid";

export function usePlayerInput(
  videoRef: Ref<HTMLVideoElement | null>,
  isCaptured: Ref<boolean>,
  sendHIDMessage: (msg: any) => void,
  emit: (e: "capture-change", captured: boolean) => void,
) {
  let accX = 0;
  let accY = 0;
  let lastButtons = 0;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isCaptured.value) return;

    // Allow browser shortcuts
    if (["F5", "F12"].includes(e.code)) return;

    // Custom exit shortcut: Shift + Escape
    if (e.code === "Escape" && e.shiftKey) {
      e.preventDefault();
      stopCapture();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const msg = createKeyboardEventMessage(e, true);
    if (msg) sendHIDMessage(msg);
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (!isCaptured.value) return;
    if (["F5", "F12"].includes(e.code)) return;
    if (e.code === "Escape" && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const msg = createKeyboardEventMessage(e, false);
    if (msg) sendHIDMessage(msg);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isCaptured.value || !videoRef.value) return;
    e.preventDefault();

    if (e.movementX === 0 && e.movementY === 0) return;

    const v = videoRef.value;
    const cw = v.clientWidth;
    const ch = v.clientHeight;
    const vw = v.videoWidth;
    const vh = v.videoHeight;

    if (cw === 0 || ch === 0 || vw === 0 || vh === 0) return;

    const scaleX = vw / cw;
    const scaleY = vh / ch;

    accX += e.movementX * scaleX;
    accY += e.movementY * scaleY;
    lastButtons = e.buttons;

    // Send if we have moved at least 1 pixel
    if (Math.abs(accX) >= 1 || Math.abs(accY) >= 1) {
      const finalX = Math.round(accX);
      const finalY = Math.round(accY);

      if (finalX !== 0 || finalY !== 0) {
        const msg = createMouseEventMessage(lastButtons, finalX, finalY, 0);
        sendHIDMessage(msg);
        accX -= finalX;
        accY -= finalY;
      }
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!isCaptured.value) return;
    e.preventDefault();
    lastButtons = e.buttons;
    const msg = createMouseEventMessage(lastButtons, 0, 0, 0);
    sendHIDMessage(msg);
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isCaptured.value) return;
    e.preventDefault();
    lastButtons = e.buttons;
    const msg = createMouseEventMessage(lastButtons, 0, 0, 0);
    sendHIDMessage(msg);
  };

  const handleWheel = (e: WheelEvent) => {
    if (!isCaptured.value) return;
    e.preventDefault();
    const wheelVal = e.deltaY > 0 ? -1 : 1;
    const msg = createMouseEventMessage(e.buttons, 0, 0, wheelVal);
    sendHIDMessage(msg);
  };

  const handleContextMenu = (e: Event) => {
    e.preventDefault();
  };

  const startCapture = () => {
    isCaptured.value = true;
    emit("capture-change", true);
    videoRef.value?.focus();

    try {
      videoRef.value?.requestPointerLock();
    } catch (err) {
      console.error("Pointer Lock failed:", err);
    }

    // Try to lock the keyboard so we can intercept ESC and system keys
    if ('keyboard' in navigator && (navigator as any).keyboard && (navigator as any).keyboard.lock) {
      (navigator as any).keyboard.lock(['Escape']).catch((err: any) => {
        console.warn('Keyboard lock failed (Escape might still exit pointer lock):', err)
      })
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
  };

  const stopCapture = () => {
    if (!isCaptured.value) return;
    isCaptured.value = false;
    emit("capture-change", false);

    if (document.pointerLockElement === videoRef.value) {
      document.exitPointerLock();
    }

    if ('keyboard' in navigator && (navigator as any).keyboard && (navigator as any).keyboard.unlock) {
      (navigator as any).keyboard.unlock()
    }

    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };

  const handlePointerLockChange = () => {
    if (document.pointerLockElement !== videoRef.value && isCaptured.value) {
      // If pointer lock is lost (e.g. by pressing ESC), stop capture
      stopCapture();
    }
  };

  onMounted(() => {
    document.addEventListener("pointerlockchange", handlePointerLockChange);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    stopCapture();
  });

  return {
    startCapture,
    stopCapture,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleWheel,
    handleContextMenu,
  };
}
