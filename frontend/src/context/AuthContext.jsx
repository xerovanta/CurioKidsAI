import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { auth, db, isValidConfig } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [childProfile, setChildProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mock User Fallback for testing without Firebase keys
  const [mockUser, setMockUser] = useState(() => {
    const saved = localStorage.getItem('curiokids_mock_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [mockProfile, setMockProfile] = useState(() => {
    const saved = localStorage.getItem('curiokids_mock_profile');
    return saved ? JSON.parse(saved) : null;
  });

  // Keep mock profile synced to localStorage
  useEffect(() => {
    if (mockUser) {
      localStorage.setItem('curiokids_mock_user', JSON.stringify(mockUser));
    } else {
      localStorage.removeItem('curiokids_mock_user');
    }
  }, [mockUser]);

  useEffect(() => {
    if (mockProfile) {
      localStorage.setItem('curiokids_mock_profile', JSON.stringify(mockProfile));
    } else {
      localStorage.removeItem('curiokids_mock_profile');
    }
  }, [mockProfile]);

  // Real Firebase Auth listener
  useEffect(() => {
    if (!isValidConfig) {
      // Offline mock authentication mode
      if (mockUser) {
        setCurrentUser(mockUser);
        if (!mockProfile) {
          initializeChildProfile(mockUser.uid, true);
        } else {
          setChildProfile(mockProfile);
        }
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchOrCreateChildProfile(user.uid);
      } else {
        setChildProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [mockUser]);

  // Helper to generate a dynamic daily mission rotating across games
  const getRandomDailyMission = () => {
    const missions = [
      { text: 'Complete a Memory Match puzzle', game: 'memory-match', target: 1, starsReward: 5 },
      { text: 'Practice 3 words in Word Repeat', game: 'word-repeat', target: 3, starsReward: 5 },
      { text: 'Draw 3 shapes in AirDraw', game: 'air-draw', target: 3, starsReward: 5 },
      { text: 'Grab 5 letters in Alphabet Grab', game: 'alphabet-grab', target: 5, starsReward: 5 }
    ];
    const idx = Math.floor(Math.random() * missions.length);
    return {
      id: 1,
      text: missions[idx].text,
      game: missions[idx].game,
      target: missions[idx].target,
      current: 0,
      completed: false,
      starsReward: missions[idx].starsReward
    };
  };

  // Create initial profile metrics for the child
  const createInitialProfileData = (uid) => {
    const activeMission = getRandomDailyMission();
    return {
      uid,
      stars: 0,
      level: 1,
      streak: 1,
      lastActive: new Date().toISOString().split('T')[0],
      badges: [],
      avatar: '🦊',
      companion: 'sparky', // default companion skin
      unlockedCompanions: ['sparky'],
      dailyMissions: [
        activeMission,
        { id: 2, text: 'Earn 10 stars today', target: 10, current: 0, completed: false, starsReward: 10 },
      ],
      gamesStats: {
        memoryMatchPuzzles: 0,
        wordRepeatWords: 0,
        airDrawShapes: 0,
        alphabetGrabLetters: 0
      },
      gamesStars: {
        'memory-match': 0,
        'word-repeat': 0,
        'air-draw': 0,
        'alphabet-grab': 0
      },
      createdAt: new Date().toISOString()
    };
  };

  // Helper: Fetch child profile from Firestore or initialize a new one
  const fetchOrCreateChildProfile = async (uid) => {
    try {
      const profileRef = doc(db, 'children', uid);
      const profileSnap = await getDoc(profileRef);
      
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        setChildProfile(data);
        // Verify streak logic on login
        await verifyAndTrackStreak(uid, data);
      } else {
        const initialData = createInitialProfileData(uid);
        await setDoc(profileRef, initialData);
        setChildProfile(initialData);
      }
    } catch (error) {
      console.error("Error loading child profile:", error);
    }
  };

  // Helper: In-memory mock profiles
  const initializeChildProfile = (uid, isMock = false) => {
    const initialData = createInitialProfileData(uid);
    if (isMock) {
      setMockProfile(initialData);
      setChildProfile(initialData);
    }
  };

  // Streak & Daily Mission reset verification logic (runs on day shifts)
  const verifyAndTrackStreak = async (uid, currentData) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = currentData.streak || 1;
    let lastActive = currentData.lastActive;

    if (lastActive === todayStr) {
      // Already active today, no resets needed
      return;
    }

    if (lastActive === yesterdayStr) {
      // Active yesterday, increment streak!
      newStreak += 1;
    } else {
      // Gap in play, reset streak
      newStreak = 1;
    }

    // Reset daily missions progress since it is a new calendar day
    const resetMissions = [
      getRandomDailyMission(),
      { id: 2, text: 'Earn 10 stars today', target: 10, current: 0, completed: false, starsReward: 10 },
    ];

    const updates = {
      streak: newStreak,
      lastActive: todayStr,
      dailyMissions: resetMissions
    };

    setChildProfile(prev => prev ? { ...prev, ...updates } : null);

    if (isValidConfig && db) {
      try {
        await updateDoc(doc(db, 'children', uid), updates);
      } catch (e) {
        console.error("Error updating streak and resetting daily missions:", e);
      }
    } else if (mockUser) {
      setMockProfile(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  // 1. ANONYMOUS SIGN IN (Automatic for Children)
  const loginAnonymously = async () => {
    setLoading(true);
    if (!isValidConfig) {
      // Mock Anonymous Sign In
      const tempUid = 'mock_child_' + Math.random().toString(36).substr(2, 9);
      const tempUser = { uid: tempUid, isAnonymous: true, email: null };
      setMockUser(tempUser);
      initializeChildProfile(tempUid, true);
      setLoading(false);
      return tempUser;
    }

    try {
      const credential = await signInAnonymously(auth);
      await fetchOrCreateChildProfile(credential.user.uid);
      return credential.user;
    } catch (error) {
      console.error("Anonymous authentication error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 2. EMAIL SIGN IN (For Parents)
  const loginWithEmail = async (email, password) => {
    setLoading(true);
    if (!isValidConfig) {
      // Mock Email Authentication
      const parentUid = 'mock_parent_' + Math.random().toString(36).substr(2, 9);
      const tempUser = { uid: parentUid, isAnonymous: false, email };
      setMockUser(tempUser);
      setChildProfile(null);
      setMockProfile(null);
      setLoading(false);
      return tempUser;
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      setChildProfile(null);
      return credential.user;
    } catch (error) {
      console.error("Email sign-in error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 3. EMAIL REGISTER (For Parents)
  const registerWithEmail = async (email, password) => {
    setLoading(true);
    if (!isValidConfig) {
      // Mock Email Registration
      const parentUid = 'mock_parent_' + Math.random().toString(36).substr(2, 9);
      const tempUser = { uid: parentUid, isAnonymous: false, email };
      setMockUser(tempUser);
      setChildProfile(null);
      setMockProfile(null);
      setLoading(false);
      return tempUser;
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'parents', credential.user.uid), {
        email,
        createdAt: new Date().toISOString(),
        children: []
      });
      setChildProfile(null);
      return credential.user;
    } catch (error) {
      console.error("Email registration error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 4. SIGN OUT
  const logout = async () => {
    setLoading(true);
    if (!isValidConfig) {
      setMockUser(null);
      setMockProfile(null);
      setCurrentUser(null);
      setChildProfile(null);
      setLoading(false);
      return;
    }

    try {
      await signOut(auth);
      setCurrentUser(null);
      setChildProfile(null);
    } catch (error) {
      console.error("Sign-out error:", error);
    } finally {
      setLoading(false);
    }
  };

  // 5. UPDATE SCORE / STARS / BADGES (Tracks individual game stars)
  const awardStars = async (amount, gameId = null) => {
    if (!currentUser || !childProfile) return;

    const newStars = childProfile.stars + amount;
    const newLevel = Math.floor(newStars / 50) + 1;
    const didLevelUp = newLevel > childProfile.level;

    const updates = {
      stars: newStars,
      level: newLevel,
    };

    // Update game specific stars if gameId is provided
    if (gameId) {
      const currentGamesStars = childProfile.gamesStars || {
        'memory-match': 0,
        'word-repeat': 0,
        'air-draw': 0,
        'alphabet-grab': 0
      };
      updates.gamesStars = {
        ...currentGamesStars,
        [gameId]: (currentGamesStars[gameId] || 0) + amount
      };
    }

    // Level-up badge awarding
    let newBadges = [...childProfile.badges];
    if (didLevelUp) {
      const levelBadge = `level-${newLevel}`;
      if (!newBadges.includes(levelBadge)) {
        newBadges.push(levelBadge);
        updates.badges = newBadges;
      }
      
      let unlocked = [...(childProfile.unlockedCompanions || ['sparky'])];
      if (newLevel >= 3 && !unlocked.includes('rocky')) {
        unlocked.push('rocky');
        updates.unlockedCompanions = unlocked;
      }
      if (newLevel >= 5 && !unlocked.includes('ziggy')) {
        unlocked.push('ziggy');
        updates.unlockedCompanions = unlocked;
      }
    }

    // Update daily mission values
    const updatedMissions = childProfile.dailyMissions.map(mission => {
      // 1. Mission 2: "Earn 10 stars"
      if (mission.id === 2) {
        const currentProgress = Math.min(mission.current + amount, mission.target);
        const completed = currentProgress >= mission.target;
        return { ...mission, current: currentProgress, completed };
      }
      return mission;
    });
    updates.dailyMissions = updatedMissions;

    const mergedProfile = { ...childProfile, ...updates };
    setChildProfile(mergedProfile);

    if (!isValidConfig) {
      setMockProfile(mergedProfile);
      return { didLevelUp, companionUnlocked: didLevelUp && (newLevel === 3 || newLevel === 5) };
    }

    try {
      await updateDoc(doc(db, 'children', currentUser.uid), updates);
    } catch (error) {
      console.error("Error awarding stars:", error);
    }

    return { didLevelUp, companionUnlocked: didLevelUp && (newLevel === 3 || newLevel === 5) };
  };

  // 6. INCREMENT MISSION PROGRESS (e.g., played a game)
  const incrementMission = async (missionId) => {
    if (!childProfile) return;

    const updatedMissions = childProfile.dailyMissions.map(mission => {
      if (mission.id === missionId) {
        const currentProgress = Math.min(mission.current + 1, mission.target);
        const completed = currentProgress >= mission.target;
        return { ...mission, current: currentProgress, completed };
      }
      return mission;
    });

    const updates = { dailyMissions: updatedMissions };
    const mergedProfile = { ...childProfile, ...updates };
    setChildProfile(mergedProfile);

    if (!isValidConfig) {
      setMockProfile(mergedProfile);
      return;
    }

    try {
      await updateDoc(doc(db, 'children', currentUser.uid), updates);
    } catch (error) {
      console.error("Error updating mission:", error);
    }
  };

  // 7. INCREMENT GAME PLAY STATISTICS AND AWARD ACCUMULATIVE BADGES
  const incrementStat = async (statName, amount = 1) => {
    if (!currentUser || !childProfile) return;

    const stats = childProfile.gamesStats || {
      memoryMatchPuzzles: 0,
      wordRepeatWords: 0,
      airDrawShapes: 0,
      alphabetGrabLetters: 0
    };

    const newStats = {
      ...stats,
      [statName]: (stats[statName] || 0) + amount
    };

    const updates = { gamesStats: newStats };

    // Check custom badge reward achievements
    let newBadges = [...childProfile.badges];
    
    // "Word Wizard" - 50 correct words in Word Repeat
    if (statName === 'wordRepeatWords' && newStats.wordRepeatWords >= 50 && !newBadges.includes('word-wizard')) {
      newBadges.push('word-wizard');
      updates.badges = newBadges;
    }
    // "Memory Master" - Complete 20 Memory Match puzzles
    if (statName === 'memoryMatchPuzzles' && newStats.memoryMatchPuzzles >= 20 && !newBadges.includes('memory-master')) {
      newBadges.push('memory-master');
      updates.badges = newBadges;
    }
    // "Air Artist" - Draw 10 shapes in AirDraw
    if (statName === 'airDrawShapes' && newStats.airDrawShapes >= 10 && !newBadges.includes('air-artist')) {
      newBadges.push('air-artist');
      updates.badges = newBadges;
    }
    // "Letter Champion" - 30 correct letter grabs in Alphabet Grab
    if (statName === 'alphabetGrabLetters' && newStats.alphabetGrabLetters >= 30 && !newBadges.includes('letter-champion')) {
      newBadges.push('letter-champion');
      updates.badges = newBadges;
    }

    const mergedProfile = { ...childProfile, ...updates };
    setChildProfile(mergedProfile);

    if (!isValidConfig) {
      setMockProfile(mergedProfile);
      return;
    }

    try {
      await updateDoc(doc(db, 'children', currentUser.uid), updates);
    } catch (error) {
      console.error(`Error updating stat ${statName}:`, error);
    }
  };

  // 8. CHANGE PROFILE COMPANION OR AVATAR
  const updateCustomization = async (field, value) => {
    if (!currentUser || !childProfile) return;

    const updates = { [field]: value };
    const mergedProfile = { ...childProfile, ...updates };
    setChildProfile(mergedProfile);

    if (!isValidConfig) {
      setMockProfile(mergedProfile);
      return;
    }

    try {
      await updateDoc(doc(db, 'children', currentUser.uid), updates);
    } catch (error) {
      console.error(`Error updating customization ${field}:`, error);
    }
  };

  // 9. ADD NEW BADGE DIRECTLY
  const earnBadge = async (badgeId) => {
    if (!currentUser || !childProfile) return;
    if (childProfile.badges.includes(badgeId)) return false;

    const newBadges = [...childProfile.badges, badgeId];
    const updates = { badges: newBadges };
    const mergedProfile = { ...childProfile, ...updates };
    setChildProfile(mergedProfile);

    if (!isValidConfig) {
      setMockProfile(mergedProfile);
      return true;
    }

    try {
      await updateDoc(doc(db, 'children', currentUser.uid), updates);
      return true;
    } catch (error) {
      console.error("Error earning badge:", error);
      return false;
    }
  };

  const value = {
    currentUser,
    childProfile,
    loading,
    loginAnonymously,
    loginWithEmail,
    registerWithEmail,
    logout,
    awardStars,
    incrementMission,
    incrementStat,
    updateCustomization,
    earnBadge,
    firebaseConfigured: isValidConfig
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
