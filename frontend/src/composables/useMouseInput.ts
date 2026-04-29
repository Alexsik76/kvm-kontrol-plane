import { Ref, watch, onBeforeUnmount } from "vue";
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

  // Cached scale — updated by ResizeObserver and video events, never read in hot path via layout
  let scaleX = 1;
  let scaleY = 1;
  let resizeObserver: ResizeObserver | null = null;

  const recomputeScale = () => {
    const video = videoRef.value;
    if (!video) return;
    const cw = video.clientWidth;
    const ch = video.clientHeight;
    if (video.videoWidth > 0 && cw > 0) scaleX = video.videoWidth / cw;
    if (video.videoHeight > 0 && ch > 0) scaleY = video.videoHeight / ch;
  };

  watch(videoRef, (video, oldVideo) => {
    if (oldVideo) {
      if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
      oldVideo.removeEventListener('resize', recomputeScale);
      oldVideo.removeEventListener('loadedmetadata', recomputeScale);
    }
    if (video) {
      recomputeScale();
      resizeObserver = new ResizeObserver(recomputeScale);
      resizeObserver.observe(video);
      // 'resize' на HTMLVideoElement спрацьовує при зміні videoWidth/videoHeight (нова роздільна здатність потоку)
      video.addEventListener('resize', recomputeScale);
      video.addEventListener('loadedmetadata', recomputeScale);
    }
  }, { immediate: true });

  onBeforeUnmount(() => {
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    const video = videoRef.value;
    if (video) {
      video.removeEventListener('resize', recomputeScale);
      video.removeEventListener('loadedmetadata', recomputeScale);
    }
  });

  const MAX_CHUNKS_PER_FRAME = 16;

  const flushMovement = () => {
    let chunks = 0;
    while (
      chunks < MAX_CHUNKS_PER_FRAME &&
      (Math.abs(accX) >= 1 || Math.abs(accY) >= 1 || accWheel !== 0)
    ) {
      const finalX = Math.max(-127, Math.min(127, Math.round(accX)));
      const finalY = Math.max(-127, Math.min(127, Math.round(accY)));
      const finalWheel = Math.max(-127, Math.min(127, accWheel));

      const msg = createMouseEventMessage(lastButtons, finalX, finalY, finalWheel);
      sendHIDMessage(msg);

      accX -= finalX;
      accY -= finalY;
      accWheel -= finalWheel;
      chunks++;
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
    if (!document.pointerLockElement) return;
    if (e.movementX === 0 && e.movementY === 0) return;

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
