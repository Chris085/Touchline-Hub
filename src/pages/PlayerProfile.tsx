import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, collection, query, where, onSnapshot, addDoc, orderBy, updateDoc, getDocs, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { format, isAfter, startOfDay } from 'date-fns';
import { ArrowLeft, User, Users, Star, FileText, Activity, CheckCircle, AlertCircle, XCircle, Heart, Camera, Upload, Trophy, Target, TrendingUp, Calendar, Clock, MapPin, Award } from 'lucide-react';
import { motion } from 'motion/react';

export function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  
  const [player, setPlayer] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [availabilities, setAvailabilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newNote, setNewNote] = useState('');
  const [abilityRating, setAbilityRating] = useState<number>(3);
  const [savingNote, setSavingNote] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editProfileImageUrl, setEditProfileImageUrl] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [playerBalance, setPlayerBalance] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isCoach = profile?.role === 'coach' || isAdmin;

  useEffect(() => {
    if (player) {
      setEditName(player?.name || '');
      setEditNumber(player?.number || '');
      setEditPosition(player?.position || '');
      setEditProfileImageUrl(player?.profileImageUrl || '');
    }
  }, [player]);

  useEffect(() => {
    if (!id || !profile?.teamId) return;
    
    // Fetch player balance
    const q = query(collection(db, 'playerPayments'), where('playerId', '==', id), where('teamId', '==', profile.teamId), where('organisationId', '==', profile.organisationId));
    const unsubBalance = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setPlayerBalance(snapshot.docs[0].data());
      }
    });

    // Fetch team settings
    const unsubTeam = onSnapshot(doc(db, 'teams', profile.teamId), (doc) => {
      if (doc.exists()) {
        setTeam({ id: doc.id, ...doc.data() });
      }
    });

    return () => {
      unsubBalance();
      unsubTeam();
    };
  }, [id, profile?.teamId]);

  useEffect(() => {
    if (!id || !profile?.teamId) return;

    // Fetch player
    const playerRef = doc(db, 'players', id);
    const unsubPlayer = onSnapshot(playerRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data) {
          // Access check: only coaches or linked parents can view profile
          const isCoach = profile?.role === 'coach' || isAdmin;
          const isParent = data.parentIds?.includes(profile?.uid);
          
          if (!isCoach && !isParent) {
            navigate('/squad');
            return;
          }
          
          setPlayer({ id: docSnap.id, ...data });
        }
      } else {
        navigate('/');
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, `players/${id}`);
    });

    // Fetch notes (only for coaches/admins)
    let unsubNotes = () => {};
    const isCoachOrAdmin = profile?.role === 'coach' || profile?.email === 'chrisjeal9@gmail.com';
    
    if (isCoachOrAdmin) {
      const notesRef = collection(db, 'playerNotes');
      const qNotes = query(
        notesRef, 
        where('playerId', '==', id),
        where('teamId', '==', profile.teamId),
        where('organisationId', '==', profile.organisationId)
      );
      unsubNotes = onSnapshot(qNotes, (snapshot) => {
        const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        // Sort client-side to avoid needing a composite index immediately
        notesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setNotes(notesData);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'playerNotes'));
    }

    // Fetch attendances
    const attRef = collection(db, 'attendances');
    const qAtt = query(
      attRef, 
      where('playerId', '==', id),
      where('teamId', '==', profile.teamId),
      where('organisationId', '==', profile.organisationId)
    );
    const unsubAtt = onSnapshot(qAtt, (snapshot) => {
      const attData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttendances(attData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendances'));

    // Fetch matches for stats and availability
    const matchesRef = collection(db, 'matches');
    const qMatches = query(matchesRef, where('teamId', '==', profile.teamId), where('organisationId', '==', profile.organisationId));
    const unsubMatches = onSnapshot(qMatches, (snapshot) => {
      setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'matches'));

    // Fetch player's availabilities
    const availRef = collection(db, 'availabilities');
    const qAvail = query(availRef, where('playerId', '==', id), where('teamId', '==', profile.teamId), where('organisationId', '==', profile.organisationId));
    const unsubAvail = onSnapshot(qAvail, (snapshot) => {
      setAvailabilities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'availabilities'));

    return () => {
      unsubPlayer();
      unsubNotes();
      unsubAtt();
      unsubMatches();
      unsubAvail();
    };
  }, [id, profile?.teamId, profile?.role, profile?.email, navigate]);

  const stats = useMemo(() => {
    if (!player || !id) return null;
    
    const completedMatches = matches.filter(m => m.status === 'completed' && m.type === 'match');
    
    let goals = 0;
    let assistsCount = 0;
    let motmAwards = 0;
    let gamesPlayed = 0;
    const motmHistory: any[] = [];

    completedMatches.forEach(m => {
      // Check if player was involved
      const hasEvents = (m.events || []).some((e: any) => e.playerId === id || e.subPlayerId === id || e.assistPlayerId === id || e.assistId === id);
      const isOnPitch = (m.onPitch || []).includes(id);
      const isOnBench = (m.onBench || []).includes(id);
      
      const att = attendances.find(a => a.matchId === m.id);
      const avail = availabilities.find(a => a.matchId === m.id);
      
      let wasPresent = false;
      if (att) {
        wasPresent = att.status === 'present' || att.status === 'late';
      } else if (avail) {
        wasPresent = avail.status === 'going';
      }

      if (hasEvents || isOnPitch || isOnBench || wasPresent) {
        gamesPlayed++;
      }

      // Stats from events
      (m.events || []).forEach((event: any) => {
        if (event.type === 'goal' && event.playerId === id) {
          goals++;
        }
        if (event.type === 'goal' && (event.assistPlayerId === id || event.assistId === id)) {
          assistsCount++;
        }
      });

      // MOTM Awards
      const isCoachMotm = m.coachPotmId === id;
      const isParentMotm = m.parentPotmId === id || m.parentsPotmId === id;
      
      if (isCoachMotm || isParentMotm) {
        motmAwards++;
        motmHistory.push({
          matchId: m.id,
          opponent: m.opponent,
          date: m.date,
          type: isCoachMotm && isParentMotm ? 'Both' : isCoachMotm ? 'Coach' : 'Parents'
        });
      }
    });

    // Upcoming availability
    const upcoming = matches
      .filter(m => m.date && isAfter(new Date(m.date), startOfDay(new Date())))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5)
      .map(m => {
        const avail = availabilities.find(a => a.matchId === m.id);
        return {
          ...m,
          availability: avail?.status || 'none'
        };
      });

    return {
      goals,
      assists: assistsCount,
      motmAwards,
      gamesPlayed,
      motmHistory: motmHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      upcoming
    };
  }, [id, player, matches, availabilities, attendances]);

  const handleSetAvailability = async (matchId: string, status: 'going' | 'not-going' | 'maybe') => {
    if (!profile?.uid || !profile?.teamId || !id) return;

    try {
      const availId = `${matchId}_${id}`;
      await setDoc(doc(db, 'availabilities', availId), {
        matchId,
        playerId: id,
        parentId: profile.uid,
        teamId: profile.teamId,
        status
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'availabilities');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid || !profile?.teamId || !id || !newNote.trim()) return;

    setSavingNote(true);
    try {
      await addDoc(collection(db, 'playerNotes'), {
        playerId: id,
        teamId: profile.teamId,
        coachId: profile.uid,
        note: newNote.trim(),
        abilityRating,
        date: new Date().toISOString()
      });
      setNewNote('');
      setAbilityRating(3);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'playerNotes');
    } finally {
      setSavingNote(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!id || !editName.trim()) return;
    
    setUpdatingProfile(true);
    try {
      await updateDoc(doc(db, 'players', id), {
        name: editName.trim(),
        number: editNumber.trim(),
        position: editPosition,
        profileImageUrl: editProfileImageUrl.trim()
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `players/${id}`);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    setUploadingImage(true);
    setUploadProgress(0);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Create a canvas to resize the image
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 300;
          const MAX_HEIGHT = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Convert to a compressed JPEG to keep size small
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setEditProfileImageUrl(dataUrl);
          }
          setUploadingImage(false);
          setUploadProgress(100);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image. Please try a different one.');
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!player || !player.id) return null;

  const isParent = player?.parentIds?.includes(profile?.uid);

  const handleToggleParentStatus = async () => {
    if (!id || !profile?.uid || !player) return;
    
    const currentParentIds = player?.parentIds || [];
    const newParentIds = isParent 
      ? currentParentIds.filter((uid: string) => uid !== profile.uid)
      : [...currentParentIds, profile.uid];

    try {
      await updateDoc(doc(db, 'players', id), {
        parentIds: newParentIds
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `players/${id}`);
    }
  };

  const allSessionRecords = new Set([
    ...attendances.map(a => a.matchId),
    ...availabilities.map(a => a.matchId)
  ]);

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  allSessionRecords.forEach(matchId => {
    const att = attendances.find(a => a.matchId === matchId);
    const avail = availabilities.find(a => a.matchId === matchId);
    
    if (att) {
      if (att.status === 'present') presentCount++;
      else if (att.status === 'late') lateCount++;
      else if (att.status === 'absent') absentCount++;
    } else if (avail) {
      if (avail.status === 'going') presentCount++;
      else if (avail.status === 'not-going') absentCount++;
      // 'maybe' could be tracked separately if needed, but omitted from core stats
    }
  });

  const totalSessions = allSessionRecords.size;
  const attendanceRate = totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 0;

  const calculateAmountOwed = () => {
    if (!playerBalance || !team) return 0;
    const fee = team.paymentSettings?.matchFeeAmount || 0;
    const totalOwed = (playerBalance.matchesPlayed * fee) - playerBalance.totalPaid;
    return Math.max(0, totalOwed);
  };

  const owed = calculateAmountOwed();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-50 transition-colors"
      >
        <ArrowLeft size={20} />
        <span>Back</span>
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative"
      >
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
            <div className="relative group">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center shrink-0 overflow-hidden border-2 border-slate-700">
                {uploadingImage ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                    <span className="text-[10px] text-green-500 font-bold">{uploadProgress}%</span>
                  </div>
                ) : editProfileImageUrl ? (
                  <img 
                    src={editProfileImageUrl} 
                    alt={player.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : player.profileImageUrl ? (
                  <img 
                    src={player.profileImageUrl} 
                    alt={player.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User size={48} className="text-slate-400" />
                )}
              </div>
              {isEditing && (
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="absolute inset-0 bg-slate-950/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed z-10"
                >
                  <Camera size={24} className="text-slate-50" />
                  <span className="text-[10px] text-slate-50 font-bold mt-1">Change Photo</span>
                </button>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            {isEditing ? (
              <div className="space-y-3 w-full max-w-md">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-50 focus:outline-none focus:border-green-500"
                  placeholder="Player Name"
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                    className="w-full sm:w-24 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-50 focus:outline-none focus:border-green-500"
                    placeholder="Number"
                  />
                  <select
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    className="w-full sm:flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-50 focus:outline-none focus:border-green-500"
                  >
                    <option value="">Position</option>
                    <option value="GK">Goalkeeper (GK)</option>
                    <option value="CB">Center Back (CB)</option>
                    <option value="LB">Left Back (LB)</option>
                    <option value="RB">Right Back (RB)</option>
                    <option value="LWB">Left Wing Back (LWB)</option>
                    <option value="RWB">Right Wing Back (RWB)</option>
                    <option value="CDM">Defensive Midfielder (CDM)</option>
                    <option value="CM">Central Midfielder (CM)</option>
                    <option value="CAM">Attacking Midfielder (CAM)</option>
                    <option value="LM">Left Midfielder (LM)</option>
                    <option value="RM">Right Midfielder (RM)</option>
                    <option value="LW">Left Winger (LW)</option>
                    <option value="RW">Right Winger (RW)</option>
                    <option value="CF">Center Forward (CF)</option>
                    <option value="ST">Striker (ST)</option>
                  </select>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={editProfileImageUrl}
                    onChange={(e) => setEditProfileImageUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-10 py-3 text-slate-50 focus:outline-none focus:border-green-500"
                    placeholder="Profile Image URL"
                  />
                  <Upload size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  {editProfileImageUrl && (
                    <button 
                      type="button"
                      onClick={() => setEditProfileImageUrl('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-500"
                    >
                      <XCircle size={18} />
                    </button>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button 
                    onClick={handleUpdateProfile} 
                    disabled={updatingProfile || !editName.trim()}
                    className="flex-1 sm:flex-none bg-green-500 text-slate-950 px-4 py-3 rounded-lg font-bold text-sm hover:bg-green-400 transition-colors disabled:opacity-50"
                  >
                    {updatingProfile ? 'Saving...' : 'Save'}
                  </button>
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(player.name || '');
                      setEditNumber(player.number || '');
                      setEditPosition(player.position || '');
                      setEditProfileImageUrl(player.profileImageUrl || '');
                    }} 
                    disabled={updatingProfile}
                    className="flex-1 sm:flex-none bg-slate-800 text-slate-50 px-4 py-3 rounded-lg text-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-slate-50 pr-12 sm:pr-0">{player.name}</h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-slate-400">
                  {player.number && <span className="bg-slate-800 px-2 py-0.5 rounded text-sm">#{player.number}</span>}
                  {player.position && <span>{player.position}</span>}
                </div>
                {/* Payment Status Message */}
                <div className="mt-2 text-sm">
                  {owed > 0 ? (
                    <span className="text-red-400 font-medium flex items-center gap-1">
                      <AlertCircle size={14} />
                      Outstanding balance: {team?.paymentSettings?.currency || '£'}{owed.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-green-400 font-medium flex items-center gap-1">
                      <CheckCircle size={14} />
                      All payments up to date
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          {isCoach && !isEditing && (
            <div className="flex items-center gap-3 absolute top-6 right-6 sm:static sm:top-auto sm:right-auto">
              <button 
                onClick={handleToggleParentStatus}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isParent 
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' 
                    : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                }`}
              >
                <Heart size={16} className={isParent ? 'fill-current' : ''} />
                {isParent ? 'Remove as Parent' : 'I am the Parent'}
              </button>
              <button 
                onClick={() => setIsEditing(true)} 
                className="text-slate-400 hover:text-slate-50 text-sm underline px-2 py-1 shrink-0"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-slate-50 mb-4 flex items-center gap-2">
              <Trophy size={20} className="text-yellow-500" />
              Season Stats
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <Users size={20} className="text-slate-50 mx-auto mb-2" />
                <div className="text-2xl font-black text-slate-50 italic font-display">{stats?.gamesPlayed || 0}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Games Played</div>
              </div>
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <Target size={20} className="text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-black text-slate-50 italic font-display">{stats?.goals || 0}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Goals Scored</div>
              </div>
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <TrendingUp size={20} className="text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-black text-slate-50 italic font-display">{stats?.assists || 0}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Team Assists</div>
              </div>
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <Star size={20} className="text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-black text-slate-50 italic font-display">{stats?.motmAwards || 0}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">MOTM Awards</div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-slate-50 mb-4 flex items-center gap-2">
              <Activity size={20} className="text-slate-400" />
              Attendance Stats
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400">Attendance Rate</span>
                <span className="text-xl font-bold text-slate-50">{attendanceRate}%</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle size={16} />
                    <span>Present</span>
                  </div>
                  <span className="font-medium text-slate-50">{presentCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertCircle size={16} />
                    <span>Late</span>
                  </div>
                  <span className="font-medium text-slate-50">{lateCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle size={16} />
                    <span>Absent</span>
                  </div>
                  <span className="font-medium text-slate-50">{absentCount}</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-slate-50 mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-blue-400" />
              Upcoming Availability
            </h2>
            
            <div className="space-y-3">
              {stats?.upcoming.map(m => (
                <div key={m.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-50 uppercase italic font-display truncate">
                      {m.type === 'match' ? `vs ${m.opponent}` : 'Training'}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock size={10} />
                      {format(new Date(m.date), 'MMM d, h:mm a')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isParent ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSetAvailability(m.id, 'going')}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                            m.availability === 'going' ? 'bg-green-500 text-slate-950' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                          }`}
                          title="Going"
                        >
                          <CheckCircle size={14} />
                        </button>
                        <button
                          onClick={() => handleSetAvailability(m.id, 'maybe')}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                            m.availability === 'maybe' ? 'bg-yellow-500 text-slate-950' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                          }`}
                          title="Maybe"
                        >
                          <AlertCircle size={14} />
                        </button>
                        <button
                          onClick={() => handleSetAvailability(m.id, 'not-going')}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                            m.availability === 'not-going' ? 'bg-red-500 text-slate-950' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                          }`}
                          title="Not Going"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${
                        m.availability === 'going' ? 'bg-green-500/20 text-green-500' :
                        m.availability === 'maybe' ? 'bg-yellow-500/20 text-yellow-500' :
                        m.availability === 'not-going' ? 'bg-red-500/20 text-red-500' :
                        'bg-slate-800 text-slate-500'
                      }`}>
                        {m.availability === 'none' ? 'No Response' : m.availability.replace('-', ' ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {stats?.upcoming.length === 0 && (
                <p className="text-center py-4 text-slate-500 text-sm italic">No upcoming sessions.</p>
              )}
            </div>
          </motion.div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-slate-50 mb-4 flex items-center gap-2">
              <Award size={20} className="text-yellow-500" />
              MOTM History
            </h2>
            
            <div className="grid gap-3 sm:grid-cols-2">
              {stats?.motmHistory.map((h, i) => (
                <div key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center shrink-0">
                    <Trophy size={20} className="text-yellow-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-50 uppercase italic font-display truncate">vs {h.opponent}</div>
                    <div className="text-[10px] text-slate-500">{format(new Date(h.date), 'MMM d, yyyy')}</div>
                    <div className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">Awarded by {h.type}</div>
                  </div>
                </div>
              ))}
              {stats?.motmHistory.length === 0 && (
                <div className="col-span-2 text-center py-8 text-slate-500 text-sm italic">
                  No MOTM awards yet. Keep working hard!
                </div>
              )}
            </div>
          </motion.div>
          {isCoach && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
            >
              <h2 className="text-lg font-bold text-slate-50 mb-4 flex items-center gap-2">
                <FileText size={20} className="text-slate-400" />
                Add Player Note
              </h2>
              <form onSubmit={handleAddNote} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Ability Rating (1-5)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(rating => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setAbilityRating(rating)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                          abilityRating >= rating ? 'bg-yellow-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        <Star size={18} className={abilityRating >= rating ? 'fill-current' : ''} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Note</label>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add observations, areas for improvement, etc."
                    className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-50 focus:outline-none focus:border-blue-500 resize-none"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingNote || !newNote.trim()}
                    className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-slate-50 px-6 py-2 rounded-lg font-bold transition-colors"
                  >
                    {savingNote ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-slate-50 mb-4 flex items-center gap-2">
              <Star size={20} className="text-slate-400" />
              Development History
            </h2>
            
            {notes.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                <p>No notes have been added for this player yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-slate-400">
                        {format(new Date(note.date), 'MMM d, yyyy h:mm a')}
                      </span>
                      {note.abilityRating && (
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(rating => (
                            <Star 
                              key={rating} 
                              size={14} 
                              className={rating <= note.abilityRating ? 'text-yellow-500 fill-current' : 'text-slate-700'} 
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-slate-50 whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
