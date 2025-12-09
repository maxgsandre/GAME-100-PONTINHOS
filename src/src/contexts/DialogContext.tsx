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

  // Helper to ensure message is always a string
  const ensureString = (value: any): string => {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      // If it's an object, try to get a message property or stringify it
      if ('message' in value && typeof value.message === 'string') {
        return value.message;
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  const confirm = useCallback((opts: DialogOptions | any): Promise<boolean> => {
    return new Promise((resolve) => {
      // Handle case where opts itself might be a string or object
      const normalizedOpts: DialogOptions = typeof opts === 'string' 
        ? { message: opts }
        : {
            title: opts?.title || 'Atenção',
            message: ensureString(opts?.message || opts || ''),
            confirmText: opts?.confirmText,
            cancelText: opts?.cancelText,
            variant: opts?.variant || 'default',
          };
      
      setOptions(normalizedOpts);
      setIsAlert(false);
      setIsOpen(true);
      setResolvePromise(() => resolve);
    });
  }, []);

  const alert = useCallback((opts: DialogOptions | any): Promise<void> => {
    return new Promise((resolve) => {
      // Handle case where opts itself might be a string or object
      const normalizedOpts: DialogOptions = typeof opts === 'string' 
        ? { message: opts }
        : {
            title: opts?.title || 'Atenção',
            message: ensureString(opts?.message || opts || ''),
            confirmText: opts?.confirmText,
            cancelText: undefined,
            variant: opts?.variant || 'default',
          };
      
      setOptions(normalizedOpts);
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
              {String(options.message || '')}
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

