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
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  UserPlus,
  Clock,
  FileText,
  Trash2,
  Printer,
  DollarSign,
  Users,
  LogOut,
  LogIn,
  Hash,
  Lock,
  Unlock,
  Shield,
  MapPin,
  Mail,
  Package,
  Plus,
  Edit2,
  Check,
  X,
  RotateCcw
} from 'lucide-react';

// ADMIN EMAIL CONFIGURATION
const ADMIN_EMAIL = 'razy@auroraview.com';

// Helper: Format YYYY-MM string into "Month Name Year" (e.g. "2026-08" -> "August 2026")
const formatMonthName = (monthKey: string) => {
  if (!monthKey || monthKey.length < 7) return monthKey;
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

// Helper: Generate a list of past and future months for dropdown selectors
const generateMonthOptions = () => {
  const options = [];
  const currentDate = new Date();
  
  for (let i = -12; i <= 12; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
};

// Helper: Format entry type string to Title Case ("TIME" -> "Time", "MATERIAL" -> "Material")
const formatEntryType = (type: string) => {
  if (!type) return '';
  const upper = String(type).toUpperCase();
  if (upper === 'TIME') return 'Time';
  if (upper === 'MATERIAL') return 'Material';
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth Form States
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState('');

  // Application Data States
  const [logs, setLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [lockedMonths, setLockedMonths] = useState<string[]>([]);
  const [sites, setSites] = useState<string[]>(['(AVP)', 'AVRD1', 'AVRD2']);
  
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<'logs' | 'directory' | 'locks' | 'invoices'>('logs');
  const [entryType, setEntryType] = useState<'time' | 'material'>('time');

  // Form Input States
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [site, setSite] = useState('(AVP)');
  const [hoursWorked, setHoursWorked] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [materialCost, setMaterialCost] = useState('');

  // Directory / Rates State (with Address)
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRate, setNewUserRate] = useState('');
  const [newUserAddress, setNewUserAddress] = useState('');

  // Sites Management State
  const [newSiteName, setNewSiteName] = useState('');
  const [editingSite, setEditingSite] = useState<string | null>(null);
  const [editSiteValue, setEditSiteValue] = useState('');

  // Month Lock State
  const [selectedMonthToLock, setSelectedMonthToLock] = useState('');

  // Invoice Filters & Per-Contractor Counter State
  const [invoiceMonth, setInvoiceMonth] = useState('');
  const [invoiceUserEmail, setInvoiceUserEmail] = useState('');
  const [invoiceCounters, setInvoiceCounters] = useState<{ [email: string]: number }>({});
  const [currentContractorStartNumber, setCurrentContractorStartNumber] = useState<number>(100);

  const monthOptions = generateMonthOptions();

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setSelectedUserEmail(currentUser.email || '');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore Listeners
  useEffect(() => {
    if (!user) return;

    // Listen to Logs
    const qLogs = query(collection(db, 'logs'), orderBy('date', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const fetchedLogs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(fetchedLogs);
    });

    // Listen to Users / Rates
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedUsers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsersList(fetchedUsers);
      if (fetchedUsers.length > 0 && !invoiceUserEmail) {
        setInvoiceUserEmail(fetchedUsers[0].email);
      }
    });

    // Listen to Locked Months
    const unsubLocks = onSnapshot(collection(db, 'lockedMonths'), (snapshot) => {
      const fetchedLocks = snapshot.docs.map((doc) => doc.id);
      setLockedMonths(fetchedLocks);
    });

    // Listen to Sites
    const unsubSites = onSnapshot(collection(db, 'sites'), (snapshot) => {
      if (!snapshot.empty) {
        const fetchedSites = snapshot.docs.map((doc) => doc.data().name);
        setSites(Array.from(new Set(['(AVP)', 'AVRD1', 'AVRD2', ...fetchedSites])));
      }
    });

    // Listen to Per-Contractor Invoice Counters
    const unsubInvoiceCounters = onSnapshot(doc(db, 'settings', 'invoiceCounters'), (docSnap) => {
      if (docSnap.exists()) {
        setInvoiceCounters(docSnap.data());
      }
    });

    return () => {
      unsubLogs();
      unsubUsers();
      unsubLocks();
      unsubSites();
      unsubInvoiceCounters();
    };
  }, [user]);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Effective email to view on invoice
  const targetInvoiceEmail = isAdmin ? (invoiceUserEmail || user?.email || '') : (user?.email || '');

  // Update counter input field when selected contractor changes
  useEffect(() => {
    const emailKey = targetInvoiceEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (emailKey && invoiceCounters[emailKey] !== undefined) {
      setCurrentContractorStartNumber(invoiceCounters[emailKey]);
    } else {
      setCurrentContractorStartNumber(100);
    }
  }, [targetInvoiceEmail, invoiceCounters]);

  // Save Invoice Number Counter for Current Contractor
  const handleUpdateContractorInvoiceCounter = async (newVal: number) => {
    if (!targetInvoiceEmail) return;
    const emailKey = targetInvoiceEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');

    try {
      await setDoc(doc(db, 'settings', 'invoiceCounters'), {
        [emailKey]: newVal
      }, { merge: true });
      setCurrentContractorStartNumber(newVal);
    } catch (err: any) {
      alert('Error updating contractor invoice counter: ' + err.message);
    }
  };

  // Auth Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', res.user.uid), {
          name: fullName || email.split('@')[0],
          email: email.toLowerCase(),
          hourlyRate: 35,
          address: ''
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
      setFullName('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  // Helper: Get user details by email
  const getUserInfo = (userEmail: string) => {
    const found = usersList.find((u) => u.email?.toLowerCase() === userEmail?.toLowerCase());
    return {
      name: found?.name || 'Raz Yaron',
      email: userEmail,
      rate: found?.hourlyRate ? Number(found.hourlyRate) : 35,
      address: found?.address || ''
    };
  };

  // Check if a specific date string (YYYY-MM-DD) falls in a locked month
  const isDateLocked = (dateStr: string) => {
    if (!dateStr) return false;
    const monthKey = dateStr.slice(0, 7);
    return lockedMonths.includes(monthKey);
  };

  // Form Submit Handler
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = isAdmin ? selectedUserEmail || user.email : user.email;

    if (isDateLocked(date)) {
      alert('Cannot add or modify entries for a locked month.');
      return;
    }

    try {
      const userInfo = getUserInfo(targetEmail);
      if (entryType === 'time') {
        const hrs = parseFloat(hoursWorked);
        if (isNaN(hrs) || hrs <= 0) {
          alert('Please enter a valid number of hours worked.');
          return;
        }
        await addDoc(collection(db, 'logs'), {
          type: 'TIME',
          userEmail: targetEmail.toLowerCase(),
          employeeName: userInfo.name,
          date,
          site,
          hoursWorked: hrs,
          hourlyRate: userInfo.rate,
          totalCost: hrs * userInfo.rate,
          createdAt: new Date().toISOString()
        });
        setHoursWorked('');
      } else {
        const cost = parseFloat(materialCost);
        if (isNaN(cost) || cost <= 0) {
          alert('Please enter a valid material cost.');
          return;
        }
        await addDoc(collection(db, 'logs'), {
          type: 'MATERIAL',
          userEmail: targetEmail.toLowerCase(),
          employeeName: userInfo.name,
          date,
          site,
          description: materialDescription,
          cost: cost,
          createdAt: new Date().toISOString()
        });
        setMaterialDescription('');
        setMaterialCost('');
      }
    } catch (err: any) {
      alert('Error saving entry: ' + err.message);
    }
  };

  // Delete Log Handler
  const handleDeleteLog = async (logId: string, logDate: string) => {
    if (isDateLocked(logDate)) {
      alert('This entry belongs to a locked month and cannot be deleted.');
      return;
    }
    if (confirm('Are you sure you want to delete this entry?')) {
      await deleteDoc(doc(db, 'logs', logId));
    }
  };

  // Add/Update User Directory Handler
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) return;
    try {
      const docId = newUserEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');
      await setDoc(doc(db, 'users', docId), {
        name: newUserName,
        email: newUserEmail.toLowerCase(),
        hourlyRate: parseFloat(newUserRate) || 0,
        address: newUserAddress
      }, { merge: true });
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRate('');
      setNewUserAddress('');
    } catch (err: any) {
      alert('Error updating user directory: ' + err.message);
    }
  };

  // Populate user form for inline edit in directory
  const handleEditUserClick = (u: any) => {
    setNewUserName(u.name || '');
    setNewUserEmail(u.email || '');
    setNewUserRate(u.hourlyRate ? String(u.hourlyRate) : '');
    setNewUserAddress(u.address || '');
  };

  // Add New Site Handler
  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSiteName.trim().toUpperCase();
    if (!trimmed) return;

    if (!sites.includes(trimmed)) {
      try {
        const docId = trimmed.replace(/[^a-z0-9]/gi, '_');
        await setDoc(doc(db, 'sites', docId), { name: trimmed });
        setSites((prev) => [...prev, trimmed]);
        setSite(trimmed);
        setNewSiteName('');
      } catch (err: any) {
        alert('Error adding site: ' + err.message);
      }
    } else {
      setSite(trimmed);
      setNewSiteName('');
    }
  };

  // Save Edited Site Name
  const handleSaveEditSite = async (oldSiteName: string) => {
    const updated = editSiteValue.trim().toUpperCase();
    if (!updated || updated === oldSiteName) {
      setEditingSite(null);
      return;
    }

    try {
      const oldDocId = oldSiteName.replace(/[^a-z0-9]/gi, '_');
      const newDocId = updated.replace(/[^a-z0-9]/gi, '_');

      await deleteDoc(doc(db, 'sites', oldDocId));
      await setDoc(doc(db, 'sites', newDocId), { name: updated });

      setSites((prev) => prev.map((s) => (s === oldSiteName ? updated : s)));
      if (site === oldSiteName) setSite(updated);
      setEditingSite(null);
      setEditSiteValue('');
    } catch (err: any) {
      alert('Error updating site name: ' + err.message);
    }
  };

  // Delete Site Handler
  const handleDeleteSite = async (siteToDelete: string) => {
    if (confirm(`Are you sure you want to delete site "${siteToDelete}"?`)) {
      try {
        const docId = siteToDelete.replace(/[^a-z0-9]/gi, '_');
        await deleteDoc(doc(db, 'sites', docId));
        setSites((prev) => prev.filter((s) => s !== siteToDelete));
        if (site === siteToDelete) setSite(sites[0] || '');
      } catch (err: any) {
        alert('Error deleting site: ' + err.message);
      }
    }
  };

  // Explicit Lock/Unlock Handlers
  const handleLockMonth = async (monthKey: string) => {
    if (!isAdmin || !monthKey) return;
    try {
      await setDoc(doc(db, 'lockedMonths', monthKey), {
        lockedAt: new Date().toISOString(),
        lockedBy: user.email
      });
      setSelectedMonthToLock('');
    } catch (err: any) {
      alert('Error locking month: ' + err.message);
    }
  };

  const handleUnlockMonth = async (monthKey: string) => {
    if (!isAdmin || !monthKey) return;
    try {
      await deleteDoc(doc(db, 'lockedMonths', monthKey));
    } catch (err: any) {
      alert('Error unlocking month: ' + err.message);
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#94a3b8' }}>Loading AuroraView System...</p>
      </div>
    );
  }

  // Render Login / Register Screen
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 400, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#ffffff' }}>AuroraView</h1>
            <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>Time And Material Reporting System</p>
          </div>

          {authError && (
            <div style={{ marginBottom: 16, padding: 12, background: '#450a0a', border: '1px solid #991b1b', borderRadius: 6, fontSize: 12, color: '#fca5a5' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {isRegistering && (
              <div>
                <label style={styles.label}>Full Name</label>
                <input
                  type="text"
                  required
                  style={styles.input}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                required
                style={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                required
                style={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" style={styles.button}>
              {isRegistering ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isRegistering ? 'Already Have An Account? Sign In' : 'Need An Account? Register'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter logs based on user view / search criteria
  const visibleLogs = isAdmin 
    ? logs 
    : logs.filter((l) => l.userEmail?.toLowerCase() === user.email?.toLowerCase());

  // Current Selected Contractor Info for Individual Invoice
  const selectedContractorInfo = getUserInfo(targetInvoiceEmail);

  // Filtered Logs for Current Contractor Invoice
  const invoiceLogs = logs
    .filter((l) => (!invoiceMonth || l.date.startsWith(invoiceMonth)))
    .filter((l) => l.userEmail?.toLowerCase() === targetInvoiceEmail.toLowerCase());

  // Calculate Total Invoice Amount
  const totalInvoiceAmount = invoiceLogs.reduce((sum, log) => {
    const amt = log.type === 'MATERIAL' ? Number(log.cost || 0) : Number(log.totalCost || 0);
    return sum + amt;
  }, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', padding: 24 }}>
      {/* CSS Rules explicitly overriding uppercase text transform */}
      <style>{`
        th, p, h1, h2, h3, div, span, label, button, .uppercase, .invoice-container * {
          text-transform: capitalize !important;
        }
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          header, nav, .no-print {
            display: none !important;
          }
          .invoice-container {
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .invoice-container * {
            color: #000000 !important;
            text-transform: capitalize !important;
          }
          .invoice-header-title {
            color: #000000 !important;
            text-transform: capitalize !important;
          }
          .invoice-table th {
            color: #475569 !important;
            border-bottom: 2px solid #cbd5e1 !important;
            text-transform: capitalize !important;
          }
          .invoice-table td {
            border-bottom: 1px solid #e2e8f0 !important;
          }
        }
      `}</style>

      {/* Top Header */}
      <header style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 24, borderBottom: '1px solid #1e293b' }}>
        <div>
          <h1 style={styles.title}>AuroraView Time And Material Reporting System</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Logged In As <span style={{ color: '#f8fafc' }}>{user.email}</span>{' '}
            {isAdmin && <span style={styles.badge}>Admin Access</span>}
          </p>
        </div>

        <button onClick={handleSignOut} style={styles.signOutBtn}>
          Sign Out
        </button>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 1200, margin: '24px auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Navigation Tabs */}
        <div className="no-print" style={styles.nav}>
          <button
            onClick={() => setActiveTab('logs')}
            style={activeTab === 'logs' ? styles.activeTab : styles.tab}
          >
            Log Entries
          </button>
          
          {/* Admin Only Navigation Tabs */}
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('directory')}
                style={activeTab === 'directory' ? styles.activeTab : styles.tab}
              >
                Directory And Rates
              </button>
              <button
                onClick={() => setActiveTab('locks')}
                style={activeTab === 'locks' ? styles.activeTab : styles.tab}
              >
                Month Lock
              </button>
            </>
          )}

          {/* Invoices Tab */}
          <button
            onClick={() => setActiveTab('invoices')}
            style={activeTab === 'invoices' ? styles.activeTab : styles.tab}
          >
            Invoices
          </button>
        </div>

        {activeTab === 'logs' && (
          <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Record Entry Form */}
            <section style={styles.card}>
              <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Record Entry</h2>

              {/* Toggle Time vs Material */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setEntryType('time')}
                  style={entryType === 'time' ? styles.activeTab : styles.tab}
                >
                  Log Time (Hours)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('material')}
                  style={entryType === 'material' ? styles.activeTab : styles.tab}
                >
                  Log Material Expense
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmitEntry} style={styles.formGrid}>
                {isAdmin && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={styles.label}>Logging For Contractor Profile</label>
                    <select
                      style={styles.input}
                      value={selectedUserEmail}
                      onChange={(e) => setSelectedUserEmail(e.target.value)}
                    >
                      {usersList.map((u) => (
                        <option key={u.id} value={u.email}>
                          {u.name || u.email} ({u.email}) - ${u.hourlyRate || 35}/hr
                        </option>
                      ))}
                      {!usersList.some((u) => u.email === user.email) && (
                        <option value={user.email}>{user.email}</option>
                      )}
                    </select>
                  </div>
                )}

                <div>
                  <label style={styles.label}>Date</label>
                  <input
                    type="date"
                    required
                    style={styles.input}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>Site Location</label>
                  <select
                    style={styles.input}
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                  >
                    {sites.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {entryType === 'time' ? (
                  <div>
                    <label style={styles.label}>Hours Worked</label>
                    <input
                      type="number"
                      step="0.25"
                      required
                      placeholder="e.g. 8.0"
                      style={styles.input}
                      value={hoursWorked}
                      onChange={(e) => setHoursWorked(e.target.value)}
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={styles.label}>Material Description</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Hardware supplies"
                        style={styles.input}
                        value={materialDescription}
                        onChange={(e) => setMaterialDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={styles.label}>Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        style={styles.input}
                        value={materialCost}
                        onChange={(e) => setMaterialCost(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div style={{ gridColumn: '1 / -1', paddingTop: 8 }}>
                  <button type="submit" style={styles.button}>
                    Submit {entryType === 'time' ? 'Time Entry' : 'Material Entry'}
                  </button>
                </div>
              </form>
            </section>

            {/* Logs Table */}
            <section style={styles.card}>
              <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                {isAdmin ? 'All Work And Material Logs (Admin View)' : 'My Work And Material Logs'}
              </h2>

              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                      <th style={styles.th}>date</th>
                      <th style={styles.th}>type</th>
                      <th style={styles.th}>contractor name</th>
                      <th style={styles.th}>site location</th>
                      <th style={styles.th}>hours worked</th>
                      <th style={styles.th}>material description</th>
                      <th style={styles.th}>cost ($)</th>
                      <th style={styles.th}>status</th>
                      <th style={styles.th}>action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLogs.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#64748b', fontSize: 12 }}>
                          No Logged Entries Found.
                        </td>
                      </tr>
                    ) : (
                      visibleLogs.map((log) => {
                        const locked = isDateLocked(log.date);
                        return (
                          <tr key={log.id} style={{ borderBottom: '1px solid #1e293b' }}>
                            <td style={styles.td}>{log.date}</td>
                            <td style={styles.td}>{formatEntryType(log.type)}</td>
                            <td style={styles.td}>{log.employeeName || 'Raz Yaron'}</td>
                            <td style={styles.td}>{log.site}</td>
                            <td style={styles.td}>{log.hoursWorked ? `${log.hoursWorked} hrs` : '-'}</td>
                            <td style={styles.td}>{log.description || '-'}</td>
                            <td style={styles.td}>
                              {log.type === 'MATERIAL' && log.cost != null
                                ? `$${Number(log.cost).toFixed(2)}`
                                : log.type === 'TIME' && log.totalCost != null
                                ? `$${Number(log.totalCost).toFixed(2)}`
                                : '-'}
                            </td>
                            <td style={styles.td}>
                              {locked ? 'Locked' : 'Editable'}
                            </td>
                            <td style={styles.td}>
                              {!locked && (
                                <button
                                  onClick={() => handleDeleteLog(log.id, log.date)}
                                  style={styles.deleteBtn}
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Directory And Rates Tab */}
        {activeTab === 'directory' && isAdmin && (
          <section className="no-print" style={styles.card}>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Contractor Directory And Hourly Rates</h2>
            
            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div style={{ ...styles.formGrid, gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div>
                  <label style={styles.label}>Contractor Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Raz Yaron"
                    style={styles.input}
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={styles.label}>Contractor Email</label>
                  <input
                    type="email"
                    required
                    placeholder="user@auroraview.com"
                    style={styles.input}
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label style={styles.label}>Hourly Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="35.00"
                    style={styles.input}
                    value={newUserRate}
                    onChange={(e) => setNewUserRate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={styles.label}>Contractor Full Address</label>
                <input
                  type="text"
                  placeholder="e.g. 123 Main St, Suite 400, Kirkland, WA 98033"
                  style={styles.input}
                  value={newUserAddress}
                  onChange={(e) => setNewUserAddress(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" style={{ ...styles.button, padding: '10px 24px' }}>
                  Save Contractor Details
                </button>
              </div>
            </form>

            <table style={styles.table}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                  <th style={styles.th}>contractor name</th>
                  <th style={styles.th}>contractor email</th>
                  <th style={styles.th}>full address</th>
                  <th style={styles.th}>hourly rate ($)</th>
                  <th style={styles.th}>action</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={styles.td}>{u.name || '-'}</td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}>{u.address || '-'}</td>
                    <td style={styles.td}>${u.hourlyRate ? Number(u.hourlyRate).toFixed(2) : '35.00'}/hr</td>
                    <td style={styles.td}>
                      <button
                        onClick={() => handleEditUserClick(u)}
                        style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Manage Site Locations Section */}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #334155' }}>
              <h3 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>Manage Site Locations</h3>
              
              <form onSubmit={handleAddSite} style={{ display: 'flex', gap: 12, maxWidth: 400, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="e.g. AVRD3"
                  style={styles.input}
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                />
                <button type="submit" style={styles.button}>
                  Add Site
                </button>
              </form>

              {/* Editable / Deletable Sites List */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sites.map((s) => (
                  <div
                    key={s}
                    style={{
                      background: '#334155',
                      color: '#f8fafc',
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    {editingSite === s ? (
                      <>
                        <input
                          type="text"
                          value={editSiteValue}
                          onChange={(e) => setEditSiteValue(e.target.value)}
                          style={{
                            background: '#0f172a',
                            color: '#ffffff',
                            border: '1px solid #475569',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 12
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEditSite(s)}
                          style={{ background: 'none', border: 'none', color: '#86efac', cursor: 'pointer', padding: 0 }}
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingSite(null)}
                          style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0 }}
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span>{s}</span>
                        <button
                          onClick={() => {
                            setEditingSite(s);
                            setEditSiteValue(s);
                          }}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                          title="Edit Site Name"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteSite(s)}
                          style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0 }}
                          title="Delete Site"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Month Lock Tab (Admin Only) */}
        {activeTab === 'locks' && isAdmin && (
          <section className="no-print" style={styles.card}>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>Month Lock Management</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
              Locking a month prevents any new entries or deletions for dates falling within that month.
            </p>

            {/* Lock Month Dropdown Select List */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', maxWidth: 450, marginBottom: 28 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Select Month To Lock</label>
                <select
                  style={styles.input}
                  value={selectedMonthToLock}
                  onChange={(e) => setSelectedMonthToLock(e.target.value)}
                >
                  <option value="">-- Choose Month --</option>
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} {lockedMonths.includes(opt.value) ? '(Currently Locked)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleLockMonth(selectedMonthToLock)}
                disabled={!selectedMonthToLock || lockedMonths.includes(selectedMonthToLock)}
                style={{
                  ...styles.button,
                  background: selectedMonthToLock && !lockedMonths.includes(selectedMonthToLock) ? '#2563eb' : '#334155',
                  cursor: selectedMonthToLock && !lockedMonths.includes(selectedMonthToLock) ? 'pointer' : 'not-allowed'
                }}
              >
                <Lock className="w-4 h-4" style={{ marginRight: 6 }} /> Lock Month
              </button>
            </div>

            {/* Locked Months Display List */}
            <div style={{ borderTop: '1px solid #334155', paddingTop: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 'bold', color: '#94a3b8', marginBottom: 12 }}>
                Currently Locked Months
              </h3>

              {lockedMonths.length === 0 ? (
                <p style={{ fontSize: 13, color: '#64748b' }}>No Months Are Currently Locked.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 450 }}>
                  {lockedMonths.map((monthKey) => (
                    <div
                      key={monthKey}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        background: '#0f172a',
                        border: '1px solid #991b1b',
                        padding: '10px 16px',
                        borderRadius: 6
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Lock className="w-4 h-4 text-red-400" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#fca5a5' }}>
                          {formatMonthName(monthKey)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlockMonth(monthKey)}
                        style={{
                          background: '#7f1d1d',
                          color: '#fef2f2',
                          border: '1px solid #b91c1c',
                          padding: '4px 10px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Unlock className="w-3.5 h-3.5" /> Unlock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <section style={styles.card}>
            <div className="no-print">
              <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                {isAdmin ? 'Generate Contractor Invoices' : 'My Contractor Invoice'}
              </h2>
              
              {/* Invoice Options Form Grid */}
              <div style={{ ...styles.formGrid, gridTemplateColumns: isAdmin ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', marginBottom: 20 }}>
                {/* Admin Contractor Selector Dropdown */}
                {isAdmin && (
                  <div>
                    <label style={styles.label}>Select Contractor</label>
                    <select
                      style={styles.input}
                      value={invoiceUserEmail}
                      onChange={(e) => setInvoiceUserEmail(e.target.value)}
                    >
                      {usersList.map((u) => (
                        <option key={u.id} value={u.email}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={styles.label}>Filter Month</label>
                  <select
                    style={styles.input}
                    value={invoiceMonth}
                    onChange={(e) => setInvoiceMonth(e.target.value)}
                  >
                    <option value="">All Months</option>
                    {monthOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Invoice Start Number</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={currentContractorStartNumber}
                      onChange={(e) => setCurrentContractorStartNumber(Number(e.target.value))}
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateContractorInvoiceCounter(currentContractorStartNumber)}
                      style={{ ...styles.button, padding: '0 12px', background: '#334155' }}
                      title="Save Invoice Counter For Selected Contractor"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateContractorInvoiceCounter(100)}
                      style={{ ...styles.button, padding: '0 12px', background: '#475569' }}
                      title="Reset Contractor Counter To 100"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{ ...styles.button, width: '100%', background: '#2563eb' }}
                  >
                    <Printer className="w-4 h-4" style={{ marginRight: 8 }} /> Print Or Export PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Clean Invoice Print Document */}
            <div className="invoice-container" style={styles.invoiceBox}>
              <div style={styles.invoiceHeader}>
                <div>
                  <h3 className="invoice-header-title" style={{ fontSize: 24, fontWeight: 'bold', color: '#ffffff', textTransform: 'capitalize' }}>invoice</h3>
                  <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, textTransform: 'capitalize' }}>
                    AuroraView Reporting System
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 16, fontWeight: 'bold', color: '#38bdf8' }}>
                    INV-{currentContractorStartNumber}
                  </p>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' }}>
                    Date: {new Date().toISOString().split('T')[0]}
                  </p>
                  <p style={{ fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' }}>
                    Period: {invoiceMonth ? formatMonthName(invoiceMonth) : 'All Time'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #334155' }}>
                <div>
                  <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'capitalize' }}>contractor details</p>
                  <p style={{ fontSize: 15, fontWeight: 'bold', color: '#ffffff', marginTop: 2, textTransform: 'capitalize' }}>{selectedContractorInfo.name}</p>
                  <p style={{ fontSize: 13, color: '#cbd5e1' }}>{selectedContractorInfo.email}</p>
                  {selectedContractorInfo.address && (
                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, maxWidth: 300 }}>
                      {selectedContractorInfo.address}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'capitalize' }}>hourly rate</p>
                  <p style={{ fontSize: 15, fontWeight: 'bold', color: '#ffffff', marginTop: 2 }}>${selectedContractorInfo.rate.toFixed(2)}/hr</p>
                </div>
              </div>

              <table className="invoice-table" style={{ ...styles.table, marginTop: 20 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #334155', textAlign: 'left' }}>
                    <th style={{ ...styles.th, textTransform: 'capitalize' }}>date</th>
                    <th style={{ ...styles.th, textTransform: 'capitalize' }}>type</th>
                    <th style={{ ...styles.th, textTransform: 'capitalize' }}>site location</th>
                    <th style={{ ...styles.th, textTransform: 'capitalize' }}>material description</th>
                    <th style={{ ...styles.th, textAlign: 'right', textTransform: 'capitalize' }}>amount ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#64748b', fontSize: 13 }}>
                        No Logged Entries Found For This Contractor And Period.
                      </td>
                    </tr>
                  ) : (
                    invoiceLogs.map((l) => {
                      const amount = l.type === 'MATERIAL' ? Number(l.cost || 0) : Number(l.totalCost || 0);
                      return (
                        <tr key={l.id} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ ...styles.td }}>{l.date}</td>
                          <td style={{ ...styles.td }}>{formatEntryType(l.type)}</td>
                          <td style={{ ...styles.td }}>{l.site}</td>
                          <td style={{ ...styles.td }}>
                            {l.type === 'TIME' ? `${l.hoursWorked} hrs @ $${l.hourlyRate || selectedContractorInfo.rate}/hr` : l.description}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>${amount.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Invoice Total Summary */}
              <div style={styles.invoiceSummary}>
                <p style={{ fontSize: 13, color: '#94a3b8', textTransform: 'capitalize' }}>total amount due</p>
                <p style={{ fontSize: 24, fontWeight: 'bold', color: '#38bdf8', marginTop: 4 }}>
                  ${totalInvoiceAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// Clean Styles Object Definition
const styles: { [key: string]: React.CSSProperties } = {
  title: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', margin: 0 },
  badge: { fontSize: 12, background: '#14532d', color: '#86efac', padding: '3px 10px', borderRadius: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', marginTop: 4 },
  nav: { display: 'flex', gap: 8 },
  tab: { padding: '10px 16px', background: '#334155', color: '#ffffff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600 },
  activeTab: { padding: '10px 16px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600 },
  signOutBtn: { background: '#334155', color: '#ffffff', border: '1px solid #475569', padding: '10px 12px', borderRadius: 6, cursor: 'pointer' },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.3)', color: '#ffffff' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  label: { display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#ffffff' },
  input: { width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #475569', boxSizing: 'border-box', fontSize: 14, background: '#0f172a', color: '#ffffff' },
  button: { background: '#2563eb', color: '#ffffff', padding: '10px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 40 },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 12, color: '#ffffff' },
  th: { padding: '10px 8px', fontSize: 13, color: '#94a3b8', textTransform: 'capitalize' },
  td: { padding: '12px 8px', fontSize: 14, color: '#ffffff' },
  deleteBtn: { background: '#ef4444', color: '#ffffff', border: 'none', padding: '6px 10px', borderRadius: 4, cursor: 'pointer' },
  invoiceBox: { marginTop: 30, padding: 36, border: '1px solid #334155', borderRadius: 12, background: '#0f172a', color: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)' },
  invoiceHeader: { display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #334155', paddingBottom: 16 },
  invoiceSummary: { marginTop: 24, textAlign: 'right', borderTop: '2px solid #334155', paddingTop: 16 }
};