import { useEffect } from "react";
import { Icon } from "./Icon";

export function Modal({ title, children, onClose }) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal__header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Toast({ message, onDismiss }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 2800);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="toast" role="status">
      <span className="toast__icon"><Icon name="check" size={15} /></span>
      {message}
    </div>
  );
}

