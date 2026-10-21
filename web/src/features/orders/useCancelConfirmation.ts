import { useEffect, useRef, useState } from "react";

export function useCancelConfirmation() {
  const [confirming, setConfirming] = useState(false);
  const backButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) backButton.current?.focus();
  }, [confirming]);

  return {
    confirming,
    backButton,
    askConfirmation: () => setConfirming(true),
    dismiss: () => setConfirming(false),
  };
}
