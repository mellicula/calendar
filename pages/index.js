import { supabase } from '../lib/supabaseClient';
import { useState, useEffect } from 'react';
import CalendarWidget from '../components/cal'
import Link from 'next/link';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState(null);

  const [groupName, setGroupName] = useState('');
  const [selectedFriend, setSelectedFriend] = useState('');
  const [friendNames, setFriendNames] = useState([]);
  const [groups, setGroups] = useState([]);

  const [connections, setConnections] = useState([]);
  const [allFriendNames, setAllFriendNames] = useState({});

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        fetchProfile(user.id);
        fetchGroups(user.id);
        fetchConnections(user.id);
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser) {
        fetchProfile(newUser.id);
        fetchGroups(newUser.id);
        fetchConnections(newUser.id);
      } else {
        setProfileName(null);
        setGroups([]);
        setConnections([]);
        setAllFriendNames({});
      }
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

    if (!error && data) setProfileName(data.display_name);
  };

  const fetchName = async (friendId) => {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', friendId)
      .single();

    return data?.display_name || 'Unknown';
  };

  const fetchConnections = async (currUserID) => {
    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .or(`user1.eq.${currUserID},user2.eq.${currUserID}`);

    if (!error) {
      setConnections(data);
      const friendIds = data.map(conn =>
        conn.user1 === currUserID ? conn.user2 : conn.user1
      );

      const uniqueFriendIds = [...new Set(friendIds)];
      const namesMap = {};
      for (let fid of uniqueFriendIds) {
        const name = await fetchName(fid);
        namesMap[fid] = name;
      }
      namesMap[currUserID] = await fetchName(currUserID) + " (you)";
      setAllFriendNames(namesMap);
    }
  };

  const fetchGroups = async (userId) => {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('creator_id', userId);

    if (!error) {
      setGroups(data);
    }
  };

  const addPerson = () => {
    if (!selectedFriend) return;
    const name = allFriendNames[selectedFriend];
    if (!friendNames.includes(name)) {
      setFriendNames([...friendNames, name]);
    }
    setSelectedFriend('');
  };

  const createGroup = async () => {
    if (!groupName || friendNames.length === 0) {
      alert('Please enter a group name and add at least one friend.');
      return;
    }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({ creator_id: user.id, name: groupName })
      .select()
      .single();

    if (groupError) {
      alert(groupError.message);
      return;
    }
    const members = Object.entries(allFriendNames)
      .filter(([id, name]) => friendNames.includes(name))
      .map(([id]) => ({
        group_id: group.id,
        friend_id: id,
      }));

    const { error: memberError } = await supabase
      .from('group_members')
      .insert(members);

    if (memberError) {
      alert(memberError.message);
      return;
    }

    alert('Group created!');
    setGroupName('');
    setFriendNames([]);
    fetchGroups(user.id);
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

  const availableFriends = Object.entries(allFriendNames);

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

          <hr />

          <h2>Create New Group</h2>

          <input
            type="text"
            placeholder="Group name"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
          /><br /><br />

          <select
            value={selectedFriend}
            onChange={e => setSelectedFriend(e.target.value)}
          >
            <option value="">-- Select friend to add --</option>
            {availableFriends.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <button onClick={addPerson}>Add person</button>

          <p>People in this group:</p>
          <ul>
            {friendNames.map(name => <li key={name}>{name}</li>)}
          </ul>

          <button onClick={createGroup}>Create Group</button>

          <hr />

          <h2>My Groups</h2>
          <ul>
            {groups.map(g => (
              <CalendarWidget
                key={g.id}
                groupId={g.id}
                groupName={g.name}
              />
            ))}
          </ul>
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
