import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  setDoc,
  query,
  orderBy
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  Clock,
  FileText,
  Trash2,
  Printer,
  Users,
  LogOut,
  Lock,
  Unlock,
  Shield,
  PlusCircle,
  DollarSign
} from 'lucide-react';

// Interfaces
interface Contractor {
  id: string;
  name: string;
  email: string;
  rate: number;
}

interface LogEntry {
  id: string;
  type: 'time' | 'material';
  contractorId: string;
  contractorName: string;
  site: string;
  date: string;
  hours?: number;
  description?: string;
  cost: number;
  status: 'Editable' | 'Locked';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(true); // Default to admin for demonstration/UI match
  const [activeTab, setActiveTab] = useState<'logs' | 'directory' | 'monthLock' | 'invoices'>('logs');

  // Auth State (Login Form)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // App State Data
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // New Entry Form State
  const [entryType, setEntryType] = useState<'time' | 'material'>('time');
  const [selectedContractorId, setSelectedContractorId] = useState<string>('');
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [siteLocation, setSiteLocation] = useState<string>('AVRD1');
  const [hoursWorked, setHoursWorked] = useState<string>('');
  const [materialDescription, setMaterialDescription] = useState<string>('');
  const [materialCost, setMaterialCost] = useState<string>('');

  // New Contractor Form State (Directory Tab)
  const [newContractorName, setNewContractorName] = useState('');
  const [newContractorEmail, setNewContractorEmail] = useState('');
  const [newContractorRate, setNewContractorRate] = useState('');

  // Listen to Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && user.email) {
        // Example check for admin privileges based on email domain/address
        setIsAdmin(user.email.toLowerCase().includes('auroraview.com'));
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Firestore Contractors
  useEffect(() => {
    const q = collection(db, 'contractors');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contractorData: Contractor[] = [];
      snapshot.forEach((doc) => {
        contractorData.push({ id: doc.id, ...doc.data() } as Contractor);
      });
      setContractors(contractorData);
      if (contractorData.length > 0 && !selectedContractorId) {
        setSelectedContractorId(contractorData[0].id);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Firestore Logs
  useEffect(() => {
    const q = query(collection(db, 'logs'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData: LogEntry[] = [];
      snapshot.forEach((doc) => {
        logData.push({ id: doc.id, ...doc.data() } as LogEntry);
      });
      setLogs(logData);
    });
    return () => unsubscribe();
  }, []);

  // Authentication Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to sign in.');
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  // Entry Handlers
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const contractor = contractors.find((c) => c.id === selectedContractorId);
    if (!contractor) return alert('Please select a contractor');

    let calculatedCost = 0;
    if (entryType === 'time') {
      const hrs = parseFloat(hoursWorked);
      if (isNaN(hrs) || hrs <= 0) return alert('Please enter valid hours');
      calculatedCost = hrs * contractor.rate;
    } else {
      const cost = parseFloat(materialCost);
      if (isNaN(cost) || cost <= 0) return alert('Please enter a valid cost');
      calculatedCost = cost;
    }

    try {
      await addDoc(collection(db, 'logs'), {
        type: entryType,
        contractorId: contractor.id,
        contractorName: contractor.name,
        site: siteLocation,
        date: workDate,
        hours: entryType === 'time' ? parseFloat(hoursWorked) : null,
        description: entryType === 'material' ? materialDescription : '-',
        cost: calculatedCost,
        status: 'Editable'
      });

      // Reset form input fields
      setHoursWorked('');
      setMaterialDescription('');
      setMaterialCost('');
    } catch (err) {
      console.error('Error adding log entry: ', err);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this log entry?')) {
      await deleteDoc(doc(db, 'logs', id));
    }
  };

  // Contractor / User Management Handlers
  const handleAddContractor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContractorName || !newContractorEmail || !newContractorRate) return;

    try {
      await addDoc(collection(db, 'contractors'), {
        name: newContractorName,
        email: newContractorEmail,
        rate: parseFloat(newContractorRate)
      });
      setNewContractorName('');
      setNewContractorEmail('');
      setNewContractorRate('');
    } catch (err) {
      console.error('Error adding contractor: ', err);
    }
  };

  const handleDeleteContractor = async (contractorId: string) => {
    if (window.confirm('Are you sure you want to delete this contractor profile?')) {
      try {
        await deleteDoc(doc(db, 'contractors', contractorId));
      } catch (err) {
        console.error('Error deleting contractor: ', err);
      }
    }
  };

  // Render Login Screen if not logged in
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl max-w-md w-full shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold">AuroraView Login</h1>
          </div>
          {authError && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded mb-4 text-sm">
              {authError}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded p-2.5 text-white focus:outline-none focus:border-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Password</label>
              <input
                type="password"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded p-2.5 text-white focus:outline-none focus:border-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 font-semibold py-2.5 rounded transition duration-200"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-500" />
            AuroraView System
          </h1>
          <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
            <span>Logged In As <strong className="text-slate-200">{currentUser.email}</strong></span>
            {isAdmin && (
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3" /> Admin Access
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 px-4 py-2 rounded text-sm font-medium transition"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </header>

      {/* Navigation Tabs */}
      <nav className="max-w-6xl mx-auto my-6 flex gap-3">
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
            activeTab === 'logs' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" /> Log Entries
        </button>
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
            activeTab === 'directory' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" /> Directory & Rates
        </button>
        <button
          onClick={() => setActiveTab('monthLock')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
            activeTab === 'monthLock' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Lock className="w-4 h-4" /> Month Lock
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
            activeTab === 'invoices' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" /> Invoices
        </button>
      </nav>

      <main className="max-w-6xl mx-auto space-y-6">
        {/* TAB 1: LOG ENTRIES */}
        {activeTab === 'logs' && (
          <>
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-blue-400">
                <PlusCircle className="w-5 h-5" /> Record New Entry
              </h2>

              <div className="flex gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setEntryType('time')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border ${
                    entryType === 'time'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Clock className="w-4 h-4" /> Log Time (Hours)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('material')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border ${
                    entryType === 'material'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <DollarSign className="w-4 h-4" /> Log Material Expense
                </button>
              </div>

              <form onSubmit={handleSubmitEntry} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs text-slate-400 mb-1">Contractor Profile</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    value={selectedContractorId}
                    onChange={(e) => setSelectedContractorId(e.target.value)}
                  >
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.email}) - ${c.rate}/hr
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Work Date</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Site Location</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    value={siteLocation}
                    onChange={(e) => setSiteLocation(e.target.value)}
                  >
                    <option value="AVRD1">AVRD1</option>
                    <option value="AVRD2">AVRD2</option>
                    <option value="AVP">AVP</option>
                  </select>
                </div>

                {entryType === 'time' ? (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Hours Worked</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="e.g. 8.0"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                      value={hoursWorked}
                      onChange={(e) => setHoursWorked(e.target.value)}
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Description</label>
                      <input
                        type="text"
                        placeholder="Material details"
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                        value={materialDescription}
                        onChange={(e) => setMaterialDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Total Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                        value={materialCost}
                        onChange={(e) => setMaterialCost(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-3 mt-2">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2.5 rounded transition duration-200"
                  >
                    Submit {entryType === 'time' ? 'Time Entry' : 'Material Expense'}
                  </button>
                </div>
              </form>
            </section>

            {/* Logs Table */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl overflow-x-auto">
              <h2 className="text-lg font-semibold mb-4 text-slate-200">
                All Work & Material Logs (Admin View)
              </h2>
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs border-b border-slate-800">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Contractor</th>
                    <th className="p-3">Site</th>
                    <th className="p-3">Hours</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Cost ($)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-3">{log.date}</td>
                      <td className="p-3 capitalize">{log.type}</td>
                      <td className="p-3 font-medium text-white">{log.contractorName}</td>
                      <td className="p-3 text-blue-400 font-semibold">{log.site}</td>
                      <td className="p-3">{log.hours ? `${log.hours} Hrs` : '-'}</td>
                      <td className="p-3 text-slate-400">{log.description || '-'}</td>
                      <td className="p-3 font-medium text-emerald-400">${log.cost.toFixed(2)}</td>
                      <td className="p-3">
                        <span className="bg-slate-800 border border-slate-700 text-xs px-2 py-0.5 rounded text-slate-300">
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="flex items-center gap-1 text-red-400 hover:text-red-300 bg-red-950/30 border border-red-900/50 hover:bg-red-900/40 px-2.5 py-1 rounded text-xs transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {/* TAB 2: DIRECTORY & RATES */}
        {activeTab === 'directory' && (
          <div className="space-y-6">
            {isAdmin && (
              <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold mb-4 text-blue-400">Add New Contractor Profile</h2>
                <form onSubmit={handleAddContractor} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Raz Yaron"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                      value={newContractorName}
                      onChange={(e) => setNewContractorName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="user@auroraview.com"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                      value={newContractorEmail}
                      onChange={(e) => setNewContractorEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Hourly Rate ($/hr)</label>
                    <input
                      type="number"
                      placeholder="35"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                      value={newContractorRate}
                      onChange={(e) => setNewContractorRate(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2 rounded transition"
                    >
                      Add Contractor
                    </button>
                  </div>
                </form>
              </section>
            )}

            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold mb-4 text-slate-200">Contractor Directory</h2>
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs border-b border-slate-800">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Hourly Rate</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {contractors.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-3 font-medium text-white">{c.name}</td>
                      <td className="p-3 text-slate-400">{c.email}</td>
                      <td className="p-3 text-emerald-400 font-semibold">${c.rate}/hr</td>
                      <td className="p-3">
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteContractor(c.id)}
                            className="flex items-center gap-1 text-red-400 hover:text-red-300 bg-red-950/30 border border-red-900/50 hover:bg-red-900/40 px-2.5 py-1 rounded text-xs transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete User
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {/* TAB 3: MONTH LOCK */}
        {activeTab === 'monthLock' && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-200 mb-2">Month Lock Settings</h2>
            <p className="text-sm text-slate-400 mb-6">Lock monthly entries to prevent further editing or additions.</p>
            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-lg border border-slate-800">
              <Lock className="w-5 h-5 text-amber-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">August 2026</p>
                <p className="text-xs text-slate-500">Currently unlocked and accepting entries.</p>
              </div>
              <button className="bg-amber-600/20 text-amber-300 border border-amber-600/50 hover:bg-amber-600/30 px-3 py-1.5 rounded text-xs font-semibold">
                Lock Period
              </button>
            </div>
          </section>
        )}

        {/* TAB 4: INVOICES */}
        {activeTab === 'invoices' && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-slate-200">Invoice Generation</h2>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs font-medium border border-slate-700 transition"
              >
                <Printer className="w-4 h-4" /> Print Invoice
              </button>
            </div>
            <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 text-center text-slate-400 text-sm">
              Select contractor and date range to display printable statements.
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
