import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';

interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

interface DialogContextType {
  confirm: (opts: DialogOptions) => Promise<boolean>;
  alert: (opts: DialogOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions>({ message: '' });
  const [resolvePromise, setResolvePromise] = useState<((value: boolean | void) => void) | null>(null);
  const [isAlert, setIsAlert] = useState(false);

  const confirm = useCallback((opts: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(opts);
      setIsAlert(false);
      setIsOpen(true);
      setResolvePromise(() => resolve);
    });
  }, []);

  const alert = useCallback((opts: DialogOptions): Promise<void> => {
    return new Promise((resolve) => {
      setOptions({ ...opts, cancelText: undefined });
      setIsAlert(true);
      setIsOpen(true);
      setResolvePromise(() => {
        resolve();
        return () => {};
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(true);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      <AlertDialog open={isOpen} onOpenChange={(open) => !open && !isAlert && handleCancel()}>
        <AlertDialogContent className="bg-[#1a1a1a] border-gray-700 text-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl font-bold">
              {options.title || 'Atenção'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300 text-base">
              {options.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:flex-row sm:justify-end">
            {!isAlert && options.cancelText && (
              <AlertDialogCancel
                onClick={handleCancel}
                className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
              >
                {options.cancelText || 'Cancelar'}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                options.variant === 'destructive'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }
            >
              {options.confirmText || 'OK'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return context;
}

