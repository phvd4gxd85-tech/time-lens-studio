import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const PromptAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: { messages: newMessages }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Fel",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setMessages([...newMessages, { role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Fel",
        description: "Kunde inte få svar från assistenten",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center z-50 group"
        aria-label="Öppna prompt-assistent"
      >
        <MessageCircle className="w-7 h-7 text-white" />
        <span className="absolute -top-12 right-0 bg-gray-900 text-amber-100 px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Få hjälp med din prompt 💡
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-gray-900 border-2 border-amber-600/40 rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-600 to-amber-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-white" />
          <h3 className="text-white font-bold">Prompt-Assistent</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="text-white hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-amber-200/60 text-sm space-y-2">
            <p className="font-bold text-amber-100">Hej! 👋</p>
            <p>Jag hjälper dig att skriva bättre prompts för video och bilder.</p>
            <p>Du kan:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Klistra in din prompt och få feedback</li>
              <li>Fråga om tips för bättre resultat</li>
              <li>Få förslag på förbättringar</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`${
                  msg.role === 'user'
                    ? 'bg-amber-600/20 ml-8'
                    : 'bg-gray-800 mr-8'
                } p-3 rounded-lg`}
              >
                <div className="text-xs text-amber-400 mb-1 font-bold">
                  {msg.role === 'user' ? 'Du' : 'Assistent'}
                </div>
                <div className="text-amber-100 text-sm whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="bg-gray-800 mr-8 p-3 rounded-lg flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="text-amber-200 text-sm">Tänker...</span>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-amber-600/20">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Skriv din prompt eller fråga..."
            className="min-h-[60px] bg-gray-800 border-amber-600/30 text-amber-100 placeholder:text-amber-200/40 resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-amber-600 hover:bg-amber-700 text-white self-end"
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-amber-200/40 mt-2">
          Tryck Enter för att skicka, Shift+Enter för ny rad
        </p>
      </div>
    </div>
  );
};
