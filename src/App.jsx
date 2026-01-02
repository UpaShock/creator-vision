import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { 
  Plus, Trash2, Edit2, Layout, Calendar as CalendarIcon, 
  Type, User, Sparkles, DollarSign, Cloud, LogOut, Loader2, 
  Wifi, CloudOff, AlertTriangle, Menu, RotateCcw 
} from 'lucide-react';

// --- 1. CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDZvfdi7-3cm4loOEl6-TywQYQNzbNbPtI",
  authDomain: "creator-vision-app.firebaseapp.com",
  projectId: "creator-vision-app",
  storageBucket: "creator-vision-app.firebasestorage.app",
  messagingSenderId: "861262403958",
  appId: "1:861262403958:web:be21b85218da0a2ddfc257"
};

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center p-6 bg-red-50 text-red-900 text-center">
          <AlertTriangle size={48} className="mb-4 text-red-600" />
          <h1 className="text-xl font-bold">App Crash Detected</h1>
          <p className="text-sm mb-4">The app encountered a critical error.</p>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold">
            Hard Reset App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- INITIALIZE FIREBASE SAFELY ---
let app, auth, db, googleProvider;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} catch (e) {
  console.error("Firebase Init Failed", e);
}

const appId = 'creator-vision-production';

// --- YOUR SPECIFIC DATA TEMPLATE ---
const DEFAULT_VISION = {
  "What": {
    description: "Message & Content",
    message: "Be brave enough to chase your dreams. Consistent action is the key to success and failures are just milestones towards bigger successes.",
    sections: [
      { 
        title: "Content Pillars", 
        items: [
          "Performances (Tabla / Multi-instrument)", 
          "Compositions (Film / Game Scores)", 
          "Brand Lead Content", 
          "Collaboration Posts", 
          "Personal Story"
        ] 
      }
    ]
  },
  "Who": {
    description: "My Target Audience",
    sections: [
      { 
        title: "Demographics", 
        items: [
          "18-40 year olds", 
          "US & European Based", 
          "Film Composers & Directors", 
          "Music Producers & Supervisors",
          "Brands seeking Musicians"
        ] 
      },
      { 
        title: "Psychographics", 
        items: [
          "Curious musicians", 
          "Seekers of inspiration", 
          "Directors looking for Composers", 
          "Beginner Composers seeking tips"
        ] 
      }
    ]
  },
  "Uniqueness": {
    description: "My Truth & Authenticity",
    sections: [
      { 
        title: "Experience", 
        items: [
          "Berklee Grad (Film/Media Scoring)", 
          "Award-winning Film Composer", 
          "Tabla Player (Global Styles)", 
          "The Dentist Pivot (BDS Degree)"
        ] 
      },
      { 
        title: "Pains", 
        items: [
          "Integrating Academic Knowledge", 
          "Maintaining Consistency", 
          "Overcoming 'Lost Years' in Dentistry", 
          "Funding Education"
        ] 
      },
      { 
        title: "Passion", 
        items: [
          "Service to the Planet", 
          "Unity through Music", 
          "Seeking Discomfort / Travel", 
          "Rhythmic Storytelling"
        ] 
      },
      { 
        title: "Skills", 
        items: [
          "Film & Game Composition", 
          "Orchestration & Arrangement", 
          "Tabla Performance", 
          "Music Production"
        ] 
      }
    ]
  },
  "Monetisation": {
    description: "My Ecosystem",
    sections: [
      { title: "One Offs", items: ["Brand Deals", "Commissions"] },
      { title: "Ongoing", items: ["Tabla Course (Passive)", "Royalties"] },
      { title: "High Value Partners", items: ["Spitfire Audio", "ROLI", "Bleeding Fingers", "East West", "iZotope", "Shure", "Telefunken", "AKG"] },
      { title: "Reinvest", items: ["Cultural Travel", "Audio/Video Gear"] }
    ]
  }
};

const CATEGORY_CONFIG = {
  "What": { icon: Type, color: "text-blue-600", bg: "bg-blue-50" },
  "Who": { icon: User, color: "text-violet-600", bg: "bg-violet-50" },
  "Uniqueness": { icon: Sparkles, color: "text-emerald-600", bg: "bg-emerald-50" },
  "Monetisation": { icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" }
};

const STATUS_COLORS = {
  "Idea": { bg: "bg-neutral-100", text: "text-neutral-600" },
  "Scripting": { bg: "bg-yellow-50", text: "text-yellow-700" },
  "Filming": { bg: "bg-blue-50", text: "text-blue-700" },
  "Editing": { bg: "bg-purple-50", text: "text-purple-700" },
  "Posted": { bg: "bg-green-50", text: "text-green-700" }
};

// --- MAIN APP ---
const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vision, setVision] = useState(DEFAULT_VISION);
  const [content, setContent] = useState([]);
  const [activeTab, setActiveTab] = useState("What");
  const [view, setView] = useState("planner");
  const [status, setStatus] = useState("Starting...");
  
  // Planner State
  const [listFilter, setListFilter] = useState("all"); 
  const [newItem, setNewItem] = useState({ title: "", pillar: "", platforms: [], format: "Reel", status: "Idea", date: "", notes: "" });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Auth Listener
  useEffect(() => {
    setStatus("Connecting Auth...");
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setStatus("Loading Data...");
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Data Listener
  useEffect(() => {
    if (!user) return;
    
    // Vision
    const unsubV = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'vision_board', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Fallback merge
        setVision(prev => ({
          ...DEFAULT_VISION,
          ...data,
          What: { ...DEFAULT_VISION.What, ...data.What },
          Who: { ...DEFAULT_VISION.Who, ...data.Who },
          Uniqueness: { ...DEFAULT_VISION.Uniqueness, ...data.Uniqueness },
          Monetisation: { ...DEFAULT_VISION.Monetisation, ...data.Monetisation },
        }));
      } else {
        setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'vision_board', 'main'), DEFAULT_VISION);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setStatus("Offline Mode");
      setLoading(false);
    });

    // Content
    const unsubC = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'content_planner'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setContent(list.sort((a,b) => (b.id||0) - (a.id||0)));
    });

    return () => { unsubV(); unsubC(); };
  }, [user]);

  // Actions
  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (e) { alert(e.message); }
  };

  const handleLogout = () => { signOut(auth); setVision(DEFAULT_VISION); setContent([]); };

  const resetToTemplate = async () => {
    if(!user) return;
    if(window.confirm("⚠️ Reset ALL Vision Board data to the 'Berklee/Dentist' template? This overwrites changes.")) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'vision_board', 'main'), DEFAULT_VISION);
        window.location.reload();
      } catch (e) { alert(e.message); }
    }
  };

  const saveVision = (data) => {
    setVision(data);
    if(user) setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'vision_board', 'main'), data);
  };

  const updateSection = (idx, key, val) => {
    const v = JSON.parse(JSON.stringify(vision));
    if(!v[activeTab].sections) v[activeTab].sections = [];
    v[activeTab].sections[idx][key] = val;
    saveVision(v);
  };

  const updateVisionField = (path, val) => {
    const v = JSON.parse(JSON.stringify(vision));
    const { pillar, field } = path;
    if(field === 'msg') v[pillar].message = val;
    saveVision(v);
  };

  const addSection = () => {
    const v = JSON.parse(JSON.stringify(vision));
    if(!v[activeTab].sections) v[activeTab].sections = [];
    v[activeTab].sections.push({ title: "New Section", items: [] });
    saveVision(v);
  };

  const deleteSection = (idx) => {
    const v = JSON.parse(JSON.stringify(vision));
    v[activeTab].sections.splice(idx, 1);
    saveVision(v);
  };

  const addItem = (secIdx) => {
    const v = JSON.parse(JSON.stringify(vision));
    v[activeTab].sections[secIdx].items.push("New Item");
    saveVision(v);
  };

  const updateItem = (secIdx, itemIdx, val) => {
    const v = JSON.parse(JSON.stringify(vision));
    v[activeTab].sections[secIdx].items[itemIdx] = val;
    saveVision(v);
  };

  const deleteItem = (secIdx, itemIdx) => {
    const v = JSON.parse(JSON.stringify(vision));
    v[activeTab].sections[secIdx].items.splice(itemIdx, 1);
    saveVision(v);
  };

  // Content Actions
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!newItem.title || !user) return;
    const data = { ...newItem, updatedAt: new Date().toISOString() };
    const id = editingId || String(Date.now());
    
    // Optimistic
    let newItems = [...content];
    if(editingId) newItems = newItems.map(i => i.id === id ? { ...data, id } : i);
    else newItems = [{ ...data, id }, ...newItems];
    setContent(newItems);
    setIsFormOpen(false);

    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'content_planner', id), data, { merge: true });
  };

  const deleteContent = async (id) => {
    if(window.confirm("Delete this item?")) {
      setContent(content.filter(i => i.id !== id));
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'content_planner', id));
    }
  };

  // UI Helpers
  const handleDateClick = (year, month, day) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setEditingId(null);
    setNewItem({ title: "", pillar: "", platforms: [], format: "Reel", status: "Idea", date: dateString, notes: "" });
    setIsFormOpen(true);
  };

  const togglePlatform = (platform) => {
    if (newItem.platforms.includes(platform)) setNewItem({ ...newItem, platforms: newItem.platforms.filter(p => p !== platform) });
    else setNewItem({ ...newItem, platforms: [...newItem.platforms, platform] });
  };

  const filteredContent = content.filter(i => {
    if (listFilter === 'scheduled') return i.date;
    if (listFilter === 'backlog') return !i.date;
    return true;
  });

  // Render Helpers
  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin mb-4" />
      <p className="text-sm text-gray-500">{status}</p>
    </div>
  );

  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <h1 className="text-2xl font-bold mb-2">Creator Vision</h1>
      <button onClick={handleLogin} className="bg-black text-white px-6 py-3 rounded-xl flex gap-2 font-bold shadow-lg">
        <Cloud /> Sign In
      </button>
    </div>
  );

  const CatIcon = CATEGORY_CONFIG[activeTab]?.icon || Type;
  const catColor = CATEGORY_CONFIG[activeTab] || CATEGORY_CONFIG["What"];
  
  // Extract Pillars for Dropdown
  const pillars = vision.What?.sections?.find(s => s.title.includes("Pillars"))?.items || [];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <div className="w-16 md:w-64 bg-white border-r flex flex-col items-center md:items-stretch py-6 flex-shrink-0">
        <div className="px-4 mb-8 hidden md:block">
          <h1 className="font-bold text-lg">Creator Vision</h1>
          <p className="text-xs text-green-600 flex items-center gap-1 mt-1"><Wifi size={10}/> Online</p>
        </div>
        
        <div className="flex-1 space-y-2 px-2">
          <button onClick={() => setView('planner')} className={`p-3 rounded-xl flex items-center gap-3 w-full transition ${view === 'planner' ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-500'}`}>
            <CalendarIcon size={20} /> <span className="hidden md:block text-sm font-medium">Planner</span>
          </button>
          <button onClick={() => setView('vision')} className={`p-3 rounded-xl flex items-center gap-3 w-full transition ${view === 'vision' ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-500'}`}>
            <Layout size={20} /> <span className="hidden md:block text-sm font-medium">Vision</span>
          </button>
        </div>

        <div className="p-2 border-t space-y-1">
          <button onClick={resetToTemplate} className="p-3 w-full flex items-center justify-center md:justify-start gap-2 text-gray-400 hover:bg-gray-100 rounded-lg">
            <RotateCcw size={18} /> <span className="hidden md:block text-xs font-bold uppercase">Reset Data</span>
          </button>
          <button onClick={handleLogout} className="p-3 w-full flex items-center justify-center md:justify-start gap-2 text-red-500 hover:bg-red-50 rounded-lg">
            <LogOut size={18} /> <span className="hidden md:block text-xs font-bold uppercase">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {view === 'planner' && (
          <div className="p-6 md:p-12">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-3xl font-bold">Content Planner</h2>
              <button onClick={() => { setEditingId(null); setNewItem({title:'', pillar:'', platforms:[], format:'Reel', status:'Idea', date:'', notes:''}); setIsFormOpen(true); }} className="bg-black text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"><Plus size={16}/> New</button>
            </div>

            {/* FORM MODAL */}
            {isFormOpen && (
              <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg">
                  <h3 className="font-bold text-lg mb-4">{editingId ? 'Edit' : 'New'} Content</h3>
                  <div className="space-y-3">
                    <input className="w-full border p-2 rounded" placeholder="Title" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} />
                    <div className="grid grid-cols-2 gap-3">
                      <select className="border p-2 rounded" value={newItem.pillar} onChange={e => setNewItem({...newItem, pillar: e.target.value})}>
                        <option value="">Select Pillar</option>
                        {pillars.map((i, idx) => <option key={idx} value={i}>{i}</option>)}
                      </select>
                      <input type="date" className="border p-2 rounded" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {["Instagram", "YouTube", "TikTok", "Newsletter"].map(p => {
                          const isSelected = newItem.platforms.includes(p);
                          return (
                            <button key={p} type="button" 
                              onClick={() => {
                                if (isSelected) setNewItem({...newItem, platforms: newItem.platforms.filter(x => x !== p)});
                                else setNewItem({...newItem, platforms: [...newItem.platforms, p]});
                              }} 
                              className={`px-2 py-1 text-xs border rounded ${isSelected ? 'bg-black text-white' : 'bg-white'}`}>{p}
                            </button>
                          );
                        })}
                    </div>
                    <select className="w-full border p-2 rounded" value={newItem.status} onChange={e => setNewItem({...newItem, status: e.target.value})}>
                      {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <textarea className="w-full border p-2 rounded h-20" placeholder="Notes" value={newItem.notes} onChange={e => setNewItem({...newItem, notes: e.target.value})} />
                    <div className="flex gap-2 justify-end mt-4">
                      <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm text-neutral-500">Cancel</button>
                      <button onClick={saveContent} className="px-4 py-2 bg-black text-white rounded text-sm">Save</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-8">
              {/* Calendar Grid */}
              <div className="p-4 border-b">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold flex items-center gap-2"><CalendarIcon size={16}/> {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))} className="p-1 hover:bg-gray-100 rounded"><RotateCcw className="rotate-90" size={16}/></button>
                    <button onClick={() => setCurrentDate(new Date())} className="text-xs border px-2 rounded hover:bg-gray-50">Today</button>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))} className="p-1 hover:bg-gray-100 rounded"><RotateCcw className="-rotate-90" size={16}/></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-px bg-gray-100 border rounded-lg overflow-hidden">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="bg-gray-50 p-2 text-center text-xs font-bold text-gray-400">{d}</div>)}
                  {[...Array(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay())].map((_, i) => <div key={`empty-${i}`} className="bg-white min-h-[80px]" />)}
                  {[...Array(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate())].map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const items = content.filter(c => c.date === dateStr);
                    return (
                      <div key={day} onClick={() => handleDateClick(currentDate.getFullYear(), currentDate.getMonth(), day)} className="bg-white min-h-[80px] p-1 border-t hover:bg-blue-50 cursor-pointer group">
                        <div className="text-xs text-gray-400 mb-1 group-hover:text-blue-500">{day}</div>
                        {items.map(it => <div key={it.id} className="text-[10px] bg-gray-100 rounded px-1 mb-1 truncate border-l-2 border-blue-500">{it.title}</div>)}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* List View */}
              <div className="flex border-b p-2 gap-2 bg-gray-50">
                {['all', 'scheduled', 'backlog'].map(f => (
                  <button key={f} onClick={() => setListFilter(f)} className={`px-3 py-1 rounded text-xs font-bold uppercase ${listFilter === f ? 'bg-white shadow text-black' : 'text-gray-400'}`}>{f}</button>
                ))}
              </div>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {filteredContent.map(item => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group">
                    <div>
                      <div className="font-medium text-sm">{item.title}</div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{item.pillar || 'No Pillar'}</span>
                        {item.date && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-mono">{item.date}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${STATUS_COLORS[item.status]?.bg} ${STATUS_COLORS[item.status]?.text}`}>{item.status}</span>
                      <button onClick={() => { setEditingId(item.id); setNewItem(item); setIsFormOpen(true); }} className="p-2 text-gray-300 hover:text-blue-500"><Edit2 size={14} /></button>
                      <button onClick={() => deleteContent(item.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
                {filteredContent.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No items found.</div>}
              </div>
            </div>
          </div>
        )}

        {view === 'vision' && (
          <div className="p-6 md:p-12">
            <div className="flex overflow-x-auto gap-2 mb-8 pb-2">
              {Object.keys(CATEGORY_CONFIG).map(cat => (
                <button key={cat} onClick={() => setActiveTab(cat)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${activeTab === cat ? 'bg-black text-white shadow-lg' : 'bg-white text-gray-500 border'}`}>
                  {cat}
                </button>
              ))}
            </div>

            <div className={`p-8 rounded-3xl mb-8 ${catColor.bg} ${catColor.color}`}>
              <div className="flex items-center gap-3 mb-2">
                <CatIcon size={24} />
                <h2 className="text-2xl font-bold">{activeTab}</h2>
              </div>
              <p className="opacity-80">{vision[activeTab]?.description}</p>
            </div>

            {/* MESSAGE BOX */}
            {activeTab === 'What' && (
              <div className={`mb-8 p-6 rounded-xl border-2 border-dashed ${activeColor.border}`}>
                <div className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Core Message</div>
                <textarea 
                  className="w-full bg-transparent text-xl font-serif resize-none focus:outline-none"
                  rows={3}
                  value={vision.What?.message || ""}
                  onChange={(e) => updateVisionField({ pillar: 'What', field: 'msg' }, e.target.value)}
                />
              </div>
            )}

            {/* Editable Sections */}
            <div className="space-y-6">
              {vision[activeTab]?.sections?.map((section, sIdx) => (
                <div key={sIdx} className="bg-white p-6 rounded-2xl border shadow-sm group">
                  <div className="flex justify-between items-center mb-4">
                    <input 
                      value={section.title} 
                      onChange={(e) => updateSection(sIdx, 'title', e.target.value)}
                      className="font-bold text-sm uppercase tracking-wide bg-transparent focus:outline-none focus:ring-2 ring-blue-100 rounded px-1"
                    />
                    <button onClick={() => deleteVisionSection(sIdx)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                  <div className="space-y-2 pl-4 border-l-2 border-gray-100">
                    {section.items.map((item, iIdx) => (
                      <div key={iIdx} className="flex gap-2">
                        <input 
                          value={item}
                          onChange={(e) => updateItem(sIdx, iIdx, e.target.value)}
                          className="w-full text-sm py-1 bg-transparent border-b border-transparent focus:border-gray-200 focus:outline-none"
                        />
                        <button onClick={() => deleteItem(sIdx, iIdx)} className="text-gray-200 hover:text-red-500"><X size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => addItem(sIdx)} className="text-xs font-bold text-gray-400 hover:text-black mt-2 flex items-center gap-1">
                      <Plus size={12} /> Add Item
                    </button>
                  </div>
                </div>
              ))}
              
              <button onClick={addSection} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-gray-400 hover:text-gray-600 transition font-medium text-sm flex items-center justify-center gap-2">
                <Plus size={16} /> Add New Category
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function AppWrapper() {
  return <ErrorBoundary><Dashboard /></ErrorBoundary>;
}


