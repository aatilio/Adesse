import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

let addToastFn = null;

export const toast = {
  success: (msg) => addToastFn?.({ msg, type: 'success' }),
  error:   (msg) => addToastFn?.({ msg, type: 'error' }),
  info:    (msg) => addToastFn?.({ msg, type: 'info' }),
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    addToastFn = ({ msg, type }) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, msg, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    };
    return () => { addToastFn = null; };
  }, []);

  const icons = { success: CheckCircle, error: XCircle, info: Info };

  return (
    <div className="toast-container">
      {toasts.map(t => {
        const Icon = icons[t.type];
        return (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon size={16} />
            {t.msg}
          </div>
        );
      })}
    </div>
  );
}
