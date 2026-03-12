import { Ref } from "vue";
import { createMouseEventMessage } from "../utils/hid";

export function useMouseInput(
  videoRef: Ref<HTMLVideoElement | null>,
  isCaptured: Ref<boolean>,
  sendHIDMessage: (msg: any) => void
) {
  let accX = 0;
  let accY = 0;
  let accWheel = 0;
  let lastButtons = 0;
  let rafId: number | null = null;

  const flushMovement = () => {
    if (Math.abs(accX) >= 1 || Math.abs(accY) >= 1 || accWheel !== 0) {
      const finalX = Math.max(-127, Math.min(127, Math.round(accX)));
      const finalY = Math.max(-127, Math.min(127, Math.round(accY)));
      const finalWheel = accWheel;

      const msg = createMouseEventMessage(lastButtons, finalX, finalY, finalWheel);
      sendHIDMessage(msg);

      accX -= finalX;
      accY -= finalY;
      accWheel = 0;
    }
    rafId = requestAnimationFrame(flushMovement);
  };

  const startMouseLoop = () => {
    if (!rafId) {
      rafId = requestAnimationFrame(flushMovement);
    }
  };

  const stopMouseLoop = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    accX = 0;
    accY = 0;
    accWheel = 0;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isCaptured.value) return;
    
    // Safety check: only send HID messages if pointer lock is active
    if (!document.pointerLockElement) return;

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
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!isCaptured.value) return;
    
    // If we are over the video and no pointer lock, try to acquire it
    if (!document.pointerLockElement) {
      try {
        videoRef.value?.requestPointerLock();
      } catch (err) {}
    }

    e.preventDefault();
    lastButtons = e.buttons;
    sendHIDMessage(createMouseEventMessage(lastButtons, 0, 0, 0));
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isCaptured.value) return;
    e.preventDefault();
    lastButtons = e.buttons;
    sendHIDMessage(createMouseEventMessage(lastButtons, 0, 0, 0));
  };

  const handleWheel = (e: WheelEvent) => {
    if (!isCaptured.value) return;
    e.preventDefault();
    accWheel += e.deltaY > 0 ? -1 : 1;
    lastButtons = e.buttons;
  };

  return {
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleWheel,
    startMouseLoop,
    stopMouseLoop
  };
}
