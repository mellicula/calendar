import React, { useState, useEffect } from 'react';
import ICAL from 'ical.js';
import { supabase } from '../lib/supabaseClient';

export default function CalendarWidget({ groupId, groupName }) {
  const [friends, setFriends] = useState([]);    // { name, attendsLectures, jcalData }
  const [date, setDate] = useState(null);
  const [mode, setMode] = useState("events");        // 'events' | 'best'

  useEffect(() => {
    if (!date) setDate(new Date().toISOString().split('T')[0]);
  }, [date]);

  useEffect(() => {
    async function loadGroupMembers() {
      const { data: members } = await supabase
        .from('group_members')
        .select('friend_id')
        .eq('group_id', groupId);

      if (!members) return;

      const ids = members.map(m => m.friend_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('display_name, ical_url')
        .in('id', ids);

      const loaded = await Promise.all(profiles.map(async p => {
        const res = await fetch(`/api/get-cal?url=${encodeURIComponent(p.ical_url)}`);
        const text = await res.text();
        const comp = new ICAL.Component(ICAL.parse(text));
        return {
          name: p.display_name,
          attendsLectures: true,
          jcalData: comp
        };
      }));

      setFriends(loaded);
    }
    loadGroupMembers();
  }, [groupId]);

  async function removeGroup() {
    const confirmDelete = confirm(`Are you sure you want to delete group "${groupName}"?`);
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      alert('Failed to delete group: ' + error.message);
    } else {
      alert(`Group "${groupName}" deleted.`);
      location.reload();  
    }
  }

  function filterByDate(events, selectedDate, skips) {
    return events.filter((vevent) => {
      const eventStart = vevent.getFirstPropertyValue("dtstart").toString().slice(0,10);
      if (!eventStart) return false;
      const icalTime = new ICAL.Time();
      icalTime.fromJSDate(new Date(eventStart.toString()), true);
      const eventDate = new Date(icalTime.toJSDate()).toISOString().slice(0, 10);
      return eventDate===selectedDate
        && (skips || !vevent.getFirstPropertyValue("summary").includes("Lecture"));
    });
  }

  function updateCell(row, col, ev, chck) {
    const table = document.getElementById(`timetable-${groupId}`);
    const r = table.getElementsByTagName("tr")[row+1];
    const cell = r && r.getElementsByTagName("td")[col];
    if (cell) {
      if (chck) cell.textContent = ev.getFirstPropertyValue("summary");
      cell.style.backgroundImage = "linear-gradient(to right, purple, blue)";
      cell.style.color = "white";
    }
  }

  function convertTime12(time) {
    if (time >= 12) return (time%12 || 12) + "pm";
    return time + "am";
  }

  function createTable() {
    const table = document.getElementById(`timetable-${groupId}`);
    while (table.firstChild) table.removeChild(table.firstChild);
    table.classList.add("test");

    // header row
    const headerRow = document.createElement("tr");
    const th0 = document.createElement("th");
    th0.textContent = "Times";
    headerRow.appendChild(th0);

    for (let f of friends) {
      const th = document.createElement("th");
      th.textContent = f.name;
      headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    // time rows
    const times = Array.from({ length: 11 }, (_, i) => convertTime12(i+8));
    times.forEach(time => {
      const row = document.createElement("tr");
      const tdTime = document.createElement("td");
      tdTime.textContent = time;
      row.appendChild(tdTime);
      for (let i = 0; i < friends.length; i++) {
        row.appendChild(document.createElement("td"));
      }
      table.appendChild(row);
    });

    // fill events
    friends.forEach((f, fi) => {
      const evs = filterByDate(f.jcalData.getAllSubcomponents("vevent"), date, f.attendsLectures);
      evs.forEach(evtComp => {
        const ev = new ICAL.Event(evtComp);
        const startHour = new Date(evtComp.getFirstPropertyValue("dtstart").toString()).getHours();
        for (let hr = startHour-8; hr < startHour-8+ev.duration.hours; hr++) {
          updateCell(hr, fi+1, evtComp, hr===startHour-8);
        }
      });
    });
  }

  function whenToMeet() {
    const allAv = [];
    const FULL = (1 << 12) - 1;

    for (var i = 0; i < friends.length; i++) {
      var friendsEvents = filterByDate(
        friends[i].jcalData.getAllSubcomponents("vevent"),
        date,
        friends[i].attendsLectures
      );

      var availability = FULL;

      for (var j = 0; j < friendsEvents.length; j++) {
        const evntComp = friendsEvents[j];
        const avent = new ICAL.Event(evntComp);

        const start = new Date(evntComp.getFirstPropertyValue("dtstart")).getHours();
        const dur = avent.duration.hours;

        for (var hr = start - 8; hr < start - 8 + dur; hr++) {
          availability &= ~(1 << hr);
        }
      }

      allAv.push(availability);
    }

    var combined = FULL;
    for (var i = 0; i < allAv.length; i++) {
      combined &= allAv[i];
    }

    var times = [];
    for (var hr = 8; hr < 20; hr++) {
      if ((combined & (1 << (hr - 8))) !== 0) {
        times.push(hr);
      }
    }

    return times;
  }

  function switchModes() {
    mode === 'events' ? setMode('best') : setMode('events')
  }




  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', margin: '1rem 0' }}>
      <h3>Group: {groupName}</h3>
      <label>
        Date:{" "}
        <input
          type="date"
          value={date || ""}
          onChange={e => setDate(e.target.value)}
        />
      </label>
      {" "}
      <button onClick={() => switchModes()}>Switch view</button>

      {mode === 'events' && (
        <div>
          {friends.map((f,i) => {
            const evs = filterByDate(f.jcalData.getAllSubcomponents("vevent"), date, f.attendsLectures);
            return (
              <div key={i}>
                <strong>{f.name}</strong>
                <ul>
                  {evs.map((ve, j) => (
                    <li key={j}>
                      {ve.getFirstPropertyValue("summary") || "—"} @{" "}
                      {ve.getFirstPropertyValue("dtstart").toString().slice(11,16)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {mode === 'best' && (
        <div>
          <button onClick={createTable}>Show Timetable</button>
          <p>Best times: {whenToMeet().map(h=>convertTime12(h)).join(', ')}</p>
          <table id={`timetable-${groupId}`} style={{ width: '100%', borderCollapse: 'collapse' }}/>
        </div>
      )}

      <br></br>
      <button onClick={removeGroup} style={{ color: 'red', marginLeft: '1rem' }}>
        Delete Group
      </button>
    </div>
  );
}

