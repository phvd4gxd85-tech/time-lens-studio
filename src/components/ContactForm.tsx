import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send } from 'lucide-react';

const ContactForm = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-contact', {
        body: { name, email, message },
      });

      if (error) throw error;

      toast({
        title: language === 'sv' ? 'Meddelande skickat!' : 'Message sent!',
        description: language === 'sv' ? 'Vi återkommer så snart vi kan.' : 'We\'ll get back to you soon.',
      });
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      toast({
        title: language === 'sv' ? 'Något gick fel' : 'Something went wrong',
        description: language === 'sv' ? 'Försök igen senare.' : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative py-16 px-4 bg-gradient-to-br from-gray-900 via-amber-950/20 to-gray-900">
      <div className="max-w-xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-amber-100 mb-2 text-center">
          {language === 'sv' ? 'Kontakta oss' : 'Contact Us'}
        </h2>
        <p className="text-amber-200/60 text-center mb-8">
          {language === 'sv' ? 'Har du frågor eller problem? Skicka ett meddelande!' : 'Have questions or issues? Send us a message!'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder={language === 'sv' ? 'Ditt namn' : 'Your name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-black/40 border border-amber-600/30 text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-500 transition"
          />
          <input
            type="email"
            placeholder={language === 'sv' ? 'Din e-post' : 'Your email'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-black/40 border border-amber-600/30 text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-500 transition"
          />
          <textarea
            placeholder={language === 'sv' ? 'Ditt meddelande...' : 'Your message...'}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={4}
            className="w-full px-4 py-3 rounded-lg bg-black/40 border border-amber-600/30 text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:border-amber-500 transition resize-none"
          />
          <button
            type="submit"
            disabled={sending}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-700 to-amber-600 text-white font-semibold hover:from-amber-600 hover:to-amber-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sending
              ? (language === 'sv' ? 'Skickar...' : 'Sending...')
              : (language === 'sv' ? 'Skicka meddelande' : 'Send message')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactForm;
