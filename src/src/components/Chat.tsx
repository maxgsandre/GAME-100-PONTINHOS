import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { subscribeToChat, sendChatMessage, ChatMessage } from '../lib/firestoreGame';
import { useAppStore } from '../app/store';

interface ChatProps {
  roomId: string;
  className?: string;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  onMessageCountChange?: (count: number) => void;
}

export function Chat({ roomId, className = '', isOpen: externalIsOpen, onToggle, onMessageCountChange }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [lastViewedCount, setLastViewedCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { userId } = useAppStore();

  // Use external state if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onToggle) {
      onToggle(open);
    } else {
      setInternalIsOpen(open);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeToChat(roomId, setMessages);
    return () => unsubscribe();
  }, [roomId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // When chat opens, mark all current messages as viewed
  useEffect(() => {
    if (isOpen) {
      setLastViewedCount(messages.length);
    }
  }, [isOpen, messages.length]);

  // Calculate unread message count
  const unreadCount = messages.length > lastViewedCount ? messages.length - lastViewedCount : 0;

  // Notify parent of unread message count changes
  useEffect(() => {
    if (onMessageCountChange) {
      onMessageCountChange(unreadCount);
    }
  }, [unreadCount, onMessageCountChange]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    try {
      setSending(true);
      await sendChatMessage(roomId, inputText);
      setInputText('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // If chat is closed and onMessageCountChange is provided, render nothing (button is in header)
  if (!isOpen && onMessageCountChange) {
    return null;
  }

  // If chat is closed, show default floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 right-4 bg-green-600 hover:bg-green-700 text-white rounded-full p-4 shadow-lg transition-all ${className}`}
        aria-label="Abrir chat"
      >
        <MessageSquare size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* Overlay para fechar ao clicar fora */}
      <div
        className="fixed inset-0 bg-black/20 z-[9998]"
        onClick={() => setIsOpen(false)}
      />
      <div className={`fixed bottom-4 right-4 w-80 h-96 bg-white rounded-lg shadow-2xl flex flex-col border border-gray-200 z-[9999] ${className}`}>
        {/* Header */}
        <div className="bg-green-600 text-white p-3 rounded-t-lg flex justify-between items-center">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare size={20} />
            Chat
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            className="hover:bg-green-700 rounded px-2 py-1 transition-colors"
            aria-label="Fechar chat"
          >
            ✕
          </button>
        </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-4">
            Nenhuma mensagem ainda. Seja o primeiro a falar!
          </p>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.uid === userId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    isOwnMessage
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  {!isOwnMessage && (
                    <p className="text-xs font-semibold mb-1 opacity-80">
                      {msg.name}
                    </p>
                  )}
                  <p className="text-sm break-words">{msg.text}</p>
                  <p className={`text-xs mt-1 ${isOwnMessage ? 'text-green-100' : 'text-gray-500'}`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-white rounded-b-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Digite uma mensagem..."
            maxLength={200}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900 placeholder:text-gray-400"
            style={{ color: '#111827' }}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Enviar mensagem"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
    </>
  );
}

