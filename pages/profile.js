import { supabase } from '../lib/supabaseClient';
import {useEffect, useState } from 'react';

export default function ProfilePage() {
  const [profile, setProfile] = useState({ display_name: '', ical_url: ''});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Not logged in');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        alert(error.message);
      } else if (data) {
        setProfile(data);
      }

      setLoading(false);
    };

    fetchProfile();
  }, []);

  const updateProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const updates = {
      id: user.id,
      display_name: profile.display_name,
      ical_url: profile.ical_url
    };

    const { error } = await supabase.from('profiles').upsert(updates);
    if (error) alert(error.message);
    else alert('Profile updated!');
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h2>My Profile</h2>

      <input
        type="text"
        placeholder="Display Name"
        value={profile.display_name}
        onChange={e => setProfile({ ...profile, display_name: e.target.value })}
      /><br /><br />

      <input
        type="text"
        placeholder="iCal URL"
        value={profile.ical_url}
        onChange={e => setProfile({ ...profile, ical_url: e.target.value })}
      /><br /><br />

      <button onClick={updateProfile}>Save Profile</button>
    </div>
  );
}
