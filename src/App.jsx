import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  X, 
  Type, 
  User, 
  Sparkles, 
  DollarSign,
  Menu,
  Calendar as CalendarIcon,
  Layout,
  Edit2,
  Save,
  RotateCcw,
  Cloud,
  LogOut,
  Loader2,
  CheckCircle2,
  CloudOff,
  Wifi
} from 'lucide-react';

// --- 1. YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDZvfdi7-3cm4loOEl6-TywQYQNzbNbPtI",
  authDomain: "creator-vision-app.firebaseapp.com",
  projectId: "creator-vision-app",
  storageBucket: "creator-vision-app.firebasestorage.app",
  messagingSenderId: "861262403958",
  appId: "1:861262403958:web:be21b85218da0a2ddfc257"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Unique identifier for your data collection
const appId = 'creator-vision-production'; 

// --- CONSTANTS ---
const CATEGORY_CONFIG = {
  "What": { 
    icon: Type, 
    colors: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100", accent: "bg-blue-600" }
  },
  "Who": { 
    icon: User, 
    colors: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100", accent: "bg-violet-600" }
  },
  "Uniqueness": { 
    icon: Sparkles, 
    colors: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", accent: "bg-emerald-600" }
  },
  "Monetisation": { 
    icon: DollarSign, 
    colors: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100", accent: "bg-amber-600" }
  }
};

const STATUS_COLORS = {
  "Idea": { bg: "bg-neutral-100", text: "text-neutral-600", border: "border-neutral-200" },
  "Scripting": { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  "Filming": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Editing": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "Posted": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" }
};

const AVAILABLE_PLATFORMS = ["Instagram", "YouTube", "TikTok", "Newsletter"];

const DEFAULT_VISION = {
  "What": {
    description: "My Message & Content Pillars",
    message: "Audacity in the pursuit of dreams, consistency in every stride, and the wisdom to see every failure as a milestone on the path to mastery.",
    sections: [
      { title: "Content Pillars", items: ["Performances", "Compositions", "Brand-Led Content", "Collaboration Posts", "Personal Story"] }
    ]
  },
  "Who": {
    description: "My Audience Avatar",
    sections: [
      { title: "Demographics", items: ["18-40 years old", "US & Europe focus", "Film Composers & Directors"] },
      { title: "Psychographics", items: ["Curious musicians", "Inspiration seekers", "Directors needing composers"] }
    ]
  },
  "Uniqueness": {
    description: "My Truth & Authenticity",
    sections: [
      { title: "Experience", items: ["Berklee Graduate", "Film Composer", "Tabla Specialist", "The Dental Pivot"] },
      { title: "Pains", items: ["Academic vs. Creative Flow", "Consistency struggles"] },
      { title: "Passion", items: ["Meaningful storytelling", "Cultural unity"] },
      { title: "Skills", items: ["Film/Game Scoring", "Orchestration", "Tabla"] }
    ]
  },
  "Monetisation": {
    description: "My Ecosystem",
    sections: [
      { title: "One-Offs", items: ["Brand Deals", "Commissions"] },
      { title: "Ongoing", items: ["Tabla Course", "Passive Income"] },
      { title: "Partners", items: ["Spitfire", "ROLI", "iZotope"] },
      { title: "Reinvest", items: ["Travel", "Studio Gear"] }
    ]
  }
};

const App = () => {
  // --- STATE ---
  const [user, setUser] = useState(null);
  const [vision, setVision] = useState(DEFAULT_VISION);
  const [contentItems, setContentItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Navigation & UI State
  const [currentView, setCurrentView] = useState("planner"); 
  const [activeTab, setActiveTab] = useState("What"); 
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [listFilter, setListFilter] = useState("all"); 

  // Form State
  const [newItem, setNewItem] = useState({
    title: "",
    pillar: "",
    platforms: [],
    format: "Reel",
    status: "Idea",
    date: "",
    notes: ""
  });
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // --- 1. INITIALIZE & FAIL-SAFE ---
  useEffect(() => {
    // Force application load if Firebase takes too long (> 5 seconds)
    const timeout = setTimeout(() => {
      if (isLoading && !user) {
        // Only switch to offline if we aren't logged in yet or sync is stuck
        console.warn("Firebase connection timed out. Switching to local mode.");
        setIsAuthChecking(false);
        setIsLoading(false);
        
        // Load from LocalStorage if available
        const savedVision = localStorage.getItem('creator_vision_local');
        const savedContent = localStorage.getItem('creator_content_local');
        if (savedVision) setVision(JSON.parse(savedVision));
        if (savedContent) setContentItems(JSON.parse(savedContent));
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthChecking(false);
      if (!currentUser) {
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // --- 2. FETCH DATA (Cloud with Fallback) ---
  useEffect(() => {
    if (!user) return;

    setIsLoading(true);

    // Vision Listener
    const visionDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'vision_board', 'main');
    const unsubVision = onSnapshot(visionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setVision(docSnap.data());
        // Backup to local
        localStorage.setItem('creator_vision_local', JSON.stringify(docSnap.data()));
      } else {
        // If new user, push default to cloud
        setDoc(visionDocRef, DEFAULT_VISION);
        setVision(DEFAULT_VISION);
      }
      setIsLoading(false); // Success!
      setIsOfflineMode(false);
    }, (err) => {
      console.warn("Vision sync failed, using local", err);
      setIsOfflineMode(true); // Switch to offline if stream breaks
      setIsLoading(false);
      
      // Load local backup
      const savedVision = localStorage.getItem('creator_vision_local');
      if (savedVision) setVision(JSON.parse(savedVision));
    });

    // Content Listener
    const contentCollRef = collection(db, 'artifacts', appId, 'users', user.uid, 'content_planner');
    const unsubContent = onSnapshot(contentCollRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.id - a.id)); 
      setContentItems(items);
      localStorage.setItem('creator_content_local', JSON.stringify(items));
    }, (err) => {
      console.warn("Content sync failed", err);
      // Load local backup
      const savedContent = localStorage.getItem('creator_content_local');
      if (savedContent) setContentItems(JSON.parse(savedContent));
    });

    return () => {
      unsubVision();
      unsubContent();
    };
  }, [user]);


  // --- HANDLERS: DATA MANAGEMENT ---
  
  // Generic Saver (Handles both Cloud and Local)
  const persistData = async (type, data, id = null) => {
    // 1. Always save to LocalStorage (speed + backup)
    if (type === 'vision') {
      localStorage.setItem('creator_vision_local', JSON.stringify(data));
    } else if (type.startsWith('content')) {
      // For content list, we pass the full list to local storage
      if (type === 'content_list') {
         localStorage.setItem('creator_content_local', JSON.stringify(data));
         return; 
      }
    }

    // 2. Try Cloud if Online
    if (!isOfflineMode && user) {
      try {
        if (type === 'vision') {
          await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'vision_board', 'main'), data);
        } else if (type === 'content_update') {
           await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'content_planner', id), data, { merge: true });
        } else if (type === 'content_delete') {
           await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'content_planner', id));
        }
      } catch (e) {
        console.error("Cloud save failed:", e);
        // Optional: show a toast here "Saved locally only"
      }
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      alert("Login failed: " + error.message);
    }
    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setVision(DEFAULT_VISION);
    setContentItems([]);
  };

  // Vision Handlers
  const updateVision = (path, value) => {
    const newVision = { ...vision };
    const { pillar, sectionIdx, itemIdx, field } = path;
    if (field === 'message') newVision[pillar].message = value;
    if (field === 'sectionTitle') newVision[pillar].sections[sectionIdx].title = value;
    if (field === 'item') newVision[pillar].sections[sectionIdx].items[itemIdx] = value;
    setVision(newVision);
    persistData('vision', newVision);
  };
  
  const addItem = (sectionIdx) => {
    const newVision = { ...vision };
    newVision[activeTab].sections[sectionIdx].items.push("New Entry");
    setVision(newVision);
    persistData('vision', newVision);
  };

  const deleteItem = (sectionIdx, itemIdx) => {
    const newVision = { ...vision };
    newVision[activeTab].sections[sectionIdx].items.splice(itemIdx, 1);
    setVision(newVision);
    persistData('vision', newVision);
  };

  const addSection = () => {
    const newVision = { ...vision };
    newVision[activeTab].sections.push({ title: "New Category", items: ["New Item"] });
    setVision(newVision);
    persistData('vision', newVision);
  };

  const deleteSection = (sectionIdx) => {
    const newVision = { ...vision };
    newVision[activeTab].sections.splice(sectionIdx, 1);
    setVision(newVision);
    persistData('vision', newVision);
  };

  // Content Handlers
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!newItem.title) return;

    const itemData = {
      ...newItem,
      updatedAt: new Date().toISOString()
    };

    if (editingId) {
      // Update local state
      const updatedItems = contentItems.map(item => item.id === editingId ? { ...itemData, id: editingId } : item);
      setContentItems(updatedItems);
      persistData('content_update', itemData, editingId);
      persistData('content_list', updatedItems); 
    } else {
      const newId = String(Date.now());
      const newItemWithId = { ...itemData, id: newId };
      const updatedItems = [newItemWithId, ...contentItems];
      setContentItems(updatedItems);
      persistData('content_update', itemData, newId);
      persistData('content_list', updatedItems);
    }
    setIsFormOpen(false);
  };

  const handleDeleteContent = async (id) => {
    if (window.confirm("⚠️ Are you sure you want to delete this content idea?")) {
      const updatedItems = contentItems.filter(i => i.id !== id);
      setContentItems(updatedItems);
      persistData('content_delete', null, id);
      persistData('content_list', updatedItems);
    }
  };

  // --- UI HELPERS ---
  const openNewItemForm = () => {
    setEditingId(null);
    setNewItem({ title: "", pillar: "", platforms: [], format: "Reel", status: "Idea", date: "", notes: "" });
    setIsFormOpen(true);
  };

  const handleDateClick = (year, month, day) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setEditingId(null);
    setNewItem({ title: "", pillar: "", platforms: [], format: "Reel", status: "Idea", date: dateString, notes: "" });
    setIsFormOpen(true);
  };

  const startEditing = (item, e) => {
    if (e) e.stopPropagation();
    setEditingId(item.id);
    setNewItem({ ...item });
    setIsFormOpen(true);
  };

  const togglePlatform = (platform) => {
    if (newItem.platforms.includes(platform)) {
      setNewItem({ ...newItem, platforms: newItem.platforms.filter(p => p !== platform) });
    } else {
      setNewItem({ ...newItem, platforms: [...newItem.platforms, platform] });
    }
  };

  const generateGCalLink = (item) => {
    if (!item.date) return "#";
    const [year, month, day] = item.date.split('-');
    const startString = `${year}${month}${day}`;
    
    const startDateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    startDateObj.setDate(startDateObj.getDate() + 1);
    const endYear = startDateObj.getFullYear();
    const endMonth = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const endDay = String(startDateObj.getDate()).padStart(2, '0');
    const endString = `${endYear}${endMonth}${endDay}`;

    const title = encodeURIComponent(`[Content] ${item.title}`);
    const details = encodeURIComponent(
      `Pillar: ${item.pillar}\nPlatforms: ${item.platforms.join(", ")}\nFormat: ${item.format}\nStatus: ${item.status}\n\nNOTES:\n${item.notes || 'No notes added.'}`
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${startString}/${endString}`;
  };

  const filteredItems = contentItems.filter(item => {
    if (listFilter === 'scheduled') return item.date && item.date !== "";
    if (listFilter === 'backlog') return !item.date || item.date === "";
    return true;
  });

  const resetAllData = () => {
    if(window.confirm("⚠️ RESET LOCAL DATA? This clears the cache. If cloud is connected, data will reappear.")) {
      localStorage.removeItem('creator_vision_local');
      localStorage.removeItem('creator_content_local');
      window.location.reload();
    }
  };

  // --- COMPONENTS ---
  const Editable = ({ value, onSave, className, isArea = false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localVal, setLocalVal] = useState(value);

    useEffect(() => { setLocalVal(value); }, [value]);

    if (isEditing) {
      return isArea ? (
        <textarea
          autoFocus
          className={`w-full bg-white/50 border border-neutral-300 rounded p-2 outline-none ${className}`}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={() => { onSave(localVal); setIsEditing(false); }}
        />
      ) : (
        <input
          autoFocus
          className={`w-full bg-white/50 border border-neutral-300 rounded px-1 outline-none ${className}`}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={() => { onSave(localVal); setIsEditing(false); }}
          onKeyDown={(e) => e.key === 'Enter' && (onSave(localVal), setIsEditing(false))}
        />
      );
    }
    return <div onClick={() => setIsEditing(true)} className={`cursor-pointer hover:bg-black/5 rounded px-1 -mx-1 transition-colors ${className}`}>{value}</div>;
  };

  const Calendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); 
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

    const getItemsForDay = (day) => {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return contentItems.filter(item => item.date === dateString);
    };

    return (
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
            <CalendarIcon className="text-neutral-400" size={20} />
            {monthNames[month]} {year}
          </h3>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="p-2 hover:bg-neutral-100 rounded-full transition-colors"><ChevronLeft size={20}/></button>
            <button onClick={() => setCurrentDate(new Date())} className="text-xs font-bold text-neutral-500 hover:text-neutral-900 px-3 py-2 rounded-lg hover:bg-neutral-100">Today</button>
            <button onClick={nextMonth} className="p-2 hover:bg-neutral-100 rounded-full transition-colors"><ChevronRight size={20}/></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px bg-neutral-100 border border-neutral-100 rounded-lg overflow-hidden">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="bg-neutral-50 p-3 text-center text-xs font-bold text-neutral-400 uppercase tracking-wide">{d}</div>
          ))}
          {[...Array(firstDayOfMonth)].map((_, i) => <div key={`empty-${i}`} className="bg-white min-h-[100px] p-2" />)}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1;
            const dayItems = getItemsForDay(day);
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            return (
              <div key={day} onClick={() => handleDateClick(year, month, day)} className={`min-h-[100px] p-2 transition-colors cursor-pointer group ${isToday ? 'bg-blue-50/50 ring-2 ring-inset ring-blue-500 z-10' : 'bg-white hover:bg-neutral-50'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className={`text-sm font-medium ${isToday ? 'text-blue-700 font-bold' : 'text-neutral-400 group-hover:text-neutral-600'}`}>{day}</div>
                  {isToday && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>}
                  <div className="opacity-0 group-hover:opacity-100 text-neutral-300"><Plus size={14} /></div>
                </div>
                <div className="space-y-1">
                  {dayItems.map(item => {
                    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS["Idea"];
                    return (
                      <div key={item.id} onClick={(e) => startEditing(item, e)} className={`text-[10px] p-1.5 rounded border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} truncate cursor-pointer hover:opacity-80 transition-opacity shadow-sm`} title={`${item.title} (${item.status})`}>
                         <span className="font-bold mr-1">•</span>{item.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- RENDER: LOADING ---
  if (isAuthChecking) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FDFDFD]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-neutral-300" size={48} />
          <p className="text-neutral-400 font-medium">Starting App...</p>
        </div>
      </div>
    );
  }

  // --- RENDER: LOGIN ---
  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#FAFAFA] p-6 text-center">
        <div className="mb-8 p-4 bg-white rounded-2xl shadow-xl shadow-neutral-100">
          <Sparkles className="w-12 h-12 text-blue-600 mb-2 mx-auto" />
          <h1 className="text-2xl font-bold text-neutral-900">Creator Vision</h1>
          <p className="text-neutral-500">Sync your strategy across all devices.</p>
        </div>
        
        <button 
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="flex items-center gap-3 bg-neutral-900 text-white px-8 py-4 rounded-xl font-medium hover:bg-neutral-800 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg shadow-neutral-900/20"
        >
          {isLoggingIn ? <Loader2 className="animate-spin" /> : <Cloud size={20} />}
          Sign in with Google
        </button>
        <p className="mt-6 text-xs text-neutral-400 max-w-xs leading-relaxed">
          This connects to your private cloud database. <br/>
          Enable "Google Sign-In" in your Firebase console first.
        </p>
      </div>
    );
  }

  // --- RENDER: APP (LOADING DATA) ---
  if (isLoading && !vision) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FDFDFD]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-neutral-300" size={48} />
          <p className="text-neutral-400 font-medium">Downloading your vision...</p>
        </div>
      </div>
    );
  }

  const CategoryIcon = CATEGORY_CONFIG[activeTab].icon;
  const categoryColor = CATEGORY_CONFIG[activeTab].colors;

  return (
    <div className="flex h-screen bg-[#FDFDFD] text-neutral-800 font-sans overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-100 flex flex-col transform transition-transform duration-300 md:relative md:translate-x-0 ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Creator Vision</h1>
          
          {/* Cloud Status Indicator */}
          <div className={`mt-2 inline-flex items-center gap-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${isOfflineMode ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>
            {isOfflineMode ? <CloudOff size={12} /> : <Wifi size={12} />}
            {isOfflineMode ? "Offline Mode" : "Cloud Sync On"}
          </div>
          <div className="text-[10px] text-neutral-300 mt-1 truncate">{user.email}</div>
        </div>

        <div className="px-4 space-y-6 flex-1">
          <div>
            <p className="px-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Execution</p>
            <button onClick={() => { setCurrentView('planner'); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'planner' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-50'}`}>
              <CalendarIcon size={18} />
              <span className="font-medium">Content Planner</span>
            </button>
          </div>
          <div>
            <p className="px-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Strategy</p>
            <button onClick={() => { setCurrentView('vision'); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'vision' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-50'}`}>
              <Layout size={18} />
              <span className="font-medium">Vision Board</span>
            </button>
          </div>
        </div>

        {currentView === 'vision' && (
          <div className="p-4 border-t border-neutral-100 bg-neutral-50/50">
            <p className="px-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Categories</p>
            <nav className="space-y-1">
              {Object.keys(vision).map((key) => {
                const Icon = CATEGORY_CONFIG[key].icon;
                const colors = CATEGORY_CONFIG[key].colors;
                return (
                <button key={key} onClick={() => setActiveTab(key)} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${activeTab === key ? `${colors.text} bg-white shadow-sm font-semibold` : `text-neutral-500 hover:text-neutral-800`}`}>
                  <div className={`scale-75 ${activeTab === key ? colors.text : "text-neutral-400"}`}><Icon className="w-5 h-5" /></div>
                  <span>{key}</span>
                </button>
              )})}
            </nav>
          </div>
        )}

        <div className="p-4 border-t border-neutral-100">
           <button onClick={handleLogout} className="flex items-center gap-2 text-[10px] text-neutral-400 hover:text-red-500 transition-colors w-full px-4">
             <LogOut size={12} /> Sign Out
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative bg-[#FAFAFA]">
        <div className="md:hidden p-4 flex justify-between items-center bg-white border-b border-neutral-100 sticky top-0 z-20">
          <span className="font-bold">Creator Vision</span>
          <button onClick={() => setShowMobileMenu(!showMobileMenu)}><Menu size={24} /></button>
        </div>

        {currentView === 'planner' && (
          <div className="max-w-6xl mx-auto px-6 py-6 md:px-12 flex flex-col gap-6">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-neutral-900">Content Planner</h2>
                <p className="text-neutral-500 mt-1">Schedule your genius.</p>
              </div>
              <button onClick={openNewItemForm} className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-neutral-900/20">
                <Plus size={16} /> New Idea
              </button>
            </div>

            {/* Input Form Modal */}
            {isFormOpen && (
              <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">{editingId ? 'Edit Content' : 'Add New Content'}</h3>
                    <button onClick={() => setIsFormOpen(false)} className="text-neutral-400 hover:text-neutral-900"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleSaveItem} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="col-span-1 md:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Content Idea / Title</label>
                      <input className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-200" placeholder="e.g., Behind the scenes..." value={newItem.title} onChange={(e) => setNewItem({...newItem, title: e.target.value})} autoFocus />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Pillar</label>
                      <select className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 outline-none" value={newItem.pillar} onChange={(e) => setNewItem({...newItem, pillar: e.target.value})}>
                        <option value="">Select Pillar...</option>
                        {vision.What.sections[0].items.map((pillar, idx) => (<option key={idx} value={pillar}>{pillar}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-2">Platforms</label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_PLATFORMS.map(p => {
                          const isSelected = newItem.platforms.includes(p);
                          return (
                            <button key={p} type="button" onClick={() => togglePlatform(p)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isSelected ? "bg-neutral-800 text-white border-neutral-800" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400"}`}>{p}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Status</label>
                      <select className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 outline-none" value={newItem.status} onChange={(e) => setNewItem({...newItem, status: e.target.value})}>
                        {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Target Date <span className="text-neutral-400 font-normal">(Optional)</span></label>
                      <input type="date" className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 outline-none" value={newItem.date} onChange={(e) => setNewItem({...newItem, date: e.target.value})} />
                    </div>
                    <div className="col-span-1 md:col-span-2 lg:col-span-2">
                       <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Notes / Script / Ideas</label>
                       <textarea className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 outline-none h-10 focus:h-24 transition-all resize-none" placeholder="Details..." value={newItem.notes} onChange={(e) => setNewItem({...newItem, notes: e.target.value})} />
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors shadow-md shadow-blue-600/20">
                        {editingId ? 'Update Content' : 'Add to Plan'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="flex-none"><Calendar /></div>

            <div className="h-[600px] flex flex-col bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50 flex justify-between items-center sticky top-0 z-20">
                <div className="flex gap-4">
                   <button onClick={() => setListFilter('all')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${listFilter === 'all' ? 'text-neutral-900 border-neutral-900' : 'text-neutral-400 border-transparent hover:text-neutral-600'}`}>All Items</button>
                   <button onClick={() => setListFilter('scheduled')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${listFilter === 'scheduled' ? 'text-blue-600 border-blue-600' : 'text-neutral-400 border-transparent hover:text-neutral-600'}`}>Scheduled</button>
                   <button onClick={() => setListFilter('backlog')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${listFilter === 'backlog' ? 'text-purple-600 border-purple-600' : 'text-neutral-400 border-transparent hover:text-neutral-600'}`}>Idea Backlog</button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-white shadow-sm">
                    <tr className="border-b border-neutral-100 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                      <th className="px-6 py-4 bg-neutral-50">Idea</th>
                      <th className="px-6 py-4 bg-neutral-50">Pillar</th>
                      <th className="px-6 py-4 bg-neutral-50">Notes</th>
                      <th className="px-6 py-4 bg-neutral-50">Status</th>
                      <th className="px-6 py-4 bg-neutral-50">Date</th>
                      <th className="px-6 py-4 text-right bg-neutral-50">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredItems.length > 0 ? filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors group">
                        <td className="px-6 py-4 font-medium text-neutral-800">
                          {item.title}
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {item.platforms.map(p => (<span key={p} className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-500 border border-neutral-200">{p}</span>))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-500">
                          <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-medium border border-blue-100 whitespace-nowrap">{item.pillar}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-500 max-w-[200px]"><div className="truncate" title={item.notes}>{item.notes || <span className="text-neutral-300 italic">--</span>}</div></td>
                        <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border border-transparent whitespace-nowrap ${STATUS_COLORS[item.status].bg} ${STATUS_COLORS[item.status].text}`}>{item.status}</span></td>
                        <td className="px-6 py-4 text-sm text-neutral-500 font-mono whitespace-nowrap">{item.date ? item.date : <span className="text-neutral-300 text-xs italic">Unscheduled</span>}</td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          <button onClick={() => startEditing(item)} className="text-neutral-300 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-full" title="Edit"><Edit2 size={16} /></button>
                          {item.date && (<a href={generateGCalLink(item)} target="_blank" rel="noreferrer" className="text-neutral-300 hover:text-green-600 transition-colors p-2 hover:bg-green-50 rounded-full" title="Add to Google Calendar"><CalendarIcon size={16} /></a>)}
                          <button onClick={() => handleDeleteContent(item.id)} className="text-neutral-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full" title="Delete"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="6" className="px-6 py-12 text-center text-neutral-400 italic">No items found in this view.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentView === 'vision' && (
          <div className="max-w-5xl mx-auto px-6 py-12 md:px-12 md:py-16 animate-in fade-in duration-500 overflow-y-auto h-full">
            <header className="mb-10">
              <div className={`inline-flex items-center justify-center p-3 rounded-2xl mb-6 ${categoryColor.bg} ${categoryColor.text}`}><CategoryIcon className="w-5 h-5" /></div>
              <h2 className="text-4xl font-bold text-neutral-900 mb-2">{activeTab}</h2>
              <p className="text-neutral-500 text-lg">{vision[activeTab].description}</p>
            </header>

            {activeTab === "What" && (
              <div className={`relative mb-12 p-8 rounded-3xl ${categoryColor.bg} border ${categoryColor.border}`}>
                <div className={`absolute top-0 left-8 -translate-y-1/2 bg-white px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase border ${categoryColor.border} ${categoryColor.text} shadow-sm`}>Core Message</div>
                <Editable isArea value={vision.What.message} className="text-xl md:text-2xl font-serif italic text-neutral-800 leading-relaxed bg-transparent" onSave={(val) => updateVision({ pillar: 'What', field: 'message' }, val)} />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
              {vision[activeTab].sections.map((section, sIdx) => (
                <div key={sIdx} className="group bg-white rounded-2xl p-6 border border-neutral-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${categoryColor.bg} ${categoryColor.text}`}><Editable value={section.title} onSave={(val) => updateVision({ pillar: activeTab, sectionIdx: sIdx, field: 'sectionTitle' }, val)} /></div>
                    <button onClick={() => deleteSection(sIdx)} className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-400 transition-opacity p-1"><Trash2 size={14} /></button>
                  </div>
                  <ul className="space-y-3">
                    {section.items.map((item, iIdx) => (
                      <li key={iIdx} className="flex items-start gap-3 group/item">
                        <div className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${categoryColor.accent}`} />
                        <div className="flex-1"><Editable value={item} className="text-neutral-600 leading-relaxed text-sm hover:text-neutral-900" onSave={(val) => updateVision({ pillar: activeTab, sectionIdx: sIdx, itemIdx: iIdx, field: 'item' }, val)} /></div>
                        <button onClick={() => deleteItem(sIdx, iIdx)} className="opacity-0 group-hover/item:opacity-100 text-neutral-200 hover:text-red-400 transition-opacity pt-1"><X size={12} /></button>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => addItem(sIdx)} className={`mt-6 flex items-center gap-2 text-xs font-semibold ${categoryColor.text} opacity-60 hover:opacity-100 transition-opacity`}><Plus size={14} /> Add Item</button>
                </div>
              ))}
              <button onClick={addSection} className="flex flex-col items-center justify-center gap-3 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 transition-all min-h-[200px]">
                <div className="p-3 bg-white rounded-full shadow-sm"><Plus size={20} /></div>
                <span className="font-medium text-sm">Add New Category</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

