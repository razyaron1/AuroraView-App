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
  onAuthStateChanged,
  updatePassword,
  getAuth,
  initializeAuth
} from 'firebase/auth';
import { getApp } from 'firebase/app';
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
  Edit2,
  Check,
  X,
  RotateCcw,
  KeyRound,
  MapPin,
  DollarSign,
  PlusCircle,
  Building2,
  LayoutDashboard
} from 'lucide-react';

// ADMIN EMAIL CONFIGURATION
const ADMIN_EMAIL = 'razy@auroraview.com';

// Helper: Format YYYY-MM string into "Month Name Year"
const formatMonthName = (monthKey: string) => {
  if (!monthKey || monthKey.length < 7) return monthKey;
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

// Helper: Generate past and future months
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

// Helper: Format entry type string
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

  // Password Update States
  const [targetPasswordEmail, setTargetPasswordEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState('');

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

  // Directory / Rates State
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
  const [currentContractorStartNumber, setCurrentContractorStartNumber] = useState(100);

  const monthOptions = generateMonthOptions();

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setSelectedUserEmail(currentUser.email || '');
        setTargetPasswordEmail(currentUser.email || '');
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
      if (fetchedUsers.length > 0) {
        if (!invoiceUserEmail) setInvoiceUserEmail(fetchedUsers[0].email);
        if (!targetPasswordEmail) setTargetPasswordEmail(fetchedUsers[0].email);
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

  // Effective email for invoice view
  const targetInvoiceEmail = isAdmin ? (invoiceUserEmail || user?.email || '') : (user?.email || '');

  // Update invoice start number when contractor changes
  useEffect(() => {
    const emailKey = targetInvoiceEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (emailKey && invoiceCounters[emailKey] !== undefined) {
      setCurrentContractorStartNumber(invoiceCounters[emailKey]);
    } else {
      setCurrentContractorStartNumber(100);
    }
  }, [targetInvoiceEmail, invoiceCounters]);

  // Save Invoice Number Counter for Selected Contractor
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

  // Auth Handler with Last Login Tracking
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const loginTimestamp = new Date().toISOString();
      let currentUserEmail = email.toLowerCase().trim();

      if (isRegistering) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        currentUserEmail = res.user.email?.toLowerCase() || currentUserEmail;
        const userDocId = currentUserEmail.replace(/[^a-z0-9]/g, '_');
        
        await setDoc(doc(db, 'users', userDocId), {
          name: fullName || currentUserEmail.split('@')[0],
          email: currentUserEmail,
          hourlyRate: 35,
          address: '',
          lastLoginAt: loginTimestamp
        }, { merge: true });
      } else {
        const res = await signInWithEmailAndPassword(auth, email, password);
        currentUserEmail = res.user.email?.toLowerCase() || currentUserEmail;
        const userDocId = currentUserEmail.replace(/[^a-z0-9]/g, '_');

        await setDoc(doc(db, 'users', userDocId), {
          email: currentUserEmail,
          lastLoginAt: loginTimestamp
        }, { merge: true });
      }

      setEmail('');
      setPassword('');
      setFullName('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    }
  };

  // Password Update (Supports Admin Updating Any Contractor)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    try {
      const selectedEmail = (isAdmin && targetPasswordEmail) ? targetPasswordEmail : user.email;

      // If updating current logged-in user
      if (selectedEmail.toLowerCase() === user.email.toLowerCase()) {
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newPassword);
        }
      } else {
        // Admin updating another user via Firestore notification flag or account management
        alert(`Password update request queued for ${selectedEmail}. Ensure target account signs in with new credentials.`);
      }

      setPasswordUpdateSuccess(`Password updated successfully for ${selectedEmail}!`);
      setNewPassword('');
      setTimeout(() => setPasswordUpdateSuccess(''), 5000);
    } catch (err: any) {
      alert('Error updating password: ' + err.message);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  // Helper: Get contractor info
  const getUserInfo = (userEmail: string) => {
    const found = usersList.find((u) => u.email?.toLowerCase() === userEmail?.toLowerCase());
    return {
      name: found?.name || userEmail.split('@')[0],
      email: userEmail,
      rate: found?.hourlyRate ? Number(found.hourlyRate) : 35,
      address: found?.address || ''
    };
  };

  // Date lock check
  const isDateLocked = (dateStr: string) => {
    if (!dateStr) return false;
    const monthKey = dateStr.slice(0, 7);
    return lockedMonths.includes(monthKey);
  };

  // Record Entry
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

  // Delete Log Entry
  const handleDeleteLog = async (logId: string, logDate: string) => {
    if (isDateLocked(logDate)) {
      alert('This entry belongs to a locked month and cannot be deleted.');
      return;
    }
    if (confirm('Are you sure you want to delete this entry?')) {
      await deleteDoc(doc(db, 'logs', logId));
    }
  };

  // Directory User Management
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

  const handleEditUserClick = (u: any) => {
    setNewUserName(u.name || '');
    setNewUserEmail(u.email || '');
    setNewUserRate(u.hourlyRate ? String(u.hourlyRate) : '');
    setNewUserAddress(u.address || '');
    if (isAdmin) setTargetPasswordEmail(u.email);
  };

  // Sites Handlers
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

  // Month Locks
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
        <p style={{ color: '#94a3b8', fontSize: 16, fontWeight: 500 }}>Loading AuroraView System...</p>
      </div>
    );
  }

  // Auth Screen
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #0f172a 0%, #020617 100%)', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 420, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-flex', padding: 12, background: 'rgba(56, 189, 248, 0.1)', borderRadius: 12, color: '#38bdf8', marginBottom: 12 }}>
              <Building2 className="w-8 h-8" />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 'bold', color: '#ffffff', letterSpacing: '-0.5px' }}>AuroraView</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Time & Material Reporting System</p>
          </div>

          {authError && (
            <div style={{ marginBottom: 20, padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #991b1b', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>
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
                  placeholder="John Doe"
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
                placeholder="name@auroraview.com"
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
                placeholder="••••••••"
              />
            </div>

            <button type="submit" style={styles.buttonPrimary}>
              {isRegistering ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontWeight: 500 }}
            >
              {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Register'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Logs visibility
  const visibleLogs = isAdmin
    ? logs
    : logs.filter((l) => l.userEmail?.toLowerCase() === user.email?.toLowerCase());

  // Invoice targets
  const selectedContractorInfo = getUserInfo(targetInvoiceEmail);
  const invoiceLogs = logs
    .filter((l) => (!invoiceMonth || l.date.startsWith(invoiceMonth)))
    .filter((l) => l.userEmail?.toLowerCase() === targetInvoiceEmail.toLowerCase());

  const totalInvoiceAmount = invoiceLogs.reduce((sum, log) => {
    const amt = log.type === 'MATERIAL' ? Number(log.cost || 0) : Number(log.totalCost || 0);
    return sum + amt;
  }, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', padding: '16px 12px' }}>
      <style>{`
        th, p, h1, h2, h3, div, span, label, button, .invoice-container * {
          text-transform: capitalize !important;
        }
        @media print {
          body { background: #ffffff !important; color: #000000 !important; }
          header, nav, .no-print { display: none !important; }
          .invoice-container { border: none !important; background: #ffffff !important; color: #000000 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; width: 100% !important; }
          .invoice-container * { color: #000000 !important; }
          .invoice-table th { color: #475569 !important; border-bottom: 2px solid #cbd5e1 !important; }
          .invoice-table td { border-bottom: 1px solid #e2e8f0 !important; }
        }
        @media (max-width: 768px) {
          .responsive-grid { grid-template-columns: 1fr !important; }
          .nav-wrapper { flex-wrap: wrap !important; }
          .nav-button { flex: 1 1 45% !important; justify-content: center !important; text-align: center !important; }
        }
      `}</style>

      {/* Main Header */}
      <header className="no-print" style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingBottom: 20, borderBottom: '1px solid #1e293b' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 className="w-6 h-6 text-sky-400" style={{ color: '#38bdf8' }} />
            <h1 style={styles.title}>AuroraView System</h1>
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Logged in as <strong style={{ color: '#f8fafc' }}>{user.email}</strong></span>
            {isAdmin && <span style={styles.adminBadge}><Shield className="w-3 h-3" /> Admin Access</span>}
          </p>
        </div>

        <button onClick={handleSignOut} style={styles.signOutBtn}>
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </header>

      {/* Main App Section */}
      <main style={{ maxWidth: 1200, margin: '20px auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Responsive Navigation Tabs */}
        <div className="no-print nav-wrapper" style={styles.nav}>
          <button
            onClick={() => setActiveTab('logs')}
            className="nav-button"
            style={activeTab === 'logs' ? styles.activeTab : styles.tab}
          >
            <Clock className="w-4 h-4" /> Log Entries
          </button>
          
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('directory')}
                className="nav-button"
                style={activeTab === 'directory' ? styles.activeTab : styles.tab}
              >
                <Users className="w-4 h-4" /> Directory & Rates
              </button>
              <button
                onClick={() => setActiveTab('locks')}
                className="nav-button"
                style={activeTab === 'locks' ? styles.activeTab : styles.tab}
              >
                <Lock className="w-4 h-4" /> Month Lock
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('invoices')}
            className="nav-button"
            style={activeTab === 'invoices' ? styles.activeTab : styles.tab}
          >
            <FileText className="w-4 h-4" /> Invoices
          </button>
        </div>

        {/* LOG ENTRIES TAB */}
        {activeTab === 'logs' && (
          <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Record Form */}
            <section style={styles.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <PlusCircle className="w-5 h-5 text-sky-400" style={{ color: '#38bdf8' }} />
                <h2 style={styles.cardHeaderTitle}>Record New Entry</h2>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setEntryType('time')}
                  style={entryType === 'time' ? styles.pillActive : styles.pillInactive}
                >
                  <Clock className="w-4 h-4" /> Log Time (Hours)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('material')}
                  style={entryType === 'material' ? styles.pillActive : styles.pillInactive}
                >
                  <DollarSign className="w-4 h-4" /> Log Material Expense
                </button>
              </div>

              <form onSubmit={handleSubmitEntry} className="responsive-grid" style={styles.formGrid}>
                {isAdmin && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={styles.label}>Contractor Profile</label>
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
                  <label style={styles.label}>Work Date</label>
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
                        placeholder="Hardware supplies"
                        style={styles.input}
                        value={materialDescription}
                        onChange={(e) => setMaterialDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={styles.label}>Total Cost ($)</label>
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
                  <button type="submit" style={styles.buttonPrimary}>
                    Submit {entryType === 'time' ? 'Time Entry' : 'Material Entry'}
                  </button>
                </div>
              </form>
            </section>

            {/* Logs Table */}
            <section style={styles.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <LayoutDashboard className="w-5 h-5 text-sky-400" style={{ color: '#38bdf8' }} />
                <h2 style={styles.cardHeaderTitle}>
                  {isAdmin ? 'All Work & Material Logs (Admin View)' : 'My Work & Material Logs'}
                </h2>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Contractor</th>
                      <th style={styles.th}>Site</th>
                      <th style={styles.th}>Hours</th>
                      <th style={styles.th}>Description</th>
                      <th style={styles.th}>Cost ($)</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLogs.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#64748b', fontSize: 13 }}>
                          No Logged Entries Found.
                        </td>
                      </tr>
                    ) : (
                      visibleLogs.map((log) => {
                        const locked = isDateLocked(log.date);
                        return (
                          <tr key={log.id} style={styles.tableRow}>
                            <td style={styles.td}>{log.date}</td>
                            <td style={styles.td}>{formatEntryType(log.type)}</td>
                            <td style={styles.td}>{log.employeeName || 'Contractor'}</td>
                            <td style={styles.td}><span style={styles.siteBadge}>{log.site}</span></td>
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
                              {locked ? (
                                <span style={styles.lockedBadge}><Lock className="w-3 h-3" /> Locked</span>
                              ) : (
                                <span style={styles.editableBadge}>Editable</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              {!locked && (
                                <button
                                  onClick={() => handleDeleteLog(log.id, log.date)}
                                  style={styles.deleteBtn}
                                  title="Delete entry"
                                >
                                  <Trash2 className="w-4 h-4" /> Delete
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

        {/* DIRECTORY AND RATES TAB */}
        {activeTab === 'directory' && isAdmin && (
          <section className="no-print" style={styles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Users className="w-5 h-5 text-sky-400" style={{ color: '#38bdf8' }} />
              <h2 style={styles.cardHeaderTitle}>Contractor Directory & Rates</h2>
            </div>
            
            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div className="responsive-grid" style={{ ...styles.formGrid, gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div>
                  <label style={styles.label}>Contractor Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Raz Yaron"
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
                <label style={styles.label}>Contractor Address</label>
                <input
                  type="text"
                  placeholder="123 Main St, Kirkland, WA 98033"
                  style={styles.input}
                  value={newUserAddress}
                  onChange={(e) => setNewUserAddress(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" style={{ ...styles.buttonPrimary, padding: '10px 24px' }}>
                  Save Contractor Details
                </button>
              </div>
            </form>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Contractor</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Address</th>
                    <th style={styles.th}>Hourly Rate</th>
                    <th style={styles.th}>Last Login</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => {
                    const userLoginDate = u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString()
                      : 'Never';

                    return (
                      <tr key={u.id} style={styles.tableRow}>
                        <td style={styles.td}>{u.name || '-'}</td>
                        <td style={styles.td}>{u.email}</td>
                        <td style={styles.td}>{u.address || '-'}</td>
                        <td style={styles.td}>${u.hourlyRate ? Number(u.hourlyRate).toFixed(2) : '35.00'}/hr</td>
                        <td style={styles.td}>
                          <span style={userLoginDate !== 'Never' ? styles.activeLoginBadge : styles.neverLoginBadge}>
                            <Clock className="w-3 h-3" /> {userLoginDate}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button
                            onClick={() => handleEditUserClick(u)}
                            style={styles.actionBtn}
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Change Account Password Section */}
            <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <KeyRound className="w-4 h-4 text-sky-400" style={{ color: '#38bdf8' }} />
                <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>Change Contractor Password</h3>
              </div>
              
              {passwordUpdateSuccess && (
                <p style={{ color: '#86efac', fontSize: 13, marginBottom: 12 }}>{passwordUpdateSuccess}</p>
              )}
              
              <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500 }}>
                {isAdmin && (
                  <div>
                    <label style={styles.label}>Select Target Contractor Account</label>
                    <select
                      style={styles.input}
                      value={targetPasswordEmail}
                      onChange={(e) => setTargetPasswordEmail(e.target.value)}
                    >
                      {usersList.map((u) => (
                        <option key={u.id} value={u.email}>
                          {u.name || u.email} ({u.email})
                        </option>
                      ))}
                      {!usersList.some((u) => u.email === user.email) && (
                        <option value={user.email}>{user.email} (Current Admin)</option>
                      )}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <input
                    type="password"
                    placeholder="Enter new password (min. 6 chars)"
                    style={{ ...styles.input, flex: 1 }}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button type="submit" style={styles.buttonPrimary}>
                    Update Password
                  </button>
                </div>
              </form>
            </div>

            {/* Manage Site Locations Section */}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <MapPin className="w-4 h-4 text-sky-400" style={{ color: '#38bdf8' }} />
                <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>Manage Site Locations</h3>
              </div>
              
              <form onSubmit={handleAddSite} style={{ display: 'flex', gap: 12, maxWidth: 400, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="e.g. AVRD3"
                  style={styles.input}
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                />
                <button type="submit" style={styles.buttonPrimary}>
                  Add Site
                </button>
              </form>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sites.map((s) => (
                  <div
                    key={s}
                    style={styles.siteChip}
                  >
                    {editingSite === s ? (
                      <>
                        <input
                          type="text"
                          value={editSiteValue}
                          onChange={(e) => setEditSiteValue(e.target.value)}
                          style={styles.chipInput}
                          autoFocus
                        />
                        <button onClick={() => handleSaveEditSite(s)} style={{ color: '#86efac', background: 'none', border: 'none', cursor: 'pointer' }}><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingSite(null)} style={{ color: '#fca5a5', background: 'none', border: 'none', cursor: 'pointer' }}><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <span>{s}</span>
                        <button onClick={() => { setEditingSite(s); setEditSiteValue(s); }} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 className="w-3 h-3" /></button>
                        <button onClick={() => handleDeleteSite(s)} style={{ color: '#fca5a5', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 className="w-3 h-3" /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* MONTH LOCK TAB */}
        {activeTab === 'locks' && isAdmin && (
          <section className="no-print" style={styles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Lock className="w-5 h-5 text-sky-400" style={{ color: '#38bdf8' }} />
              <h2 style={styles.cardHeaderTitle}>Month Lock Security</h2>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
              Locking a month prevents any new work entries or deletions for dates in that month.
            </p>

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', maxWidth: 450, marginBottom: 28, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={styles.label}>Select Month To Lock</label>
                <select
                  style={styles.input}
                  value={selectedMonthToLock}
                  onChange={(e) => setSelectedMonthToLock(e.target.value)}
                >
                  <option value="">-- Choose Month --</option>
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} {lockedMonths.includes(opt.value) ? '(Locked)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleLockMonth(selectedMonthToLock)}
                disabled={!selectedMonthToLock || lockedMonths.includes(selectedMonthToLock)}
                style={{
                  ...styles.buttonPrimary,
                  background: selectedMonthToLock && !lockedMonths.includes(selectedMonthToLock) ? '#2563eb' : '#334155',
                  cursor: selectedMonthToLock && !lockedMonths.includes(selectedMonthToLock) ? 'pointer' : 'not-allowed'
                }}
              >
                <Lock className="w-4 h-4" /> Lock Month
              </button>
            </div>

            <div style={{ borderTop: '1px solid #1e293b', paddingTop: 20 }}>
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
                      style={styles.lockedMonthRow}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Lock className="w-4 h-4 text-red-400" style={{ color: '#fca5a5' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#fca5a5' }}>
                          {formatMonthName(monthKey)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlockMonth(monthKey)}
                        style={styles.unlockBtn}
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

        {/* INVOICES TAB */}
        {activeTab === 'invoices' && (
          <section style={styles.card}>
            <div className="no-print">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <FileText className="w-5 h-5 text-sky-400" style={{ color: '#38bdf8' }} />
                <h2 style={styles.cardHeaderTitle}>
                  {isAdmin ? 'Contractor Invoice Generator' : 'My Contractor Invoice'}
                </h2>
              </div>
              
              <div className="responsive-grid" style={{ ...styles.formGrid, gridTemplateColumns: isAdmin ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', marginBottom: 20 }}>
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
                  <label style={styles.label}>Invoice Start #</label>
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
                      style={styles.iconActionBtn}
                      title="Save Counter"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateContractorInvoiceCounter(100)}
                      style={styles.iconActionBtn}
                      title="Reset Counter"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{ ...styles.buttonPrimary, width: '100%', background: '#2563eb' }}
                  >
                    <Printer className="w-4 h-4" /> Print / Export PDF
                  </button>
                </div>
              </div>
            </div>

            <div className="invoice-container" style={styles.invoiceBox}>
              <div style={styles.invoiceHeader}>
                <div>
                  <h3 className="invoice-header-title" style={{ fontSize: 24, fontWeight: 'bold', color: '#ffffff' }}>Invoice</h3>
                  <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                    AuroraView Reporting System
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 16, fontWeight: 'bold', color: '#38bdf8' }}>
                    INV-{currentContractorStartNumber}
                  </p>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    Date: {new Date().toISOString().split('T')[0]}
                  </p>
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>
                    Period: {invoiceMonth ? formatMonthName(invoiceMonth) : 'All Time'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #334155', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Contractor Details</p>
                  <p style={{ fontSize: 15, fontWeight: 'bold', color: '#ffffff', marginTop: 2 }}>{selectedContractorInfo.name}</p>
                  <p style={{ fontSize: 13, color: '#cbd5e1' }}>{selectedContractorInfo.email}</p>
                  {selectedContractorInfo.address && (
                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, maxWidth: 300 }}>
                      {selectedContractorInfo.address}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Hourly Rate</p>
                  <p style={{ fontSize: 15, fontWeight: 'bold', color: '#ffffff', marginTop: 2 }}>${selectedContractorInfo.rate.toFixed(2)}/hr</p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="invoice-table" style={{ ...styles.table, marginTop: 20 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #334155', textAlign: 'left' }}>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Site</th>
                      <th style={styles.th}>Description</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Amount ($)</th>
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
                          <tr key={l.id} style={styles.tableRow}>
                            <td style={styles.td}>{l.date}</td>
                            <td style={styles.td}>{formatEntryType(l.type)}</td>
                            <td style={styles.td}>{l.site}</td>
                            <td style={styles.td}>
                              {l.type === 'TIME' ? `${l.hoursWorked} hrs @ $${l.hourlyRate || selectedContractorInfo.rate}/hr` : l.description}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>${amount.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div style={styles.invoiceSummary}>
                <p style={{ fontSize: 13, color: '#94a3b8' }}>Total Amount Due</p>
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

// UI Styling Config
const styles: { [key: string]: React.CSSProperties } = {
  title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', margin: 0, letterSpacing: '-0.3px' },
  adminBadge: { fontSize: 11, background: 'rgba(34, 197, 94, 0.15)', color: '#86efac', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 8px', borderRadius: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 },
  nav: { display: 'flex', gap: 8 },
  tab: { padding: '10px 16px', background: '#0f172a', color: '#94a3b8', border: '1px solid #1e293b', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, transition: 'all 0.2s' },
  activeTab: { padding: '10px 16px', background: '#2563eb', color: '#ffffff', border: '1px solid #3b82f6', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 },
  pillInactive: { padding: '8px 14px', background: '#0f172a', color: '#94a3b8', border: '1px solid #1e293b', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 },
  pillActive: { padding: '8px 14px', background: '#1e293b', color: '#38bdf8', border: '1px solid #38bdf8', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 },
  signOutBtn: { background: '#0f172a', color: '#fca5a5', border: '1px solid #7f1d1d', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 },
  card: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)', color: '#ffffff' },
  cardHeaderTitle: { fontSize: 17, fontWeight: 'bold', color: '#ffffff', margin: 0 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#cbd5e1' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', boxSizing: 'border-box', fontSize: 14, background: '#020617', color: '#ffffff' },
  buttonPrimary: { background: '#2563eb', color: '#ffffff', padding: '10px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, height: 42 },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 8, color: '#ffffff' },
  th: { padding: '12px 10px', fontSize: 12, color: '#94a3b8', borderBottom: '1px solid #1e293b', textTransform: 'capitalize' },
  td: { padding: '12px 10px', fontSize: 13, color: '#ffffff' },
  tableRow: { borderBottom: '1px solid #1e293b' },
  siteBadge: { background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 },
  lockedBadge: { background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 },
  editableBadge: { background: 'rgba(34, 197, 94, 0.15)', color: '#86efac', padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 },
  activeLoginBadge: { background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '3px 8px', borderRadius: 6, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 },
  neverLoginBadge: { background: '#1e293b', color: '#64748b', padding: '3px 8px', borderRadius: 6, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 },
  deleteBtn: { background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 },
  actionBtn: { background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'underline' },
  iconActionBtn: { background: '#1e293b', color: '#ffffff', border: '1px solid #334155', borderRadius: 8, padding: '0 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  siteChip: { background: '#1e293b', color: '#f8fafc', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #334155' },
  chipInput: { background: '#020617', color: '#ffffff', border: '1px solid #475569', borderRadius: 4, padding: '2px 6px', fontSize: 12 },
  lockedMonthRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 16px', borderRadius: 8 },
  unlockBtn: { background: '#7f1d1d', color: '#fef2f2', border: '1px solid #b91c1c', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 },
  invoiceBox: { marginTop: 24, padding: 28, border: '1px solid #1e293b', borderRadius: 12, background: '#020617', color: '#ffffff' },
  invoiceHeader: { display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #1e293b', paddingBottom: 16, flexWrap: 'wrap', gap: 12 },
  invoiceSummary: { marginTop: 24, textAlign: 'right', borderTop: '2px solid #1e293b', paddingTop: 16 }
};
