// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

type ShortcutMap = Record<string, () => void>;

export const useKeyboardShortcuts = (shortcuts: ShortcutMap) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as HTMLElement)?.contentEditable === 'true'
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
      
      let shortcutKey = '';
      
      if (cmdOrCtrl) shortcutKey += 'cmd+';
      if (event.altKey) shortcutKey += 'alt+';
      if (event.shiftKey) shortcutKey += 'shift+';
      shortcutKey += event.key.toLowerCase();

      const handler = shortcuts[shortcutKey];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};