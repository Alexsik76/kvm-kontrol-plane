import { ref, Ref } from "vue";

export function useFullscreen(videoRef: Ref<HTMLVideoElement | null>) {
  const isFullscreen = ref(false);

  const toggleFullscreen = async () => {
    const video = videoRef.value;
    if (!video) return;

    // We fullscreen the parent container if possible to keep the overlay visible
    const container = video.parentElement || video;

    if (!document.fullscreenElement) {
      try {
        await container.requestFullscreen();
      } catch (err) {
        console.error("Failed to enter fullscreen:", err);
      }
    } else {
      document.exitFullscreen();
    }
  };

  const lockKeyboard = (isCaptured: boolean) => {
    if (
      isFullscreen.value &&
      isCaptured &&
      "keyboard" in navigator &&
      (navigator as any).keyboard.lock
    ) {
      (navigator as any).keyboard
        .lock([
          "Escape",
          "Tab",
          "AltLeft",
          "AltRight",
          "MetaLeft",
          "MetaRight",
        ])
        .catch((e: any) => console.warn("Keyboard lock failed:", e));
    }
  };

  const unlockKeyboard = () => {
    if ("keyboard" in navigator && (navigator as any).keyboard.unlock) {
      (navigator as any).keyboard.unlock();
    }
  };

  const handleFullscreenChange = (isCaptured: boolean) => {
    isFullscreen.value = !!document.fullscreenElement;

    if (!isFullscreen.value) {
      unlockKeyboard();
    } else if (isCaptured) {
      lockKeyboard(true);
    }
  };

  return {
    isFullscreen,
    toggleFullscreen,
    lockKeyboard,
    unlockKeyboard,
    handleFullscreenChange,
  };
}
