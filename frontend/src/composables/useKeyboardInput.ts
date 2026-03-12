import { Ref } from "vue";
import { createKeyboardEventMessage } from "../utils/hid";

export function useKeyboardInput(
  isCaptured: Ref<boolean>,
  isFullscreen: Ref<boolean>,
  sendHIDMessage: (msg: any) => void
) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isCaptured.value) return;

    // Remote Escape via Alt + Backtick (~)
    if (e.code === "Backquote" && e.altKey) {
      e.preventDefault();
      e.stopPropagation();

      const msg = createKeyboardEventMessage(
        {
          code: "Escape",
          key: "Escape",
          altKey: false,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
        } as KeyboardEvent,
        true
      );

      if (msg) sendHIDMessage(msg);
      return;
    }

    // Regular Escape handling
    if (e.code === "Escape") {
      if (!isFullscreen.value) return;
      e.preventDefault();
      const msg = createKeyboardEventMessage(e, true);
      if (msg) sendHIDMessage(msg);
      return;
    }

    if (["F5", "F12"].includes(e.code)) return;

    e.preventDefault();
    const msg = createKeyboardEventMessage(e, true);
    if (msg) sendHIDMessage(msg);
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (!isCaptured.value) return;

    if (e.code === "Backquote" && e.altKey) {
      e.preventDefault();
      e.stopPropagation();

      const msg = createKeyboardEventMessage(
        {
          code: "Escape",
          key: "Escape",
          altKey: false,
        } as KeyboardEvent,
        false
      );

      if (msg) sendHIDMessage(msg);
      return;
    }

    if (e.code === "Escape") {
      if (!isFullscreen.value) return;
      e.preventDefault();
      const msg = createKeyboardEventMessage(e, false);
      if (msg) sendHIDMessage(msg);
      return;
    }

    e.preventDefault();
    const msg = createKeyboardEventMessage(e, false);
    if (msg) sendHIDMessage(msg);
  };

  const sendCtrlAltDel = () => {
    const keys = ["ControlLeft", "AltLeft", "Delete"];
    keys.forEach((k) =>
      sendHIDMessage(createKeyboardEventMessage({ code: k } as any, true))
    );
    setTimeout(() => {
      keys.forEach((k) =>
        sendHIDMessage(createKeyboardEventMessage({ code: k } as any, false))
      );
    }, 50);
  };

  return {
    handleKeyDown,
    handleKeyUp,
    sendCtrlAltDel
  };
}
