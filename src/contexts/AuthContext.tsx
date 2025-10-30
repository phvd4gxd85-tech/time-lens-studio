import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  videos: number;
  images: number;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [videos, setVideos] = useState(0);
  const [images, setImages] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refreshCredits = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    const { data } = await supabase
      .from('user_tokens')
      .select('videos, images')
      .eq('user_id', session.user.id)
      .single();
    
    if (data) {
      setVideos(data.videos);
      setImages(data.images);
    }
  };

  const fetchCreditsForUser = async (userId: string) => {
    const { data } = await supabase
      .from('user_tokens')
      .select('videos, images')
      .eq('user_id', userId)
      .single();
    
    if (data) {
      setVideos(data.videos);
      setImages(data.images);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch credits immediately
        if (session?.user) {
          setTimeout(() => {
            fetchCreditsForUser(session.user.id);
          }, 0);
        } else {
          setVideos(0);
          setImages(0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        setTimeout(() => {
          fetchCreditsForUser(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      return { error: error.message };
    }
    
    navigate('/');
    return { error: null };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Get user's IP address for trial limiting
    let ipAddress = 'unknown';
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      ipAddress = ipData.ip;
    } catch (error) {
      console.warn('Could not fetch IP address:', error);
    }
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          ip_address: ipAddress
        }
      }
    });
    
    if (error) {
      return { error: error.message };
    }
    
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setVideos(0);
    setImages(0);
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, session, videos, images, loading, signIn, signUp, signOut, refreshCredits }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
