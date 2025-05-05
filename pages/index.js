import { supabase } from '../lib/supabaseClient';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) fetchProfile(user.id);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser) fetchProfile(newUser.id);
      else setProfileName(null);
    });

    getUser();

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error.message);
    } else if (data && data.display_name) {
      setProfileName(data.display_name);
    } else {
      setProfileName(null);
    }
  };

  const signUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Check your email for confirmation link');
  };

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else alert('Logged in');
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Welcome!</h1>

      {user ? (
        <>
          <p>Logged in as <strong>{profileName || user.email}</strong></p>

          <Link href="/profile">
            <button>My Profile</button>
          </Link>&nbsp;
          <button onClick={signOut}>Log Out</button>
        </>
      ) : (
        <>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          /><br /><br />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          /><br /><br />

          <button onClick={signIn}>Log In</button> &nbsp;
          <button onClick={signUp}>Sign Up</button>
        </>
      )}
    </div>
  );
}

