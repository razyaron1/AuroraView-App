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
  Trash2,
  Printer,
  Lock,
  Unlock,
  Edit2,
  Check,
  X,
  RotateCcw,
  LogOut,
  Clock,
  Package,
  User,
  Plus
} from 'lucide-react';

const ADMIN_EMAIL = 'razy@auroraview.com';

interface UserProfile {
  id: string;
  name?: string;
  email: string;
  hourlyRate?: number;
  address?: string;
}

const formatMonthName = (monthKey: string) => {
  if (!monthKey || monthKey.length < 7) return monthKey;
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

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

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState('');

  const [logs, setLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [lockedMonths, setLockedMonths] = useState<string[]>([]);
  const [sites, setSites] = useState<string[]>(['(AVP)', 'AVRD1', 'AVRD2']);
  
  const [activeTab, setActiveTab] = useState<'logs' | 'directory' | 'locks' | 'invoices'>('logs');
  const [entryType, setEntryType] = useState<'time' | 'material'>('time');

  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [site, setSite] = useState('(AVP)');
  const [hoursWorked, setHoursWorked] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [materialCost, setMaterialCost] = useState('');

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRate, setNewUserRate] = useState('');
  const [newUserAddress, setNewUserAddress] = useState('');

  const [newSiteName, setNewSiteName] = useState('');
  const [editingSite, setEditingSite] = useState<string | null>(null);
  const [editSiteValue, setEditSiteValue] = useState('');

  const [selectedMonthToLock, setSelectedMonthToLock] = useState('');

  const [invoiceMonth, setInvoiceMonth] = useState('');
  const [invoiceUserEmail, setInvoiceUserEmail] = useState('');
  const [invoiceCounters, setInvoiceCounters] = useState<{ [email: string]: number }>({});
  const [currentContractorStartNumber, setCurrentContractorStartNumber] = useState<number>(100);

  const monthOptions = generateMonthOptions();

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

  useEffect(() => {
    if (!user) return;

    const qLogs = query(collection(db, 'logs'), orderBy('date', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const fetchedLogs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(fetchedLogs);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedUsers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsersList(fetchedUsers);
      if (fetchedUsers.length > 0 && !invoiceUserEmail) {
        setInvoiceUserEmail(fetchedUsers[0].email);
      }
    });

    const unsubLocks = onSnapshot(collection(db, 'lockedMonths'), (snapshot) => {
      const fetchedLocks = snapshot.docs.map((doc) => doc.id);
      setLockedMonths(fetchedLocks);
    });

    const unsubSites = onSnapshot(collection(db, 'sites'), (snapshot) => {
      if (!snapshot.empty) {
        const fetchedSites = snapshot.docs.map((doc) => doc.data().name);
        setSites(fetchedSites);
        if (!fetchedSites.includes(site)) {
          setSite(fetchedSites[0] || '');
        }
      } else {
        setSites([]);
        setSite('');
      }
    });

    const unsubInvoiceCounters = onSnapshot(doc(db, 'settings', 'invoiceCounters'), (docSnap) => {
      if (docSnap.exists()) {
        setInvoiceCounters(docSnap.data() as { [email: string]: number });
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
  const targetInvoiceEmail = isAdmin ? (invoiceUserEmail || user?.email || '') : (user?.email || '');

  useEffect(() => {
    const emailKey = targetInvoiceEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (emailKey && invoiceCounters[emailKey] !== undefined) {
      setCurrentContractorStartNumber(invoiceCounters[emailKey]);
    } else {
      setCurrentContractorStartNumber(100);
    }
  }, [targetInvoiceEmail, invoiceCounters]);

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

  const getUserInfo = (userEmail: string) => {
    const found = usersList.find((u) => u.email?.toLowerCase() === userEmail?.toLowerCase());
    return {
      name: found?.name || 'Raz Yaron',
      email: userEmail,
      rate: found?.hourlyRate ? Number(found.hourlyRate) : 35,
      address: found?.address || ''
    };
  };

  const isDateLocked = (dateStr: string) => {
    if (!dateStr) return false;
    const monthKey = dateStr.slice(0, 7);
    return lockedMonths.includes(monthKey);
  };

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

  // DELETE LOG TRANSACTION (TIME OR MATERIAL)
  const handleDeleteLog = async (logId: string, logDate: string) => {
    if (isDateLocked(logDate)) {
      alert('This transaction belongs to a locked month and cannot be deleted.');
      return;
    }
    if (confirm('Are you sure you want to delete this log transaction?')) {
      try {
        await deleteDoc(doc(db, 'logs', logId));
      } catch (err: any) {
        alert('Error deleting transaction: ' + err.message);
      }
    }
  };

  // DIRECTORY HANDLERS
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) return;
    try {
      const docId = editingUserId || newUserEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');
      await setDoc(doc(db, 'users', docId), {
        name: newUserName,
        email: newUserEmail.toLowerCase(),
        hourlyRate: parseFloat(newUserRate) || 0,
        address: newUserAddress
      }, { merge: true });
      
      handleCancelUserEdit();
    } catch (err: any) {
      alert('Error updating user directory: ' + err.message);
    }
  };

  const handleEditUserClick = (u: UserProfile) => {
    setEditingUserId(u.id);
    setNewUserName(u.name || '');
    setNewUserEmail(u.email || '');
    setNewUserRate(u.hourlyRate ? String(u.hourlyRate) : '');
    setNewUserAddress(u.address || '');
  };

  const handleDeleteUser = async (u: UserProfile) => {
    if (confirm(`Are you sure you want to delete ${u.name || u.email} from directory?`)) {
      try {
        await deleteDoc(doc(db, 'users', u.id));
        if (editingUserId === u.id) handleCancelUserEdit();
      } catch (err: any) {
        alert('Error deleting contractor: ' + err.message);
      }
    }
  };

  const handleCancelUserEdit = () => {
    setEditingUserId(null);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRate('');
    setNewUserAddress('');
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSiteName.trim().toUpperCase();
    if (!trimmed) return;

    try {
      const docId = trimmed.replace(/[^a-z0-9]/gi, '_');
      await setDoc(doc(db, 'sites', docId), { name: trimmed });
      setSite(trimmed);
      setNewSiteName('');
    } catch (err: any) {
      alert('Error adding site: ' + err.message);
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
      } catch (err: any) {
        alert('Error deleting site: ' + err.message);
      }
    }
  };

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
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '8px' }}>AuroraView</div>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading system...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', width: '100vw', background: '#020617', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: '380px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#ffffff', letterSpacing: '-0.02em' }}>AuroraView</h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Time & Material Reporting</p>
          </div>

          {authError && (
            <div style={{ marginBottom: '16px', padding: '12px', background: '#450a0a', border: '1px solid #991b1b', borderRadius: '8px', fontSize: '12px', color: '#fca5a5' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {isRegistering && (
              <div>
                <label style={styles.label}>Full Name</label>
                <input
                  type="text"
                  required
                  style={styles.input}
                  placeholder="John Doe"
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
                placeholder="name@auroraview.com"
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" style={{ ...styles.button, marginTop: '8px', width: '100%' }}>
              {isRegistering ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
            >
              {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Register'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const visibleLogs = isAdmin 
    ? logs 
    : logs.filter((l) => l.userEmail?.toLowerCase() === user.email?.toLowerCase());

  const selectedContractorInfo = getUserInfo(targetInvoiceEmail);

  const invoiceLogs = logs
    .filter((l) => (!invoiceMonth || l.date.startsWith(invoiceMonth)))
    .filter((l) => l.userEmail?.toLowerCase() === targetInvoiceEmail.toLowerCase());

  const totalInvoiceAmount = invoiceLogs.reduce((sum, log) => {
    const amt = log.type === 'MATERIAL' ? Number(log.cost || 0) : Number(log.totalCost || 0);
    return sum + amt;
  }, 0);

  return (
    <div style={{ minHeight: '100vh', width: '100vw', maxWidth: '100vw', background: '#020617', color: '#f8fafc', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <style>{`
        * {
          box-sizing: border-box;
        }
        html, body {
          max-width: 100vw;
          overflow-x: hidden;
          margin: 0;
          padding: 0;
          background-color: #020617;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        input, select, textarea, button {
          font-size: 16px !important;
          outline: none;
        }
        input:focus, select:focus {
          border-color: #38bdf8 !important;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
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
          }
          .invoice-table th, .invoice-table td {
            color: #334155 !important;
            border-bottom: 1px solid #cbd5e1 !important;
          }
        }
      `}</style>

      {/* Top Header */}
      <header className="no-print" style={styles.header}>
        <div style={styles.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={styles.logoBadge}>AV</div>
            <div>
              <h1 style={styles.appTitle}>AuroraView</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={styles.userEmailText}>{user.email}</span>
                {isAdmin && <span style={styles.adminBadge}>Admin</span>}
              </div>
            </div>
          </div>

          <button onClick={handleSignOut} style={styles.iconSignOutBtn} title="Sign Out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="hide-scrollbar" style={styles.tabsWrapper}>
          <button
            onClick={() => setActiveTab('logs')}
            style={activeTab === 'logs' ? styles.activeNavTab : styles.navTab}
          >
            <Clock style={styles.tabIcon} /> Log Entries
          </button>
          
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('directory')}
                style={activeTab === 'directory' ? styles.activeNavTab : styles.navTab}
              >
                <User style={styles.tabIcon} /> Directory
              </button>
              <button
                onClick={() => setActiveTab('locks')}
                style={activeTab === 'locks' ? styles.activeNavTab : styles.navTab}
              >
                <Lock style={styles.tabIcon} /> Month Lock
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('invoices')}
            style={activeTab === 'invoices' ? styles.activeNavTab : styles.navTab}
          >
            <Printer style={styles.tabIcon} /> Invoices
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={styles.mainContainer}>
        
        {/* LOG ENTRIES TAB */}
        {activeTab === 'logs' && (
          <div className="no-print" style={styles.sectionGap}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Record New Entry</h2>
              </div>

              <div style={styles.segmentContainer}>
                <button
                  type="button"
                  onClick={() => setEntryType('time')}
                  style={entryType === 'time' ? styles.segmentActive : styles.segmentTab}
                >
                  <Clock className="w-4 h-4" style={{ marginRight: '6px' }} /> Time Log
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('material')}
                  style={entryType === 'material' ? styles.segmentActive : styles.segmentTab}
                >
                  <Package className="w-4 h-4" style={{ marginRight: '6px' }} /> Material Log
                </button>
              </div>

              <form onSubmit={handleSubmitEntry} style={styles.flexForm}>
                {isAdmin && (
                  <div>
                    <label style={styles.label}>Contractor Profile</label>
                    <select
                      style={styles.input}
                      value={selectedUserEmail}
                      onChange={(e) => setSelectedUserEmail(e.target.value)}
                    >
                      {usersList.map((u) => (
                        <option key={u.id} value={u.email}>
                          {u.name || u.email} (${u.hourlyRate || 35}/hr)
                        </option>
                      ))}
                      {!usersList.some((u) => u.email === user.email) && (
                        <option value={user.email}>{user.email}</option>
                      )}
                    </select>
                  </div>
                )}

                <div style={styles.formGrid2}>
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
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
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
                  <div style={styles.formGrid2}>
                    <div>
                      <label style={styles.label}>Description</label>
                      <input
                        type="text"
                        required
                        placeholder="Hardware / Supplies"
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
                  </div>
                )}

                <button type="submit" style={{ ...styles.button, width: '100%', marginTop: '8px' }}>
                  Save {entryType === 'time' ? 'Time Entry' : 'Material Entry'}
                </button>
              </form>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  {isAdmin ? 'All Activity Logs' : 'My Activity Logs'}
                </h2>
                <span style={styles.countBadge}>{visibleLogs.length} logs</span>
              </div>

              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Contractor</th>
                      <th style={styles.th}>Site</th>
                      <th style={styles.th}>Details</th>
                      <th style={styles.th}>Cost</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={styles.emptyTd}>
                          No entries logged yet.
                        </td>
                      </tr>
                    ) : (
                      visibleLogs.map((log) => {
                        const locked = isDateLocked(log.date);
                        return (
                          <tr key={log.id} style={styles.tr}>
                            <td style={styles.tdBold}>{log.date}</td>
                            <td style={styles.td}>
                              <span style={log.type === 'TIME' ? styles.timeBadge : styles.materialBadge}>
                                {formatEntryType(log.type)}
                              </span>
                            </td>
                            <td style={styles.td}>{log.employeeName || 'Raz Yaron'}</td>
                            <td style={styles.td}>{log.site}</td>
                            <td style={styles.td}>
                              {log.type === 'TIME' ? `${log.hoursWorked} hrs` : log.description || '-'}
                            </td>
                            <td style={styles.tdBold}>
                              {log.type === 'MATERIAL' && log.cost != null
                                ? `$${Number(log.cost).toFixed(2)}`
                                : log.type === 'TIME' && log.totalCost != null
                                ? `$${Number(log.totalCost).toFixed(2)}`
                                : '-'}
                            </td>
                            <td style={styles.td}>
                              {locked ? (
                                <span style={styles.lockedPill}><Lock className="w-3 h-3" /> Locked</span>
                              ) : (
                                <button
                                  onClick={() => handleDeleteLog(log.id, log.date)}
                                  style={styles.deleteIconButton}
                                  title="Delete Transaction"
                                >
                                  <Trash2 className="w-4 h-4" />
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

        {/* DIRECTORY & RATES TAB */}
        {activeTab === 'directory' && isAdmin && (
          <div className="no-print" style={styles.sectionGap}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>{editingUserId ? 'Edit Contractor Profile' : 'Add New Contractor'}</h2>
                {editingUserId && (
                  <button onClick={handleCancelUserEdit} style={styles.cancelLinkBtn}>
                    Cancel Edit
                  </button>
                )}
              </div>
              
              <form onSubmit={handleSaveUser} style={styles.flexForm}>
                <div style={styles.formGrid2}>
                  <div>
                    <label style={styles.label}>Name</label>
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
                    <label style={styles.label}>Email</label>
                    <input
                      type="email"
                      required
                      placeholder="contractor@auroraview.com"
                      style={styles.input}
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div style={styles.formGrid2}>
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
                  <div>
                    <label style={styles.label}>Address</label>
                    <input
                      type="text"
                      placeholder="123 Main St, Kirkland, WA"
                      style={styles.input}
                      value={newUserAddress}
                      onChange={(e) => setNewUserAddress(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" style={{ ...styles.button, width: '100%', marginTop: '6px' }}>
                  {editingUserId ? 'Update Contractor Profile' : 'Save New Contractor'}
                </button>
              </form>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Contractor Profiles</h2>
              </div>

              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Name</th>
                      <th style={styles.th}>Email</th>
                      <th style={styles.th}>Rate</th>
                      <th style={styles.th}>Address</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id} style={styles.tr}>
                        <td style={styles.tdBold}>{u.name || '-'}</td>
                        <td style={styles.td}>{u.email}</td>
                        <td style={styles.tdBold}>${u.hourlyRate ? Number(u.hourlyRate).toFixed(2) : '35.00'}/hr</td>
                        <td style={styles.td}>{u.address || '-'}</td>
                        <td style={{ ...styles.td, display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleEditUserClick(u)}
                            style={styles.editIconButton}
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            style={styles.deleteIconButton}
                            title="Delete Contractor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Sites Management */}
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Site Locations</h2>
              </div>
              
              <form onSubmit={handleAddSite} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="New Site (e.g. AVRD3)"
                  style={{ ...styles.input, flex: 1 }}
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                />
                <button type="submit" style={styles.button}>
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {sites.map((s) => (
                  <div key={s} style={styles.siteChip}>
                    {editingSite === s ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="text"
                          value={editSiteValue}
                          onChange={(e) => setEditSiteValue(e.target.value)}
                          style={styles.chipInput}
                          autoFocus
                        />
                        <button onClick={() => handleSaveEditSite(s)} style={styles.chipIconBtnSuccess}>
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingSite(null)} style={styles.chipIconBtnDanger}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{s}</span>
                        <button onClick={() => { setEditingSite(s); setEditSiteValue(s); }} style={styles.chipIconBtn}>
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDeleteSite(s)} style={styles.chipIconBtnDanger}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* MONTH LOCK TAB */}
        {activeTab === 'locks' && isAdmin && (
          <div className="no-print" style={styles.sectionGap}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Lock Month Period</h2>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                Locking prevents any contractor edits or deletions for dates within that month.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={styles.label}>Select Month</label>
                  <select
                    style={styles.input}
                    value={selectedMonthToLock}
                    onChange={(e) => setSelectedMonthToLock(e.target.value)}
                  >
                    <option value="">-- Select Month --</option>
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
                    ...styles.button,
                    width: '100%',
                    background: selectedMonthToLock && !lockedMonths.includes(selectedMonthToLock) ? '#2563eb' : '#334155',
                    cursor: selectedMonthToLock && !lockedMonths.includes(selectedMonthToLock) ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Lock className="w-4 h-4" style={{ marginRight: '6px' }} /> Lock Month
                </button>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Locked Periods</h2>
              </div>

              {lockedMonths.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#64748b' }}>No months currently locked.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lockedMonths.map((monthKey) => (
                    <div key={monthKey} style={styles.lockedRow}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Lock className="w-4 h-4 text-red-400" />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fca5a5' }}>
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
            </section>
          </div>
        )}

        {/* INVOICES TAB */}
        {activeTab === 'invoices' && (
          <div style={styles.sectionGap}>
            <section className="no-print" style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Invoice Setup</h2>
              </div>

              <div style={styles.flexForm}>
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

                <div style={styles.formGrid2}>
                  <div>
                    <label style={styles.label}>Month Filter</label>
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
                    <label style={styles.label}>Invoice # Counter</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        style={{ ...styles.input, flex: 1 }}
                        value={currentContractorStartNumber}
                        onChange={(e) => setCurrentContractorStartNumber(Number(e.target.value))}
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateContractorInvoiceCounter(currentContractorStartNumber)}
                        style={styles.iconActionBtn}
                        title="Save Number"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateContractorInvoiceCounter(100)}
                        style={styles.iconActionBtn}
                        title="Reset to 100"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ ...styles.button, width: '100%', marginTop: '6px' }}
                >
                  <Printer className="w-4 h-4" style={{ marginRight: '8px' }} /> Print / Export PDF
                </button>
              </div>
            </section>

            <div className="invoice-container" style={styles.invoiceCard}>
              <div style={styles.invoiceTopRow}>
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>INVOICE</h3>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>AuroraView Reporting</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#38bdf8' }}>
                    INV-{currentContractorStartNumber}
                  </span>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Date: {new Date().toISOString().split('T')[0]}
                  </p>
                </div>
              </div>

              <div style={{ padding: '16px 0', borderBottom: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>CONTRACTOR</span>
                  <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#ffffff', margin: '2px 0 0 0' }}>
                    {selectedContractorInfo.name}
                  </p>
                  <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0 }}>{selectedContractorInfo.email}</p>
                  {selectedContractorInfo.address && (
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                      {selectedContractorInfo.address}
                    </p>
                  )}
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>HOURLY RATE</span>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#ffffff', margin: '2px 0 0 0' }}>
                    ${selectedContractorInfo.rate.toFixed(2)}/hr
                  </p>
                </div>
              </div>

              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="invoice-table" style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Site</th>
                      <th style={styles.th}>Description</th>
                      <th style={styles.th}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={styles.emptyTd}>
                          No entries logged for this period.
                        </td>
                      </tr>
                    ) : (
                      invoiceLogs.map((l) => {
                        const amount = l.type === 'MATERIAL' ? Number(l.cost || 0) : Number(l.totalCost || 0);
                        return (
                          <tr key={l.id} style={styles.tr}>
                            <td style={styles.tdBold}>{l.date}</td>
                            <td style={styles.td}>{formatEntryType(l.type)}</td>
                            <td style={styles.td}>{l.site}</td>
                            <td style={styles.td}>
                              {l.type === 'TIME' ? `${l.hoursWorked} hrs @ $${l.hourlyRate || selectedContractorInfo.rate}/hr` : l.description}
                            </td>
                            <td style={styles.tdBold}>${amount.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div style={styles.invoiceFooter}>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Total Due</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8' }}>
                  ${totalInvoiceAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    background: '#0f172a',
    borderBottom: '1px solid #1e293b',
    padding: '12px 16px 0 16px',
    width: '100vw',
    boxSizing: 'border-box'
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  logoBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: '#2563eb',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  appTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#ffffff',
    margin: 0,
    lineHeight: 1.1
  },
  userEmailText: {
    fontSize: '11px',
    color: '#94a3b8'
  },
  adminBadge: {
    fontSize: '10px',
    background: '#166534',
    color: '#86efac',
    padding: '1px 6px',
    borderRadius: '8px',
    fontWeight: 600
  },
  iconSignOutBtn: {
    background: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabsWrapper: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
    paddingBottom: '10px'
  },
  navTab: {
    background: '#1e293b',
    color: '#94a3b8',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  activeNavTab: {
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  tabIcon: {
    width: '14px',
    height: '14px'
  },
  mainContainer: {
    padding: '16px',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box'
  },
  sectionGap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  card: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '16px',
    padding: '16px',
    boxSizing: 'border-box',
    width: '100%'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px'
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ffffff',
    margin: 0
  },
  cancelLinkBtn: {
    background: 'none',
    border: 'none',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '12px',
    textDecoration: 'underline'
  },
  countBadge: {
    fontSize: '11px',
    color: '#94a3b8',
    background: '#1e293b',
    padding: '2px 8px',
    borderRadius: '10px'
  },
  segmentContainer: {
    display: 'flex',
    background: '#1e293b',
    padding: '4px',
    borderRadius: '10px',
    marginBottom: '14px'
  },
  segmentTab: {
    flex: 1,
    background: 'transparent',
    color: '#94a3b8',
    border: 'none',
    padding: '8px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  segmentActive: {
    flex: 1,
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '8px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  flexForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  formGrid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#cbd5e1',
    marginBottom: '4px'
  },
  input: {
    width: '100%',
    background: '#020617',
    border: '1px solid #334155',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '10px 12px',
    boxSizing: 'border-box'
  },
  button: {
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '44px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    minWidth: '500px'
  },
  th: {
    textAlign: 'left',
    padding: '8px',
    color: '#64748b',
    borderBottom: '1px solid #1e293b',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase'
  },
  tr: {
    borderBottom: '1px solid #1e293b'
  },
  td: {
    padding: '10px 8px',
    color: '#cbd5e1'
  },
  tdBold: {
    padding: '10px 8px',
    color: '#ffffff',
    fontWeight: 600
  },
  emptyTd: {
    padding: '20px',
    textAlign: 'center',
    color: '#64748b'
  },
  timeBadge: {
    background: '#1e3a8a',
    color: '#93c5fd',
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '6px',
    fontWeight: 600
  },
  materialBadge: {
    background: '#312e81',
    color: '#c084fc',
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '6px',
    fontWeight: 600
  },
  deleteIconButton: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '4px'
  },
  editIconButton: {
    background: 'none',
    border: 'none',
    color: '#38bdf8',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  lockedPill: {
    fontSize: '11px',
    color: '#fca5a5',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  siteChip: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '20px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#ffffff'
  },
  chipInput: {
    background: '#020617',
    border: '1px solid #38bdf8',
    color: '#ffffff',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '12px',
    width: '70px'
  },
  chipIconBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 0
  },
  chipIconBtnSuccess: {
    background: 'none',
    border: 'none',
    color: '#4ade80',
    cursor: 'pointer',
    padding: 0
  },
  chipIconBtnDanger: {
    background: 'none',
    border: 'none',
    color: '#f87171',
    cursor: 'pointer',
    padding: 0
  },
  lockedRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#020617',
    border: '1px solid #7f1d1d',
    borderRadius: '10px',
    padding: '10px 14px'
  },
  unlockBtn: {
    background: '#450a0a',
    color: '#fca5a5',
    border: '1px solid #991b1b',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  iconActionBtn: {
    background: '#1e293b',
    color: '#ffffff',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '0 12px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  invoiceCard: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '16px',
    padding: '20px',
    boxSizing: 'border-box'
  },
  invoiceTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '12px',
    borderBottom: '1px solid #334155'
  },
  invoiceFooter: {
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }
};
