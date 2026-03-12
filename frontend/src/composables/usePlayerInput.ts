import { Ref, onMounted, onBeforeUnmount } from "vue";
import {
  createKeyboardEventMessage,
  createMouseEventMessage,
  resetKeyboardState,
} from "../utils/hid";

export function usePlayerInput(
  videoRef: Ref<HTMLVideoElement | null>,
  isCaptured: Ref<boolean>,
  sendHIDMessage: (msg: any) => void,
  emit: (e: "capture-change", captured: boolean) => void,
  connectHID?: () => void,
) {
  let accX = 0;
  let accY = 0;
  let lastButtons = 0;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isCaptured.value) return;

    // Remote Escape via Alt + Escape
    if (e.code === "Escape" && e.altKey) {
      e.preventDefault();
      e.stopPropagation();

      // Create a fake event object to trick our HID utility
      // or manually send the Escape code
      const msg = createKeyboardEventMessage(
        {
          code: "Escape",
          key: "Escape",
          altKey: false,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
        } as KeyboardEvent,
        true,
      );

      if (msg) sendHIDMessage(msg);
      return;
    }

    // Regular Escape - let the browser handle it (exit capture)
    if (e.code === "Escape") {
      return;
    }

    // Rest of your key handling logic...
    if (["F5", "F12"].includes(e.code)) return;

    e.preventDefault();
    const msg = createKeyboardEventMessage(e, true);
    if (msg) sendHIDMessage(msg);
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (!isCaptured.value) return;

    if (e.code === "Escape" && e.altKey) {
      e.preventDefault();
      e.stopPropagation();

      const msg = createKeyboardEventMessage(
        {
          code: "Escape",
          key: "Escape",
          altKey: false,
        } as KeyboardEvent,
        false,
      );

      if (msg) sendHIDMessage(msg);
      return;
    }

    if (e.code === "Escape") return;

    // Rest of your keyup logic...
    e.preventDefault();
    const msg = createKeyboardEventMessage(e, false);
    if (msg) sendHIDMessage(msg);
  };

  let accWheel = 0;
  let rafId: number | null = null;

  const flushMovement = () => {
    if (Math.abs(accX) >= 1 || Math.abs(accY) >= 1 || accWheel !== 0) {
      const finalX = Math.round(accX);
      const finalY = Math.round(accY);
      const finalWheel = accWheel;

      const msg = createMouseEventMessage(lastButtons, finalX, finalY, finalWheel);
      sendHIDMessage(msg);
      
      accX -= finalX;
      accY -= finalY;
      accWheel = 0;
    }
    rafId = requestAnimationFrame(flushMovement);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isCaptured.value) return;
    
    // We don't preventDefault on mousemove as it's not strictly needed for HID
    // and can sometimes cause performance issues in older browsers

    if (e.movementX === 0 && e.movementY === 0) return;

    const video = videoRef.value;
    let scaleX = 1;
    let scaleY = 1;

    if (video && video.clientWidth > 0 && video.clientHeight > 0) {
      scaleX = video.videoWidth / video.clientWidth;
      scaleY = video.videoHeight / video.clientHeight;
    }

    const sensitivity = 1.5;
    accX += e.movementX * scaleX * sensitivity;
    accY += e.movementY * scaleY * sensitivity;
    lastButtons = e.buttons;
    
    // Movement is now flushed via requestAnimationFrame
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!isCaptured.value) return;
    e.preventDefault();

    if (document.pointerLockElement !== videoRef.value) {
      try {
        videoRef.value?.requestPointerLock();
      } catch (err) {}
    }

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
    accWheel += e.deltaY > 0 ? -1 : 1;
    lastButtons = e.buttons;
  };

  const handleContextMenu = (e: Event) => {
    e.preventDefault();
  };

  const startCapture = () => {
    if (connectHID) {
      connectHID();
    }

    isCaptured.value = true;
    emit("capture-change", true);
    videoRef.value?.focus();

    try {
      videoRef.value?.requestPointerLock();
    } catch (err) {
      console.error("Pointer Lock failed:", err);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    // Start movement flushing loop
    if (!rafId) {
      rafId = requestAnimationFrame(flushMovement);
    }
  };

  const stopCapture = () => {
    if (!isCaptured.value) return;
    isCaptured.value = false;
    emit("capture-change", false);

    // Stop movement flushing loop
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // Reset accumulators
    accX = 0;
    accY = 0;
    accWheel = 0;

    sendHIDMessage(resetKeyboardState());
    sendHIDMessage({
      type: "mouse",
      data: { buttons: 0, x: 0, y: 0, wheel: 0 },
    });

    if (document.pointerLockElement === videoRef.value) {
      document.exitPointerLock();
    }

    if (
      "keyboard" in navigator &&
      (navigator as any).keyboard &&
      (navigator as any).keyboard.unlock
    ) {
      (navigator as any).keyboard.unlock();
    }

    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };

  const handlePointerLockChange = () => {
    // If the browser natively exited pointer lock (usually via Esc),
    // and we are still "captured", we should drop capture immediately.
    // Otherwise the user has to press Esc again to actually fire our stopCapture.
    if (!document.pointerLockElement && isCaptured.value) {
      stopCapture();
    }
  };

  const handleWindowBlur = () => {
    stopCapture();
  };

  onMounted(() => {
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    window.addEventListener("blur", handleWindowBlur);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    window.removeEventListener("blur", handleWindowBlur);
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
