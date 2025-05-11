import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';
import {useEffect, useState } from 'react';

export default function ProfilePage() {
  const [profile, setProfile] = useState({ display_name: '', ical_url: ''});
  const [connections, setConnections] = useState([]);
  const [friendNames, setFriendNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friendEmail, setFriendEmail] = useState('');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Not logged in');
        return;
      }

      setUserId(user.id);

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

      await fetchConnections(user.id);

      setLoading(false);
    };

    fetchProfile();
  }, []);

  const fetchName = async(friendId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', friendId)
      .single();
    if (error) alert(error.message);
    else return data?.display_name;
  }

  const fetchConnections = async(currUserID) => {
    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .or(`user1.eq.${currUserID},user2.eq.${currUserID}`);

    if (error) {
      console.log("error");
    } else {
      setConnections(data);
    }
    const friendIds = data.map(conn => 
      conn.user1 === currUserID ? conn.user2 : conn.user1
    );

    const uniqueFriendIds = [...new Set(friendIds)]; // deduplicate

    const namesMap = {};
    for (let fid of uniqueFriendIds) {
      const name = await fetchName(fid);
      namesMap[fid] = name || 'Unknown';
    }

    setFriendNames(namesMap);

  };


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

  const addFriend = async () => {
    if (!friendEmail) {
      alert("enter an email");
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('display_name', friendEmail)
      .single();

    if (error || !data) {
      alert('user not found');
      return;
    }

    const friendId = data.id;

    if (friendId == userId) {
      alert("nuh uh");
      return;
    }

    const [user1, user2] = userId>friendId ? [userId, friendId] : [friendId, userId];

    const { error: insertError } = await supabase.from('connections').upsert([
      {user1, user2, status: 'pending', initiator: userId}
    ]);

    if (insertError) {
      alert(insertError.message);
    } else {
      alert('request sent');
      await fetchConnections(userId);
      setFriendEmail('');
    }

  };

  const acceptRequest = async (conn) => {
    const { error } = await supabase
      .from('connections')
      .update({status:'accepted'})
      .eq('user1', conn.user1)
      .eq('user2', conn.user2);
    if (error) alert(error.message);
    else await fetchConnections(userId);
  }

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

      <button onClick={updateProfile}>Save Profile</button>&nbsp;
      <Link href=".">
        <button>Home</button>
      </Link>
      <h2> Friends </h2>
      <input
        type="text"
        placeholder="friend email"
        value={friendEmail}
        onChange={e => setFriendEmail(e.target.value)}
      /><br />
      <button onClick={addFriend}>send request</button>&nbsp;

      <ul>
        {connections.map(conn => {
          const friendId = conn.user1 === userId ? conn.user2 : conn.user1;
          const isSender = conn.initiator === userId;
          const isPending = conn.status === 'pending';
          const friendName = fetchName(friendId);
          return (
            <li key={`${conn.user1}-${conn.user2}`} style={{ marginBottom: '10px' }}>
              Friend: {friendNames[friendId]} <br />
              Status: {conn.status} <br />

              {isPending && !isSender && (
                <>
                  <button onClick={() => acceptRequest(conn)}>Accept</button>&nbsp;
                </>
              )}

              {isPending && isSender && (
                <>
                  <em>Pending (waiting for them)</em>&nbsp;
                </>
              )}

              {!isPending && (
                <>
                  <em>Connected</em>&nbsp;
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}







