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
  Plus, Trash2, X, Type, User, Sparkles, DollarSign, Menu, 
  Calendar as CalendarIcon, Layout, Edit2, Save, RotateCcw, 
  Cloud, LogOut, Loader2, CloudOff, Wifi, AlertTriangle
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

// --- ERROR BOUNDARY (The White Screen Killer) ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center p-8 bg-red-50 text-red-900 text-center">
          <AlertTriangle size={48} className="mb-4 text-red-600 mx-auto" />
          <h1 className="text-xl font-bold mb-2">App Crash Detected</h1>
          <p className="mb-4 text-sm">We caught an error to prevent the white screen.</p>
          <pre className="bg-white p-4 rounded border border-red-200 text-xs text-left overflow-auto max-w-full mb-6">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-bold"
          >
            Reset App Data
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- INITIALIZE FIREBASE ---
let app, auth, db, googleProvider;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} catch (e) {
  console.error("Firebase Init Error", e);
}

const appId = 'creator-vision-production'; 

// --- DEFAULTS ---
const CATEGORY_CONFIG = {
  "What": { icon: Type, colors: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100", accent: "bg-blue-600" } },
  "Who": { icon: User, colors: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100", accent: "bg-violet-600" } },
  "Uniqueness": { icon: Sparkles, colors: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", accent: "bg-emerald-600" } },
  "Monetisation": { icon: DollarSign, colors: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100", accent: "bg-amber-600" } }
};

const DEFAULT_VISION = {
  "What": { description: "Message & Content", message: "", sections: [] },
  "Who": { description: "Audience Avatar", sections: [] },
  "Uniqueness": { description: "Authenticity", sections: [] },
  "Monetisation": { description: "Ecosystem", sections: [] }
};

const STATUS_COLORS = {
  "Idea": { bg: "bg-neutral-100", text: "text-neutral-600" },
  "Scripting": { bg: "bg-yellow-50", text: "text-yellow-700" },
  "Filming": { bg: "bg-blue-50", text: "text-blue-700" },
  "Editing": { bg: "bg-purple-50", text: "text-purple-700" },
  "Posted": { bg: "bg-green-50", text: "text-green-700" }
};

// --- MAIN COMPONENT ---
const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [vision, setVision] = useState(DEFAULT_VISION);
  const [contentItems, setContentItems] = useState([]);
  
  // Loading State
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("Initializing...");
  
  // UI State
  const [currentView, setCurrentView] = useState("planner"); 
  const [activeTab, setActiveTab] = useState("What"); 
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [listFilter, setListFilter] = useState("all"); 
  const [newItem, setNewItem] = useState({ title: "", pillar: "", platforms: [], format: "Reel", status: "Idea", date: "", notes: "" });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // 1. AUTH CHECK
  useEffect(() => {
    setStatusText("Connecting to Google...");
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setStatusText("Loading your data...");
      } else {
        setLoading(false); 
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. DATA SYNC
  useEffect(() => {
    if (!user) return;

    // Vision Listener
    const visionRef = doc(db, 'artifacts', appId, 'users', user.uid, 'vision_board', 'main');
    const unsubVision = onSnapshot(visionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setVision(prev => ({
          ...DEFAULT_VISION,
          ...data,
          What: { ...DEFAULT_VISION.What, ...data.What },
          Who: { ...DEFAULT_VISION.Who, ...data.Who },
          Uniqueness: { ...DEFAULT_VISION.Uniqueness, ...data.Uniqueness },
          Monetisation: { ...DEFAULT_VISION.Monetisation, ...data.Monetisation },
        }));
      } else {
        setDoc(visionRef, DEFAULT_VISION);
        setVision(DEFAULT_VISION);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setStatusText("Offline / Error");
      setLoading(false);
    });

    // Content Listener
    const contentRef = collection(db, 'artifacts', appId, 'users', user.uid, 'content_planner');
    const unsubContent = onSnapshot(contentRef, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.id || 0) - (a.id || 0));
      setContentItems(items);
    });

    return () => { unsubVision(); unsubContent(); };
  }, [user]);

  // --- ACTIONS ---
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) { alert(e.message); }
  };

  const handleLogout = () => {
    signOut(auth);
    setVision(DEFAULT_VISION);
    setContentItems([]);
  };

  const saveVision = async (newData) => {
    setVision(newData); 
    if(user) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'vision_board', 'main'), newData);
      } catch(e) { console.error(e); }
    }
  };

  const updateVisionField = (path, val) => {
    const v = JSON.parse(JSON.stringify(vision));
    const { pillar, sectionIdx, idx, field } = path;
    
    if(!v[pillar]) return;
    if(!v[pillar].sections) v[pillar].sections = [];

    if(field === 'msg') v[pillar].message = val;
    if(field === 'secTitle') v[pillar].sections[sectionIdx].title = val;
    if(field === 'item') v[pillar].sections[sectionIdx].items[idx] = val;
    
    saveVision(v);
  };

  const addVisionItem = (secIdx) => {
    const v = JSON.parse(JSON.stringify(vision));
    v[activeTab].sections[secIdx].items.push("New Item");
    saveVision(v);
  };

  const deleteVisionItem = (secIdx, idx) => {
    const v = JSON.parse(JSON.stringify(vision));
    v[activeTab].sections[secIdx].items.splice(idx, 1);
    saveVision(v);
  };

  const addVisionSection = () => {
    const v = JSON.parse(JSON.stringify(vision));
    if(!v[activeTab].sections) v[activeTab].sections = [];
    v[activeTab].sections.push({ title: "New Category", items: [] });
    saveVision(v);
  };

  const deleteVisionSection = (idx) => {
    const v = JSON.parse(JSON.stringify(vision));
    v[activeTab].sections.splice(idx, 1);
    saveVision(v);
  };

  // Content Actions
  const saveContent = async (e) => {
    e.preventDefault();
    if(!newItem.title || !user) return;
    
    const data = { ...newItem, updatedAt: new Date().toISOString() };
    const id = editingId || String(Date.now());
    
    // Optimistic Update
    let newItems = [...contentItems];
    if(editingId) {
      newItems = newItems.map(i => i.id === id ? { ...data, id } : i);
    } else {
      newItems = [{ ...data, id }, ...newItems];
    }
    setContentItems(newItems);
    setIsFormOpen(false);

    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'content_planner', id), data, { merge: true });
  };

  const deleteContent = async (id) => {
    if(window.confirm("Delete this item?")) {
      setContentItems(contentItems.filter(i => i.id !== id));
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'content_planner', id));
    }
  };

  // --- RENDER HELPERS ---
  const activeColor = CATEGORY_CONFIG[activeTab]?.colors || CATEGORY_CONFIG['What'].colors;
  const filteredContent = contentItems.filter(i => {
    if (listFilter === 'scheduled') return i.date;
    if (listFilter === 'backlog') return !i.date;
    return true;
  });

  // --- SCREENS ---
  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-neutral-50">
      <Loader2 className="animate-spin mb-4 text-neutral-400" size={40} />
      <p className="font-mono text-sm text-neutral-500">{statusText}</p>
    </div>
  );

  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center p-6 bg-white text-center">
      <div className="mb-8">
        <Sparkles className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold">Creator Vision</h1>
        <p className="text-neutral-500 mt-2">Sync your strategy.</p>
      </div>
      <button onClick={handleLogin} className="bg-black text-white px-8 py-4 rounded-xl font-medium flex items-center gap-3 shadow-lg hover:scale-105 transition-transform">
        <Cloud size={20} /> Sign In with Google
      </button>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#FDFDFD] text-neutral-800 font-sans overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-100 flex flex-col transform transition-transform duration-300 md:relative md:translate-x-0 ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8">
          <h1 className="text-xl font-bold">Creator Vision</h1>
          <div className="flex items-center gap-2 mt-2 text-[10px] uppercase font-bold text-emerald-600">
            <Wifi size={10} /> Online
          </div>
          <div className="text-[10px] text-neutral-400 mt-1 truncate">{user.email}</div>
        </div>
        <div className="px-4 space-y-2 flex-1">
          <button onClick={() => { setCurrentView('planner'); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentView === 'planner' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}>
            <CalendarIcon size={16} /> Content Planner
          </button>
          <button onClick={() => { setCurrentView('vision'); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentView === 'vision' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}>
            <Layout size={16} /> Vision Board
          </button>
        </div>
        {currentView === 'vision' && (
          <div className="p-4 border-t border-neutral-100 space-y-1">
            <p className="px-2 text-[10px] font-bold text-neutral-400 uppercase">Categories</p>
            {Object.keys(CATEGORY_CONFIG).map(k => (
              <button key={k} onClick={() => { setActiveTab(k); setShowMobileMenu(false); }} className={`w-full text-left px-3 py-2 text-sm rounded ${activeTab === k ? 'bg-neutral-100 font-medium' : 'text-neutral-500'}`}>{k}</button>
            ))}
          </div>
        )}
        <div className="p-4 border-t"><button onClick={handleLogout} className="flex items-center gap-2 text-xs text-red-500"><LogOut size={12} /> Sign Out</button></div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto relative bg-[#FAFAFA]">
        <div className="md:hidden p-4 flex justify-between items-center bg-white border-b sticky top-0 z-20">
          <span className="font-bold">Creator Vision</span>
          <button onClick={() => setShowMobileMenu(!showMobileMenu)}><Menu size={24} /></button>
        </div>

        {currentView === 'planner' && (
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-2xl font-bold">Content Planner</h2>
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
                        {vision.What?.sections?.flatMap(s => s.items).map((i, idx) => <option key={idx} value={i}>{i}</option>)}
                      </select>
                      <input type="date" className="border p-2 rounded" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} />
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

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="flex border-b p-2 gap-2 bg-neutral-50">
                {['all', 'scheduled', 'backlog'].map(f => (
                  <button key={f} onClick={() => setListFilter(f)} className={`px-3 py-1 rounded text-xs font-bold uppercase ${listFilter === f ? 'bg-white shadow text-black' : 'text-neutral-400'}`}>{f}</button>
                ))}
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {filteredContent.map(item => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-neutral-50 group">
                    <div>
                      <div className="font-medium text-sm">{item.title}</div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 rounded text-neutral-500">{item.pillar || 'No Pillar'}</span>
                        {item.date && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-mono">{item.date}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${STATUS_COLORS[item.status]?.bg} ${STATUS_COLORS[item.status]?.text}`}>{item.status}</span>
                      <button onClick={() => { setEditingId(item.id); setNewItem(item); setIsFormOpen(true); }} className="p-2 text-neutral-300 hover:text-blue-500"><Edit2 size={14} /></button>
                      <button onClick={() => deleteContent(item.id)} className="p-2 text-neutral-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
                {filteredContent.length === 0 && <div className="p-8 text-center text-neutral-400 text-sm">No items found.</div>}
              </div>
            </div>
          </div>
        )}

        {currentView === 'vision' && (
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className={`p-6 rounded-2xl mb-8 ${activeColor.bg} ${activeColor.text}`}>
              <h2 className="text-3xl font-bold flex items-center gap-3">
                {activeTab}
              </h2>
              <p className="opacity-80">{vision[activeTab]?.description}</p>
            </div>

            {/* MESSAGE BOX */}
            {activeTab === 'What' && (
              <div className={`mb-8 p-6 rounded-xl border-2 border-dashed ${activeColor.border}`}>
                <div className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Core Message</div>
                <textarea 
                  className="w-full bg-transparent text-xl font-serif resize-none focus:outline-none"
                  rows={2}
                  value={vision.What?.message || ""}
                  onChange={(e) => updateVisionField({ pillar: 'What', field: 'msg' }, e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {vision[activeTab]?.sections?.map((sec, sIdx) => (
                <div key={sIdx} className="bg-white p-6 rounded-xl border shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <input 
                      className="font-bold text-sm uppercase tracking-wide bg-transparent focus:outline-none"
                      value={sec.title}
                      onChange={(e) => updateVisionField({ pillar: activeTab, sectionIdx: sIdx, field: 'secTitle' }, e.target.value)}
                    />
                    <button onClick={() => deleteVisionSection(sIdx)} className="text-neutral-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                  <div className="space-y-2">
                    {sec.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 group">
                        <div className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${activeColor.accent}`} />
                        <input 
                          className="w-full text-sm text-neutral-600 focus:text-black bg-transparent focus:outline-none"
                          value={item}
                          onChange={(e) => updateVisionField({ pillar: activeTab, sectionIdx: sIdx, idx, field: 'item' }, e.target.value)}
                        />
                        <button onClick={() => deleteVisionItem(sIdx, idx)} className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-500"><X size={12} /></button>
                      </div>
                    ))}
                    <button onClick={() => addVisionItem(sIdx)} className="text-xs font-bold text-neutral-400 hover:text-black mt-2 flex items-center gap-1"><Plus size={12}/> Add Item</button>
                  </div>
                </div>
              ))}
              <button onClick={addVisionSection} className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl text-neutral-400 hover:bg-neutral-50 hover:border-neutral-300 transition-all">
                <Plus size={24} />
                <span className="text-sm font-medium mt-2">Add Category</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default function AppWrapper() {
  return <ErrorBoundary><Dashboard /></ErrorBoundary>;
}


