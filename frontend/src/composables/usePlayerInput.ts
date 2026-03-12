import { Ref, onMounted, onBeforeUnmount } from "vue";
import { resetKeyboardState } from "../utils/hid";
import { useFullscreen } from "./useFullscreen";
import { useMouseInput } from "./useMouseInput";
import { useKeyboardInput } from "./useKeyboardInput";

export function usePlayerInput(
  videoRef: Ref<HTMLVideoElement | null>,
  isCaptured: Ref<boolean>,
  sendHIDMessage: (msg: any) => void,
  emit: (e: "capture-change", captured: boolean) => void,
  connectHID?: () => void,
) {
  const {
    isFullscreen,
    toggleFullscreen,
    lockKeyboard,
    unlockKeyboard,
    handleFullscreenChange: _handleFullscreenChange,
  } = useFullscreen(videoRef);

  const {
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleWheel,
    startMouseLoop,
    stopMouseLoop,
  } = useMouseInput(videoRef, isCaptured, sendHIDMessage);

  const { handleKeyDown, handleKeyUp, sendCtrlAltDel } = useKeyboardInput(
    isCaptured,
    isFullscreen,
    sendHIDMessage,
  );

  const startCapture = () => {
    if (connectHID) connectHID();

    isCaptured.value = true;
    emit("capture-change", true);
    videoRef.value?.focus();

    try {
      videoRef.value?.requestPointerLock();
    } catch (err) {
      console.error("Pointer Lock failed:", err);
    }

    startMouseLoop();
    lockKeyboard(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
  };

  const stopCapture = () => {
    if (!isCaptured.value) return;
    isCaptured.value = false;
    emit("capture-change", false);

    stopMouseLoop();
    unlockKeyboard();

    sendHIDMessage(resetKeyboardState());
    sendHIDMessage({
      type: "mouse",
      data: { buttons: 0, x: 0, y: 0, wheel: 0 },
    });

    if (document.pointerLockElement === videoRef.value) {
      document.exitPointerLock();
    }

    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };

  const handlePointerLockChange = () => {
    if (!document.pointerLockElement && isCaptured.value) {
      stopCapture();
    }
  };

  const handleWindowBlur = () => {
    stopCapture();
  };

  const onFullscreenChange = () => {
    _handleFullscreenChange(isCaptured.value);
  };

  onMounted(() => {
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("blur", handleWindowBlur);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    window.removeEventListener("blur", handleWindowBlur);
    stopCapture();
  });

  return {
    startCapture,
    stopCapture,
    toggleFullscreen,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleWheel,
    handleContextMenu: (e: Event) => e.preventDefault(),
    isFullscreen,
    sendCtrlAltDel,
  };
}
