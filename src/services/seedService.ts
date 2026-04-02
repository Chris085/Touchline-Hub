import { collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function seedData(teamId: string) {
  // Add 12 sample players
  const playersRef = collection(db, 'players');
  const players = [
    { name: 'Liam Smith', number: '1', position: 'GK' },
    { name: 'Noah Johnson', number: '2', position: 'DF' },
    { name: 'Oliver Williams', number: '3', position: 'DF' },
    { name: 'Elijah Brown', number: '4', position: 'DF' },
    { name: 'James Jones', number: '5', position: 'DF' },
    { name: 'William Garcia', number: '6', position: 'MF' },
    { name: 'Benjamin Miller', number: '7', position: 'MF' },
    { name: 'Lucas Davis', number: '8', position: 'MF' },
    { name: 'Henry Rodriguez', number: '9', position: 'FW' },
    { name: 'Alexander Martinez', number: '10', position: 'FW' },
    { name: 'Sebastian Hernandez', number: '11', position: 'FW' },
    { name: 'Jack Lopez', number: '12', position: 'MF' }
  ];

  const playerDocs = await Promise.all(players.map(p => addDoc(playersRef, {
    teamId,
    ...p,
    parentIds: []
  })));

  // Add 3 completed matches with varied results
  const matchesRef = collection(db, 'matches');
  const matchData = [
    { opponent: 'Example FC', scoreUs: 3, scoreThem: 1, result: 'W' },
    { opponent: 'Test United', scoreUs: 1, scoreThem: 1, result: 'D' },
    { opponent: 'Sample City', scoreUs: 0, scoreThem: 2, result: 'L' }
  ];

  for (const data of matchData) {
    const match = await addDoc(matchesRef, {
      teamId,
      type: 'match',
      date: new Date().toISOString(),
      status: 'completed',
      ...data,
      events: data.result === 'W' ? [
        { type: 'goal', playerId: playerDocs[8].id, assistId: playerDocs[6].id },
        { type: 'goal', playerId: playerDocs[9].id, assistId: null },
        { type: 'goal', playerId: playerDocs[10].id, assistId: playerDocs[7].id }
      ] : data.result === 'D' ? [
        { type: 'goal', playerId: playerDocs[8].id, assistId: null }
      ] : []
    });

    // Add attendance
    const attendanceRef = collection(db, 'attendances');
    await Promise.all(playerDocs.map(p => addDoc(attendanceRef, { teamId, matchId: match.id, playerId: p.id, status: 'present' })));

    // Add MOTM votes
    const votesRef = collection(db, 'motmVotes');
    await addDoc(votesRef, { teamId, matchId: match.id, playerId: playerDocs[8].id, userId: 'user1' });
    await addDoc(votesRef, { teamId, matchId: match.id, playerId: playerDocs[9].id, userId: 'user2' });
  }

  // Add news post
  const newsRef = collection(db, 'newsPosts');
  await addDoc(newsRef, {
    teamId,
    title: 'Season Update',
    content: 'We have played 3 matches so far. Keep up the good work!',
    createdAt: new Date().toISOString(),
    authorId: 'system'
  });

  // Add chat message
  const chatRef = collection(db, 'chatMessages');
  await addDoc(chatRef, {
    teamId,
    senderId: 'system',
    text: 'Well done in the recent matches!',
    createdAt: new Date().toISOString()
  });
}

export async function removeAllSeedData(teamId: string) {
  const collections = ['players', 'matches', 'attendances', 'motmVotes', 'newsPosts', 'chatMessages'];
  
  for (const colName of collections) {
    const q = query(collection(db, colName), where('teamId', '==', teamId));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
  }
}
