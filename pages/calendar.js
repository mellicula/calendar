import { supabase } from '../lib/supabaseClient';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function CalendarPage() {
  const [icalUrl, setIcalUrl] = useState('');
  const [icalContent, setIcalContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIcal = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Not logged in');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('ical_url')
        .eq('id', user.id)
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      if (data?.ical_url) {
        setIcalUrl(data.ical_url);

        const apiRes = await fetch(`/api/get-cal?url=${encodeURIComponent(data.ical_url)}`);

        if (apiRes.ok) {
          const text = await apiRes.text();
          setIcalContent(text);
        } else {
          setIcalContent('Failed to fetch iCal file.');
        }
      } else {
        setIcalContent('no ical in profile');
      }

      setLoading(false);
    };

    fetchIcal();
  }, []);

  if (loading) return <p>Loading ...</p>

  return (
    <div>
      <h2> ical file </h2>
      {icalUrl ? (
        <>
          <pre>
            {icalContent}
          </pre>
        </>
      ) : (
        <p> no profile found</p>
      )}

      <Link href="/">
        <button>Home</button>
      </Link>&nbsp;
      <Link href="/profile">
        <button>profile</button>
      </Link>&nbsp;

    </div>
  );
}









