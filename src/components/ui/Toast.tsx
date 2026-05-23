import { useState } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { ToastType, useToast } from '../../contexts/ToastContext';

const toastStyles = {
    success: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        icon: <CheckCircle className="w-5 h-5 text-green-500" />,
    },
    error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        icon: <AlertCircle className="w-5 h-5 text-red-500" />,
    },
    info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        icon: <Info className="w-5 h-5 text-blue-500" />,
    },
    warning: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    },
};

interface ToastItemProps {
    id: string;
    message: string;
    type: ToastType;
}

function ToastItem({ id, message, type }: ToastItemProps) {
    const { removeToast } = useToast();
    const [isExiting, setIsExiting] = useState(false);
    const style = toastStyles[type];

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => removeToast(id), 300);
    };

    return (
        <div
            className={`
        flex items-center gap-3 p-4 rounded-lg border shadow-lg max-w-md w-full
        ${style.bg} ${style.border} ${style.text}
        transition-all duration-300 transform
        ${isExiting ? 'opacity-0 translate-x-10' : 'opacity-100 translate-x-0 animate-in slide-in-from-right-10'}
      `}
        >
            <div className="shrink-0">{style.icon}</div>
            <div className="flex-1 text-sm font-medium">{message}</div>
            <button
                onClick={handleClose}
                className="p-1 hover:bg-black/5 rounded-full transition-colors"
            >
                <X className="w-4 h-4 opacity-50 hover:opacity-100" />
            </button>
        </div>
    );
}

export function ToastContainer() {
    const { toasts } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <div className="pointer-events-auto flex flex-col gap-2">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} {...toast} />
                ))}
            </div>
        </div>
    );
}
