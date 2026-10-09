import React, { useState, useEffect, useCallback } from 'react';
import { auth, db } from './firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
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
  User,
  Plus,
  KeyRound,
  FileText,
  Filter,
  ArrowUp,
  ArrowDown,
  Send,

  Shield
} from 'lucide-react';

const ADMIN_EMAIL = 'razy@auroraview.com';

interface UserProfile {
  id: string;
  name?: string;
  email: string;
  hourlyRate?: number;
  address?: string;
  lastLogin?: string;
}

const emailSlug = (email: string) => (email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

const formatMonthName = (monthKey: string) => {
  if (!monthKey || monthKey.length < 7) return monthKey;
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const generateMonthOptions = () => {
  const options: { value: string; label: string }[] = [];
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
  const [user, setUser] = useState<FirebaseUser | null>(null);
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
  const [workTypes, setWorkTypes] = useState<string[]>(['Cleaning', 'Blowing', 'Water Pressure', 'Trimming']);
  const [newWorkType, setNewWorkType] = useState('');

  const [activeTab, setActiveTab] = useState<'logs' | 'admin' | 'invoices' | 'settings'>('logs');
  const [adminSubTab, setAdminSubTab] = useState<'directory' | 'locks' | 'reports'>('directory');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [adminResetEmail, setAdminResetEmail] = useState('');
  const [adminResetMessage, setAdminResetMessage] = useState('');
  const [adminResetError, setAdminResetError] = useState('');
  const [entryType, setEntryType] = useState<'time' | 'material'>('time');

  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [site, setSite] = useState('(AVP)');
  const [hoursWorked, setHoursWorked] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [materialCost, setMaterialCost] = useState('');
  const [timeWorkType, setTimeWorkType] = useState('');

  const [multiEntries, setMultiEntries] = useState<Array<{
    id: string;
    contractorEmail: string;
    date: string;
    site: string;
    type: 'time' | 'material';
    workType: string;
    hours: string;
    description: string;
    cost: string;
  }>>([]);
  const [multiMessage, setMultiMessage] = useState('');
  const [multiSaving, setMultiSaving] = useState(false);

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
  const [reportMonth, setReportMonth] = useState('');
  const [reportInvoiceNumbers, setReportInvoiceNumbers] = useState<{ [email: string]: string }>({});
  const [invoiceUserEmail, setInvoiceUserEmail] = useState('');
  const [invoiceCounters, setInvoiceCounters] = useState<{ [key: string]: number }>({});
  const [currentContractorStartNumber, setCurrentContractorStartNumber] = useState<number>(100);

  const [emailStatus, setEmailStatus] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sendToEmail, setSendToEmail] = useState('');

  const monthOptions = generateMonthOptions();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setSelectedUserEmail(firebaseUser.email || '');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!user) return;

    const emailLower = (user.email || '').toLowerCase();

    const fetchLogs = async () => {
      try {
        let q;
        if (isAdmin) {
          q = query(collection(db, 'logs'), orderBy('date', 'desc'));
        } else {
          q = query(collection(db, 'logs'), where('userEmail', '==', emailLower), orderBy('date', 'desc'));
        }
        const snapshot = await getDocs(q);
        setLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err: any) {
        console.error('Error fetching logs:', err);
      }
    };

    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'users'), orderBy('name')));
        const mapped: UserProfile[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any)
        }));
        setUsersList(mapped);
        if (mapped.length > 0 && !invoiceUserEmail) {
          setInvoiceUserEmail(mapped[0].email);
        }
      } catch (err: any) {
        console.error('Error fetching users:', err);
      }
    };

    const fetchLockedMonths = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'lockedMonths'));
        setLockedMonths(snapshot.docs.map((d) => (d.data() as any).monthKey || d.id));
      } catch (err: any) {
        console.error('Error fetching locked months:', err);
      }
    };

    const fetchSites = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'sites'), orderBy('name')));
        if (!snapshot.empty) {
          const fetched = snapshot.docs.map((d) => (d.data() as any).name || d.id);
          setSites(fetched);
          if (!fetched.includes(site)) {
            setSite(fetched[0] || '');
          }
        } else {
          setSites([]);
          setSite('');
        }
      } catch (err: any) {
        console.error('Error fetching sites:', err);
      }
    };

    const fetchWorkTypes = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'workTypes'), orderBy('name')));
        if (!snapshot.empty) {
          const fetched = snapshot.docs.map((d) => (d.data() as any).name || d.id);
          setWorkTypes(fetched);
          if (fetched.length > 0 && !timeWorkType) {
            setTimeWorkType(fetched[0]);
          }
        }
      } catch (err: any) {
        console.error('Error fetching work types:', err);
      }
    };

    const fetchSettings = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'settings'));
        const data: { [key: string]: any } = {};
        snapshot.docs.forEach((d) => {
          data[d.id] = d.data();
        });
        if (data['invoiceCounters']) {
          setInvoiceCounters((data['invoiceCounters'] as any).value || {});
        }
        if (data['reportInvoiceNumbers']) {
          setReportInvoiceNumbers((data['reportInvoiceNumbers'] as any).value || {});
        }
      } catch (err: any) {
        console.error('Error fetching settings:', err);
      }
    };

    fetchLogs();
    fetchUsers();
    fetchLockedMonths();
    fetchSites();
    fetchWorkTypes();
    fetchSettings();
  }, [user, isAdmin]);

  const targetInvoiceEmail = isAdmin ? (invoiceUserEmail || user?.email || '') : (user?.email || '');

  const emailCounterKey = (e: string) => (e || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const monthCounterKey = (e: string, month: string) => `${emailCounterKey(e)}__${month}`;

  useEffect(() => {
    if (!targetInvoiceEmail) {
      setCurrentContractorStartNumber(100);
      return;
    }
    if (invoiceMonth) {
      const mKey = monthCounterKey(targetInvoiceEmail, invoiceMonth);
      if (invoiceCounters[mKey] !== undefined) {
        setCurrentContractorStartNumber(invoiceCounters[mKey]);
        return;
      }
    }
    const eKey = emailCounterKey(targetInvoiceEmail);
    const lastUsed = invoiceCounters[eKey];
    setCurrentContractorStartNumber(typeof lastUsed === 'number' ? lastUsed + 1 : 100);
  }, [targetInvoiceEmail, invoiceMonth, invoiceCounters]);

  const handleUpdateContractorInvoiceCounter = async (newVal: number) => {
    if (!targetInvoiceEmail) return;
    const eKey = emailCounterKey(targetInvoiceEmail);
    const update: { [key: string]: number } = { [eKey]: newVal };
    if (invoiceMonth) {
      update[monthCounterKey(targetInvoiceEmail, invoiceMonth)] = newVal;
    }
    try {
      const existingDoc = await getDoc(doc(db, 'settings', 'invoiceCounters'));
      const existing = existingDoc.exists() ? (existingDoc.data() as any).value || {} : {};
      const merged = { ...existing, ...update };
      await setDoc(doc(db, 'settings', 'invoiceCounters'), { value: merged });
      setInvoiceCounters(merged as { [key: string]: number });
      setCurrentContractorStartNumber(newVal);
    } catch (err: any) {
      alert('Error updating invoice counter: ' + err.message);
    }
  };

  const buildInvoiceText = (): string => {
    const lines: string[] = [];
    lines.push('INVOICE');
    lines.push('AuroraView Reporting');
    lines.push(`INV-${currentContractorStartNumber}  |  Date: ${new Date().toISOString().split('T')[0]}`);
    lines.push('');
    lines.push(`Contractor: ${selectedContractorInfo.name}`);
    lines.push(`Email: ${selectedContractorInfo.email}`);
    if (selectedContractorInfo.address) lines.push(`Address: ${selectedContractorInfo.address}`);
    lines.push(`Rate: ${selectedContractorInfo.rate.toFixed(2)}/hr`);
    lines.push('');
    for (const locName of siteNames) {
      const group = siteGroups[locName];
      lines.push(`--- ${locName} ---`);
      if (group.totalHours > 0) lines.push(`${group.totalHours.toFixed(2)} hrs | Subtotal: ${group.subtotal.toFixed(2)}`);
      lines.push('Date       Type     Description                              Amount');
      for (const l of group.entries) {
        const amount = l.type === 'MATERIAL' ? Number(l.cost || 0) : Number(l.totalCost || 0);
        const desc = l.type === 'TIME'
          ? `${l.hoursWorked} hrs @ ${l.hourlyRate || selectedContractorInfo.rate}/hr${l.workType ? ' (' + l.workType + ')' : ''}`
          : l.description || '-';
        lines.push(`${(l.date || '').padEnd(11)}${formatEntryType(l.type).padEnd(9)}${desc.padEnd(41)}${amount.toFixed(2)}`);
      }
      lines.push('');
    }
    lines.push(`Total Due: ${totalInvoiceAmount.toFixed(2)}`);
    return lines.join('\n');
  };

  const buildReportText = (): string => {
    const lines: string[] = [];
    lines.push('MONTHLY REPORT');
    lines.push('AuroraView Reporting');
    lines.push(`${reportMonth ? formatMonthName(reportMonth) : 'All Months'}  |  Date: ${new Date().toISOString().split('T')[0]}`);
    lines.push('');
    lines.push('--- Summary Per Site Per Contractor ---');
    lines.push('Contractor          Site               Hours    Labor     Materials  Total');
    for (const r of reportSiteRows) {
      lines.push(`${r.contractor.padEnd(20)}${r.site.padEnd(19)}${r.hours.toFixed(2).padEnd(9)}${r.laborTotal.toFixed(2).padEnd(10)}${r.materialTotal.toFixed(2).padEnd(11)}${r.total.toFixed(2)}`);
    }
    lines.push('');
    lines.push('--- Summary Per Contractor ---');
    lines.push('Contractor          Hours    Labor     Materials  Total');
    for (const rc of reportContractors) {
      lines.push(`${rc.name.padEnd(20)}${rc.totalHours.toFixed(2).padEnd(9)}${rc.laborTotal.toFixed(2).padEnd(10)}${rc.materialTotal.toFixed(2).padEnd(11)}${rc.grandTotal.toFixed(2)}`);
    }
    lines.push('');
    lines.push(`Grand Total: ${reportGrandTotal.toFixed(2)}`);
    return lines.join('\n');
  };

  const handleSendEmail = (type: 'invoice' | 'report') => {
    const targetEmail = type === 'invoice' ? targetInvoiceEmail : '';
    const recipient = sendToEmail.trim() || (type === 'invoice' ? targetEmail : '') || user?.email || '';
    if (!recipient) {
      setEmailError('Please enter an email address to send to.');
      setEmailStatus('');
      return;
    }

    const subject = type === 'invoice'
      ? `Invoice INV-${currentContractorStartNumber} from AuroraView`
      : `Monthly Report ${reportMonth ? formatMonthName(reportMonth) : ''} - AuroraView`;

    const body = type === 'invoice' ? buildInvoiceText() : buildReportText();

    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    setEmailStatus(`Opening your email app to send to ${recipient}...`);
    setSendToEmail('');
    setTimeout(() => setEmailStatus(''), 5000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (cred.user) {
          await setDoc(doc(db, 'users', emailSlug(email)), {
            email: email.toLowerCase(),
            name: fullName || email.split('@')[0],
            hourlyRate: 35,
            address: ''
          });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        const now = new Date().toISOString();
        const userDocRef = doc(db, 'users', emailSlug(email));
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          await updateDoc(userDocRef, { lastLogin: now });
        } else {
          await setDoc(userDocRef, { email: email.toLowerCase(), lastLogin: now });
        }
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (!user) return;

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    try {
      if (currentPassword && user.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }
      await updatePassword(user, newPassword);
      setPasswordMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    }
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

  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const [filterContractor, setFilterContractor] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'cost-desc' | 'cost-asc' | 'contractor' | 'site'>('date-desc');
  const [showFilters, setShowFilters] = useState(false);



  const addMultiEntryRow = () => {
    const defaultContractor = isAdmin ? (selectedUserEmail || usersList[0]?.email || '') : (user?.email || '');
    setMultiEntries((prev) => [...prev, {
      id: `row_${Date.now()}_${prev.length}`,
      contractorEmail: defaultContractor,
      date: new Date().toISOString().split('T')[0],
      site: sites[0] || '',
      type: 'time',
      workType: workTypes[0] || '',
      hours: '',
      description: '',
      cost: '',
    }]);
  };

  const updateMultiEntry = (id: string, field: string, value: string) => {
    setMultiEntries((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  };

  const removeMultiEntry = (id: string) => {
    setMultiEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSaveMultiEntries = async () => {
    if (multiEntries.length === 0) return;
    setMultiSaving(true);
    setMultiMessage('');
    let saved = 0;
    let errors = 0;
    for (const entry of multiEntries) {
      if (isDateLocked(entry.date)) {
        errors++;
        continue;
      }
      const userInfo = getUserInfo(entry.contractorEmail);
      try {
        if (entry.type === 'time') {
          const hrs = parseFloat(entry.hours);
          if (isNaN(hrs) || hrs <= 0) { errors++; continue; }
          await addDoc(collection(db, 'logs'), {
            type: 'TIME',
            userEmail: (entry.contractorEmail || '').toLowerCase(),
            employeeName: userInfo.name,
            date: entry.date,
            site: entry.site,
            workType: entry.workType || '',
            hoursWorked: hrs,
            hourlyRate: userInfo.rate,
            totalCost: hrs * userInfo.rate,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          const cost = parseFloat(entry.cost);
          if (isNaN(cost) || cost <= 0) { errors++; continue; }
          await addDoc(collection(db, 'logs'), {
            type: 'MATERIAL',
            userEmail: (entry.contractorEmail || '').toLowerCase(),
            employeeName: userInfo.name,
            date: entry.date,
            site: entry.site,
            description: entry.description,
            cost,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        saved++;
      } catch {
        errors++;
      }
    }
    await refreshLogs();
    setMultiEntries([]);
    setMultiMessage(`Saved ${saved} entries${errors > 0 ? `, ${errors} skipped/failed` : ''}.`);
    setTimeout(() => setMultiMessage(''), 5000);
    setMultiSaving(false);
  };

  const handleSubmitEntry = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const targetEmail = isAdmin ? selectedUserEmail || user?.email || '' : user?.email || '';

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
        const entryData: any = {
          type: 'TIME',
          userEmail: (targetEmail || '').toLowerCase(),
          employeeName: userInfo.name,
          date,
          site,
          workType: timeWorkType || '',
          hoursWorked: hrs,
          hourlyRate: userInfo.rate,
          totalCost: hrs * userInfo.rate,
          updatedAt: new Date().toISOString()
        };
        if (editingLogId) {
          await updateDoc(doc(db, 'logs', editingLogId), entryData);
          setEditingLogId(null);
        } else {
          entryData.createdAt = new Date().toISOString();
          await addDoc(collection(db, 'logs'), entryData);
        }
        setHoursWorked('');
      } else {
        const cost = parseFloat(materialCost);
        if (isNaN(cost) || cost <= 0) {
          alert('Please enter a valid material cost.');
          return;
        }
        const entryData: any = {
          type: 'MATERIAL',
          userEmail: (targetEmail || '').toLowerCase(),
          employeeName: userInfo.name,
          date,
          site,
          description: materialDescription,
          cost,
          updatedAt: new Date().toISOString()
        };
        if (editingLogId) {
          await updateDoc(doc(db, 'logs', editingLogId), entryData);
          setEditingLogId(null);
        } else {
          entryData.createdAt = new Date().toISOString();
          await addDoc(collection(db, 'logs'), entryData);
        }
        setMaterialDescription('');
        setMaterialCost('');
      }
      await refreshLogs();
    } catch (err: any) {
      alert('Error saving entry: ' + err.message);
    }
  };

  const refreshLogs = useCallback(async () => {
    if (!user) return;
    const emailLower = (user.email || '').toLowerCase();
    try {
      let q;
      if (isAdmin) {
        q = query(collection(db, 'logs'), orderBy('date', 'desc'));
      } else {
        q = query(collection(db, 'logs'), where('userEmail', '==', emailLower), orderBy('date', 'desc'));
      }
      const snapshot = await getDocs(q);
      setLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err: any) {
      console.error('Error refreshing logs:', err);
    }
  }, [user, isAdmin]);

  const handleDeleteLog = async (logId: string, logDate: string) => {
    if (isDateLocked(logDate)) {
      alert('This transaction belongs to a locked month and cannot be deleted.');
      return;
    }
    if (confirm('Are you sure you want to delete this log transaction?')) {
      try {
        await deleteDoc(doc(db, 'logs', logId));
        await refreshLogs();
      } catch (err: any) {
        alert('Error deleting transaction: ' + err.message);
      }
    }
  };

  const handleEditLogClick = (log: any) => {
    if (isDateLocked(log.date)) {
      alert('This transaction belongs to a locked month and cannot be edited.');
      return;
    }
    if (log.type === 'TIME') {
      setEntryType('time');
      setHoursWorked(String(log.hoursWorked ?? ''));
      setTimeWorkType(log.workType || workTypes[0] || '');
    } else {
      setEntryType('material');
      setMaterialDescription(log.description ?? '');
      setMaterialCost(log.cost != null ? String(log.cost) : '');
    }
    setDate(log.date);
    setSite(log.site || sites[0] || '');
    if (isAdmin && log.userEmail) {
      setSelectedUserEmail(log.userEmail);
    }
    setEditingLogId(log.id);
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminResetMessage('');
    setAdminResetError('');
    const targetEmail = adminResetEmail.trim().toLowerCase();
    if (!targetEmail) {
      setAdminResetError('Please select a contractor.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setAdminResetMessage(`Password reset email sent to ${targetEmail}. The contractor will receive an email with a link to set a new password.`);
      setAdminResetEmail('');
    } catch (err: any) {
      setAdminResetError(err.message || 'Failed to send password reset email.');
    }
  };

  const handleCancelEditLog = () => {
    setEditingLogId(null);
    setEntryType('time');
    setHoursWorked('');
    setMaterialDescription('');
    setMaterialCost('');
    setTimeWorkType(workTypes[0] || '');
    setDate(new Date().toISOString().split('T')[0]);
    setSite(sites[0] || '');
  };

  const handleSaveInlineEdit = async () => {
    await handleSubmitEntry();
  };

  const handleSaveUser = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newUserEmail) return;
    try {
      const docId = editingUserId || emailSlug(newUserEmail);
      await setDoc(doc(db, 'users', docId), {
        email: (newUserEmail || '').toLowerCase(),
        name: newUserName,
        hourlyRate: parseFloat(newUserRate) || 0,
        address: newUserAddress
      }, { merge: true });

      const snapshot = await getDocs(query(collection(db, 'users'), orderBy('name')));
      setUsersList(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
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
        const snapshot = await getDocs(query(collection(db, 'users'), orderBy('name')));
        setUsersList(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
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

  const handleSaveInlineUserEdit = async () => {
    await handleSaveUser();
  };

  const handleAddWorkType = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWorkType.trim();
    if (!trimmed) return;
    if (workTypes.some((w) => w.toLowerCase() === trimmed.toLowerCase())) {
      alert('This work type already exists.');
      return;
    }
    try {
      const docId = trimmed.toLowerCase().replace(/[^a-z0-9]/gi, '_');
      await setDoc(doc(db, 'workTypes', docId), { name: trimmed });
      setWorkTypes([...workTypes, trimmed].sort((a, b) => a.localeCompare(b)));
      setNewWorkType('');
    } catch (err: any) {
      alert('Error adding work type: ' + err.message);
    }
  };

  const handleDeleteWorkType = async (workType: string) => {
    if (confirm(`Are you sure you want to delete work type "${workType}"?`)) {
      try {
        const docId = workType.toLowerCase().replace(/[^a-z0-9]/gi, '_');
        await deleteDoc(doc(db, 'workTypes', docId));
        setWorkTypes(workTypes.filter((w) => w !== workType));
      } catch (err: any) {
        alert('Error deleting work type: ' + err.message);
      }
    }
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
      const snapshot = await getDocs(query(collection(db, 'sites'), orderBy('name')));
      if (!snapshot.empty) setSites(snapshot.docs.map((d) => (d.data() as any).name || d.id));
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

      const snapshot = await getDocs(query(collection(db, 'sites'), orderBy('name')));
      if (!snapshot.empty) setSites(snapshot.docs.map((d) => (d.data() as any).name || d.id));

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
        const snapshot = await getDocs(query(collection(db, 'sites'), orderBy('name')));
        if (!snapshot.empty) setSites(snapshot.docs.map((d) => (d.data() as any).name || d.id));
      } catch (err: any) {
        alert('Error deleting site: ' + err.message);
      }
    }
  };

  const handleLockMonth = async (monthKey: string) => {
    if (!isAdmin || !monthKey) return;
    try {
      await setDoc(doc(db, 'lockedMonths', monthKey), {
        monthKey,
        lockedBy: user?.email || ''
      });
      setSelectedMonthToLock('');
      const snapshot = await getDocs(collection(db, 'lockedMonths'));
      setLockedMonths(snapshot.docs.map((d) => (d.data() as any).monthKey || d.id));
    } catch (err: any) {
      alert('Error locking month: ' + err.message);
    }
  };

  const handleUnlockMonth = async (monthKey: string) => {
    if (!isAdmin || !monthKey) return;
    try {
      await deleteDoc(doc(db, 'lockedMonths', monthKey));
      const snapshot = await getDocs(collection(db, 'lockedMonths'));
      setLockedMonths(snapshot.docs.map((d) => (d.data() as any).monthKey || d.id));
    } catch (err: any) {
      alert('Error unlocking month: ' + err.message);
    }
  };

  const handleReportInvoiceNumberBlur = async (contractorEmail: string) => {
    try {
      const existingDoc = await getDoc(doc(db, 'settings', 'reportInvoiceNumbers'));
      const existing = existingDoc.exists() ? (existingDoc.data() as any).value || {} : {};
      const merged = { ...existing, [contractorEmail]: reportInvoiceNumbers[contractorEmail] || '' };
      await setDoc(doc(db, 'settings', 'reportInvoiceNumbers'), { value: merged });
    } catch (err: any) {
      console.error('Error saving report invoice number:', err);
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '16px' }}>AuroraView</div>
          <div style={{ width: '32px', height: '32px', border: '3px solid #1e293b', borderTopColor: '#38bdf8', borderRadius: '50%', margin: '0 auto 12px', animation: 'av-spin 0.8s linear infinite' }} />
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading system...</p>
          <style>{`@keyframes av-spin { to { transform: rotate(360deg); } }`}</style>
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
            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Time &amp; Material Reporting</p>
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

  const baseLogs = isAdmin
    ? logs
    : logs.filter((l) => l.userEmail?.toLowerCase() === user.email?.toLowerCase());

  const hasActiveFilters = filterContractor || filterSite || filterType || filterDateFrom || filterDateTo || filterMonth;

  const filteredLogs = baseLogs.filter((l) => {
    if (filterContractor && l.userEmail?.toLowerCase() !== filterContractor.toLowerCase()) return false;
    if (filterSite && l.site !== filterSite) return false;
    if (filterType && l.type !== filterType) return false;
    if (filterMonth && !l.date.startsWith(filterMonth)) return false;
    if (filterDateFrom && l.date < filterDateFrom) return false;
    if (filterDateTo && l.date > filterDateTo) return false;
    return true;
  });

  const visibleLogs = [...filteredLogs].sort((a, b) => {
    switch (sortBy) {
      case 'date-asc':
        return (a.date || '').localeCompare(b.date || '');
      case 'cost-desc': {
        const ca = a.type === 'MATERIAL' ? Number(a.cost || 0) : Number(a.totalCost || 0);
        const cb = b.type === 'MATERIAL' ? Number(b.cost || 0) : Number(b.totalCost || 0);
        return cb - ca;
      }
      case 'cost-asc': {
        const ca = a.type === 'MATERIAL' ? Number(a.cost || 0) : Number(a.totalCost || 0);
        const cb = b.type === 'MATERIAL' ? Number(b.cost || 0) : Number(b.totalCost || 0);
        return ca - cb;
      }
      case 'contractor':
        return (a.employeeName || '').localeCompare(b.employeeName || '');
      case 'site':
        return (a.site || '').localeCompare(b.site || '');
      default:
        return (b.date || '').localeCompare(a.date || '');
    }
  });

  const clearFilters = () => {
    setFilterContractor('');
    setFilterSite('');
    setFilterType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterMonth('');
    setSortBy('date-desc');
  };

  const selectedContractorInfo = getUserInfo(targetInvoiceEmail);

  const invoiceLogs = logs
    .filter((l) => (!invoiceMonth || l.date.startsWith(invoiceMonth)))
    .filter((l) => l.userEmail?.toLowerCase() === (targetInvoiceEmail || '').toLowerCase());

  const totalInvoiceAmount = invoiceLogs.reduce((sum, log) => {
    const amt = log.type === 'MATERIAL' ? Number(log.cost || 0) : Number(log.totalCost || 0);
    return sum + amt;
  }, 0);

  const siteGroups = invoiceLogs.reduce((acc: Record<string, { entries: any[]; totalHours: number; laborTotal: number; materialTotal: number; subtotal: number }>, l) => {
    const loc = l.site || 'Unassigned';
    if (!acc[loc]) {
      acc[loc] = { entries: [], totalHours: 0, laborTotal: 0, materialTotal: 0, subtotal: 0 };
    }
    acc[loc].entries.push(l);
    if (l.type === 'TIME') {
      const h = Number(l.hoursWorked || 0);
      const labor = Number(l.totalCost || h * (l.hourlyRate || selectedContractorInfo.rate));
      acc[loc].totalHours += h;
      acc[loc].laborTotal += labor;
      acc[loc].subtotal += labor;
    } else {
      const m = Number(l.cost || 0);
      acc[loc].materialTotal += m;
      acc[loc].subtotal += m;
    }
    return acc;
  }, {});

  const siteNames = Object.keys(siteGroups);

  const reportLogs = logs.filter((l) => (!reportMonth || l.date.startsWith(reportMonth)));

  interface ReportSiteSummary {
    site: string;
    hours: number;
    laborTotal: number;
    materialTotal: number;
    total: number;
  }

  interface ReportContractor {
    email: string;
    name: string;
    rate: number;
    entries: any[];
    totalHours: number;
    laborTotal: number;
    materialTotal: number;
    grandTotal: number;
    siteSummaries: ReportSiteSummary[];
  }

  const reportContractors: ReportContractor[] = usersList
    .map((u) => {
      const e = (u.email || '').toLowerCase();
      const entries = reportLogs.filter((l) => l.userEmail?.toLowerCase() === e);
      const totalHours = entries
        .filter((l) => l.type === 'TIME')
        .reduce((sum, l) => sum + Number(l.hoursWorked || 0), 0);
      const laborTotal = entries
        .filter((l) => l.type === 'TIME')
        .reduce((sum, l) => sum + Number(l.totalCost || 0), 0);
      const materialTotal = entries
        .filter((l) => l.type === 'MATERIAL')
        .reduce((sum, l) => sum + Number(l.cost || 0), 0);

      const siteMap: Record<string, ReportSiteSummary> = {};
      for (const l of entries) {
        const loc = l.site || 'Unassigned';
        if (!siteMap[loc]) {
          siteMap[loc] = { site: loc, hours: 0, laborTotal: 0, materialTotal: 0, total: 0 };
        }
        if (l.type === 'TIME') {
          siteMap[loc].hours += Number(l.hoursWorked || 0);
          siteMap[loc].laborTotal += Number(l.totalCost || 0);
          siteMap[loc].total += Number(l.totalCost || 0);
        } else {
          siteMap[loc].materialTotal += Number(l.cost || 0);
          siteMap[loc].total += Number(l.cost || 0);
        }
      }
      const siteSummaries = Object.values(siteMap).sort((a, b) => a.site.localeCompare(b.site));

      return {
        email: u.email,
        name: u.name || u.email,
        rate: u.hourlyRate ? Number(u.hourlyRate) : 35,
        entries,
        totalHours,
        laborTotal,
        materialTotal,
        grandTotal: laborTotal + materialTotal,
        siteSummaries
      };
    })
    .filter((rc) => rc.entries.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const reportGrandTotal = reportContractors.reduce((sum, rc) => sum + rc.grandTotal, 0);

  const reportSiteRows: { contractor: string; site: string; hours: number; laborTotal: number; materialTotal: number; total: number }[] = [];
  for (const rc of reportContractors) {
    for (const ss of rc.siteSummaries) {
      reportSiteRows.push({
        contractor: rc.name,
        site: ss.site,
        hours: ss.hours,
        laborTotal: ss.laborTotal,
        materialTotal: ss.materialTotal,
        total: ss.total
      });
    }
  }

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
          .report-container {
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .report-container * {
            color: #000000 !important;
          }
          .report-table th, .report-table td {
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

          <button
            onClick={() => setActiveTab('invoices')}
            style={activeTab === 'invoices' ? styles.activeNavTab : styles.navTab}
          >
            <Printer style={styles.tabIcon} /> Invoices
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            style={activeTab === 'settings' ? styles.activeNavTab : styles.navTab}
          >
            <KeyRound style={styles.tabIcon} /> Settings
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              style={activeTab === 'admin' ? styles.activeNavTab : styles.navTab}
            >
              <Shield style={styles.tabIcon} /> Admin
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main style={styles.mainContainer}>

        {/* LOG ENTRIES TAB */}
        {activeTab === 'logs' && (
          <div className="no-print" style={styles.sectionGap}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Record New Entries</h2>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={addMultiEntryRow}
                  style={{ ...styles.button, background: '#059669', padding: '10px 20px' }}
                >
                  <Plus className="w-4 h-4" style={{ marginRight: '8px' }} /> Add Row
                </button>
                {multiEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMultiEntries([])}
                    style={{ ...styles.cancelLinkBtn, color: '#94a3b8' }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {multiEntries.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                  Click "Add Row" to create new entries. You can add multiple rows for different contractors, dates, and sites, then save them all at once.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {multiEntries.map((entry, idx) => (
                    <div key={entry.id} style={{ padding: '12px', background: '#020617', border: '1px solid #334155', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>Entry #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeMultiEntry(entry.id)}
                          style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {isAdmin && (
                          <div style={{ flex: '1 1 180px' }}>
                            <label style={styles.label}>Contractor</label>
                            <select
                              style={styles.input}
                              value={entry.contractorEmail}
                              onChange={(e) => updateMultiEntry(entry.id, 'contractorEmail', e.target.value)}
                            >
                              {usersList.map((u) => (
                                <option key={u.id} value={u.email}>{u.name || u.email}</option>
                              ))}
                              {!usersList.some((u) => u.email === user.email) && (
                                <option value={user.email || ''}>{user.email}</option>
                              )}
                            </select>
                          </div>
                        )}

                        <div style={{ flex: '1 1 120px' }}>
                          <label style={styles.label}>Type</label>
                          <select
                            style={styles.input}
                            value={entry.type}
                            onChange={(e) => updateMultiEntry(entry.id, 'type', e.target.value)}
                          >
                            <option value="time">Time</option>
                            <option value="material">Material</option>
                          </select>
                        </div>

                        <div style={{ flex: '1 1 140px' }}>
                          <label style={styles.label}>Date</label>
                          <input
                            type="date"
                            style={styles.input}
                            value={entry.date}
                            onChange={(e) => updateMultiEntry(entry.id, 'date', e.target.value)}
                          />
                        </div>

                        <div style={{ flex: '1 1 120px' }}>
                          <label style={styles.label}>Site</label>
                          <select
                            style={styles.input}
                            value={entry.site}
                            onChange={(e) => updateMultiEntry(entry.id, 'site', e.target.value)}
                          >
                            {sites.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                        {entry.type === 'time' ? (
                          <>
                            <div style={{ flex: '1 1 160px' }}>
                              <label style={styles.label}>Work Type</label>
                              <select
                                style={styles.input}
                                value={entry.workType}
                                onChange={(e) => updateMultiEntry(entry.id, 'workType', e.target.value)}
                              >
                                {workTypes.map((w) => (
                                  <option key={w} value={w}>{w}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ flex: '1 1 120px' }}>
                              <label style={styles.label}>Hours</label>
                              <input
                                type="number"
                                step="0.25"
                                placeholder="e.g. 8.0"
                                style={styles.input}
                                value={entry.hours}
                                onChange={(e) => updateMultiEntry(entry.id, 'hours', e.target.value)}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ flex: '1 1 200px' }}>
                              <label style={styles.label}>Description</label>
                              <input
                                type="text"
                                placeholder="Hardware / Supplies"
                                style={styles.input}
                                value={entry.description}
                                onChange={(e) => updateMultiEntry(entry.id, 'description', e.target.value)}
                              />
                            </div>
                            <div style={{ flex: '1 1 120px' }}>
                              <label style={styles.label}>Cost ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                style={styles.input}
                                value={entry.cost}
                                onChange={(e) => updateMultiEntry(entry.id, 'cost', e.target.value)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleSaveMultiEntries}
                    disabled={multiSaving}
                    style={{ ...styles.button, width: '100%', marginTop: '4px', opacity: multiSaving ? 0.6 : 1 }}
                  >
                    {multiSaving ? 'Saving...' : `Save All Entries (${multiEntries.length})`}
                  </button>
                </div>
              )}

              {multiMessage && (
                <div style={{ marginTop: '10px', padding: '8px 12px', background: '#052e16', border: '1px solid #166534', borderRadius: '8px', fontSize: '13px', color: '#86efac' }}>
                  {multiMessage}
                </div>
              )}
            </section>

            {/* Filter & Sort Bar */}
            <section style={styles.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    ...styles.iconActionBtn,
                    background: showFilters || hasActiveFilters ? '#2563eb' : '#1e293b',
                    color: showFilters || hasActiveFilters ? '#ffffff' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    border: hasActiveFilters ? '1px solid #38bdf8' : '1px solid #334155'
                  }}
                >
                  <Filter className="w-4 h-4" /> Filter & Sort{hasActiveFilters ? ` (${visibleLogs.length})` : ''}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Sort by</label>
                  <select
                    style={{ ...styles.input, width: 'auto', padding: '6px 10px', fontSize: '13px' }}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  >
                    <option value="date-desc">Date (Newest)</option>
                    <option value="date-asc">Date (Oldest)</option>
                    <option value="cost-desc">Cost (High to Low)</option>
                    <option value="cost-asc">Cost (Low to High)</option>
                    <option value="contractor">Contractor Name</option>
                    <option value="site">Site Location</option>
                  </select>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>
                    {sortBy.includes('desc') ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
                  </span>
                </div>
              </div>

              {showFilters && (
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {isAdmin && (
                      <div style={{ flex: '1 1 140px' }}>
                        <label style={styles.label}>Contractor</label>
                        <select style={styles.input} value={filterContractor} onChange={(e) => setFilterContractor(e.target.value)}>
                          <option value="">All Contractors</option>
                          {usersList.map((u) => (
                            <option key={u.id} value={u.email}>{u.name || u.email}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div style={{ flex: '1 1 120px' }}>
                      <label style={styles.label}>Site</label>
                      <select style={styles.input} value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
                        <option value="">All Sites</option>
                        {sites.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div style={{ flex: '1 1 120px' }}>
                      <label style={styles.label}>Entry Type</label>
                      <select style={styles.input} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                        <option value="">All Types</option>
                        <option value="TIME">Time</option>
                        <option value="MATERIAL">Material</option>
                      </select>
                    </div>

                    <div style={{ flex: '1 1 140px' }}>
                      <label style={styles.label}>Month</label>
                      <select style={styles.input} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                        <option value="">All Months</option>
                        {monthOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={styles.label}>Date From</label>
                      <input type="date" style={styles.input} value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={styles.label}>Date To</label>
                      <input type="date" style={styles.input} value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Showing {visibleLogs.length} of {baseLogs.length} entries
                    </span>
                    <button type="button" onClick={clearFilters} style={{ ...styles.cancelLinkBtn, color: '#38bdf8' }}>
                      Clear All Filters
                    </button>
                  </div>
                </div>
              )}
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
                      <th style={styles.th}>Work Type</th>
                      <th style={styles.th}>Details</th>
                      <th style={styles.th}>Cost</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={styles.emptyTd}>
                          No entries logged yet.
                        </td>
                      </tr>
                    ) : (
                      visibleLogs.map((log) => {
                        const locked = isDateLocked(log.date);
                        const isEditing = editingLogId === log.id;
                        if (isEditing) {
                          return (
                            <tr key={log.id} style={{ ...styles.tr, background: 'rgba(56, 189, 248, 0.08)' }}>
                              <td style={styles.td}>
                                <input type="date" style={{ ...styles.input, padding: '4px 6px', fontSize: '12px' }} value={date} onChange={(e) => setDate(e.target.value)} />
                              </td>
                              <td style={styles.td}>
                                <span style={entryType === 'time' ? styles.timeBadge : styles.materialBadge}>
                                  {entryType === 'time' ? 'Time' : 'Material'}
                                </span>
                              </td>
                              <td style={styles.td}>
                                {isAdmin ? (
                                  <select style={{ ...styles.input, padding: '4px 6px', fontSize: '12px' }} value={selectedUserEmail} onChange={(e) => setSelectedUserEmail(e.target.value)}>
                                    {usersList.map((u) => (
                                      <option key={u.id} value={u.email}>{u.name || u.email}</option>
                                    ))}
                                  </select>
                                ) : (
                                  log.employeeName || 'Raz Yaron'
                                )}
                              </td>
                              <td style={styles.td}>
                                <select style={{ ...styles.input, padding: '4px 6px', fontSize: '12px' }} value={site} onChange={(e) => setSite(e.target.value)}>
                                  {sites.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                              <td style={styles.td}>
                                {entryType === 'time' ? (
                                  <select style={{ ...styles.input, padding: '4px 6px', fontSize: '12px' }} value={timeWorkType} onChange={(e) => setTimeWorkType(e.target.value)}>
                                    {workTypes.map((w) => <option key={w} value={w}>{w}</option>)}
                                  </select>
                                ) : '-'}
                              </td>
                              <td style={styles.td}>
                                {entryType === 'time' ? (
                                  <input type="number" step="0.25" placeholder="hrs" style={{ ...styles.input, padding: '4px 6px', fontSize: '12px', width: '70px' }} value={hoursWorked} onChange={(e) => setHoursWorked(e.target.value)} />
                                ) : (
                                  <input type="text" placeholder="Description" style={{ ...styles.input, padding: '4px 6px', fontSize: '12px', width: '120px' }} value={materialDescription} onChange={(e) => setMaterialDescription(e.target.value)} />
                                )}
                              </td>
                              <td style={styles.tdBold}>
                                {entryType === 'material' ? (
                                  <input type="number" step="0.01" placeholder="0.00" style={{ ...styles.input, padding: '4px 6px', fontSize: '12px', width: '70px' }} value={materialCost} onChange={(e) => setMaterialCost(e.target.value)} />
                                ) : (
                                  <span style={{ color: '#64748b', fontSize: '12px' }}>auto</span>
                                )}
                              </td>
                              <td style={{ ...styles.td, display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={handleSaveInlineEdit}
                                  style={{ ...styles.editIconButton, color: '#4ade80', borderColor: '#166534' }}
                                  title="Save Changes"
                                >
                                  <Check className="w-3.5 h-3.5" /> Save
                                </button>
                                <button
                                  onClick={handleCancelEditLog}
                                  style={{ ...styles.cancelLinkBtn, color: '#fca5a5', fontSize: '12px' }}
                                  title="Cancel Edit"
                                >
                                  <X className="w-3.5 h-3.5" /> Cancel
                                </button>
                              </td>
                            </tr>
                          );
                        }
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
                              {log.type === 'TIME' ? (log.workType || '-') : '-'}
                            </td>
                            <td style={styles.td}>
                              {log.type === 'TIME' ? `${log.hoursWorked} hrs` : log.description || '-'}
                            </td>
                            <td style={styles.tdBold}>
                              {log.type === 'MATERIAL' && log.cost != null
                                ? `${Number(log.cost).toFixed(2)}`
                                : log.type === 'TIME' && log.totalCost != null
                                ? `${Number(log.totalCost).toFixed(2)}`
                                : '-'}
                            </td>
                            <td style={{ ...styles.td, display: 'flex', gap: '8px' }}>
                              {locked ? (
                                <span style={styles.lockedPill}><Lock className="w-3 h-3" /> Locked</span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEditLogClick(log)}
                                    style={styles.editIconButton}
                                    title="Edit Transaction"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" /> Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLog(log.id, log.date)}
                                    style={styles.deleteIconButton}
                                    title="Delete Transaction"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
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

        {/* ADMIN TAB */}
        {activeTab === 'admin' && isAdmin && (
          <div className="no-print" style={styles.sectionGap}>
            <div style={styles.tabsWrapper}>
              <button
                onClick={() => setAdminSubTab('directory')}
                style={adminSubTab === 'directory' ? styles.activeNavTab : styles.navTab}
              >
                <User style={styles.tabIcon} /> Directory
              </button>
              <button
                onClick={() => setAdminSubTab('locks')}
                style={adminSubTab === 'locks' ? styles.activeNavTab : styles.navTab}
              >
                <Lock style={styles.tabIcon} /> Month Lock
              </button>
              <button
                onClick={() => setAdminSubTab('reports')}
                style={adminSubTab === 'reports' ? styles.activeNavTab : styles.navTab}
              >
                <FileText style={styles.tabIcon} /> Reports
              </button>
            </div>

            {adminSubTab === 'directory' && (
              <div style={styles.sectionGap}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Add New Contractor</h2>
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
                  Save New Contractor
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
                      <th style={styles.th}>Last Login</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => {
                      const isEditingUser = editingUserId === u.id;
                      if (isEditingUser) {
                        return (
                          <tr key={u.id} style={{ ...styles.tr, background: 'rgba(56, 189, 248, 0.08)' }}>
                            <td style={styles.td}>
                              <input type="text" style={{ ...styles.input, padding: '4px 6px', fontSize: '12px' }} value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                            </td>
                            <td style={styles.td}>
                              <input type="email" style={{ ...styles.input, padding: '4px 6px', fontSize: '12px' }} value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                            </td>
                            <td style={styles.td}>
                              <input type="number" step="0.01" style={{ ...styles.input, padding: '4px 6px', fontSize: '12px', width: '70px' }} value={newUserRate} onChange={(e) => setNewUserRate(e.target.value)} />
                            </td>
                            <td style={styles.td}>
                              <input type="text" style={{ ...styles.input, padding: '4px 6px', fontSize: '12px' }} value={newUserAddress} onChange={(e) => setNewUserAddress(e.target.value)} />
                            </td>
                            <td style={styles.td}>
                              {u.lastLogin ? new Date(u.lastLogin).toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}
                            </td>
                            <td style={{ ...styles.td, display: 'flex', gap: '6px' }}>
                              <button
                                onClick={handleSaveInlineUserEdit}
                                style={{ ...styles.editIconButton, color: '#4ade80', borderColor: '#166534' }}
                                title="Save Changes"
                              >
                                <Check className="w-3.5 h-3.5" /> Save
                              </button>
                              <button
                                onClick={handleCancelUserEdit}
                                style={{ ...styles.cancelLinkBtn, color: '#fca5a5', fontSize: '12px' }}
                                title="Cancel Edit"
                              >
                                <X className="w-3.5 h-3.5" /> Cancel
                              </button>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={u.id} style={styles.tr}>
                          <td style={styles.tdBold}>{u.name || '-'}</td>
                          <td style={styles.td}>{u.email}</td>
                          <td style={styles.tdBold}>${u.hourlyRate ? Number(u.hourlyRate).toFixed(2) : '35.00'}/hr</td>
                          <td style={styles.td}>{u.address || '-'}</td>
                          <td style={styles.td}>{u.lastLogin ? new Date(u.lastLogin).toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}</td>
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
                      );
                    })}
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

            {/* Work Types Management */}
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Work Types</h2>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                These options appear in the Work Type dropdown when logging time entries.
              </p>

              <form onSubmit={handleAddWorkType} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="New Work Type (e.g. Mowing)"
                  style={{ ...styles.input, flex: 1 }}
                  value={newWorkType}
                  onChange={(e) => setNewWorkType(e.target.value)}
                />
                <button type="submit" style={styles.button}>
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {workTypes.map((w) => (
                  <div key={w} style={styles.siteChip}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{w}</span>
                      <button onClick={() => handleDeleteWorkType(w)} style={styles.chipIconBtnDanger}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {workTypes.length === 0 && (
                  <p style={{ fontSize: '13px', color: '#64748b' }}>No work types yet. Add one above.</p>
                )}
              </div>
            </section>
              </div>
            )}

            {adminSubTab === 'locks' && (
              <div style={styles.sectionGap}>
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

            {adminSubTab === 'reports' && (
              <div style={styles.sectionGap}>
            <section className="no-print" style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Monthly Report</h2>
              </div>

              <div style={styles.flexForm}>
                <div>
                  <label style={styles.label}>Select Month</label>
                  <select
                    style={styles.input}
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                  >
                    <option value="">All Months</option>
                    {monthOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ ...styles.button, width: '100%', marginTop: '6px' }}
                >
                  <Printer className="w-4 h-4" style={{ marginRight: '8px' }} /> Print / Export PDF
                </button>

                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
                  <label style={styles.label}>Send Report via Email</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="email"
                      placeholder={user?.email || 'recipient@example.com'}
                      style={{ ...styles.input, flex: 1 }}
                      value={sendToEmail}
                      onChange={(e) => setSendToEmail(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => handleSendEmail('report')}
                      style={{ ...styles.button, background: '#059669', flex: '0 0 auto', padding: '10px 20px' }}
                    >
                      <Send className="w-4 h-4" style={{ marginRight: '8px' }} />
                      Send Email
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                    Leave blank to send to yourself ({user?.email}).
                  </p>
                  {emailStatus && adminSubTab === 'reports' && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: '#052e16', border: '1px solid #166534', borderRadius: '8px', fontSize: '12px', color: '#86efac' }}>
                      {emailStatus}
                    </div>
                  )}
                  {emailError && adminSubTab === 'reports' && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: '#450a0a', border: '1px solid #991b1b', borderRadius: '8px', fontSize: '12px', color: '#fca5a5' }}>
                      {emailError}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <div className="report-container" style={styles.invoiceCard}>
              <div style={styles.invoiceTopRow}>
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>MONTHLY REPORT</h3>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>AuroraView Reporting</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#38bdf8' }}>
                    {reportMonth ? formatMonthName(reportMonth) : 'All Months'}
                  </span>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Date: {new Date().toISOString().split('T')[0]}
                  </p>
                </div>
              </div>

              {/* PER-SITE PER-EMPLOYEE SUMMARY */}
              <div style={{ marginTop: '20px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#38bdf8' }}>Summary Per Site Per Contractor</span>
                <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginTop: '8px' }}>
                  <table className="report-table" style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Contractor</th>
                        <th style={styles.th}>Site</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Hours</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Labor</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Materials</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportSiteRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={styles.emptyTd}>
                            No entries for this period.
                          </td>
                        </tr>
                      ) : (
                        reportSiteRows.map((row, i) => (
                          <tr key={i} style={styles.tr}>
                            <td style={styles.tdBold}>{row.contractor}</td>
                            <td style={styles.td}>{row.site}</td>
                            <td style={{ ...styles.tdBold, textAlign: 'right' }}>{row.hours.toFixed(2)}</td>
                            <td style={{ ...styles.tdBold, textAlign: 'right' }}>${row.laborTotal.toFixed(2)}</td>
                            <td style={{ ...styles.tdBold, textAlign: 'right' }}>${row.materialTotal.toFixed(2)}</td>
                            <td style={{ ...styles.tdBold, textAlign: 'right' }}>${row.total.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PER-EMPLOYEE SUMMARY */}
              <div style={{ marginTop: '24px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#38bdf8' }}>Summary Per Contractor</span>
                <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginTop: '8px' }}>
                  <table className="report-table" style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Contractor</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Hours</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Labor</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Materials</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportContractors.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={styles.emptyTd}>
                            No entries for this period.
                          </td>
                        </tr>
                      ) : (
                        reportContractors.map((rc) => (
                          <tr key={rc.email} style={styles.tr}>
                            <td style={styles.tdBold}>{rc.name}</td>
                            <td style={{ ...styles.tdBold, textAlign: 'right' }}>{rc.totalHours.toFixed(2)}</td>
                            <td style={{ ...styles.tdBold, textAlign: 'right' }}>${rc.laborTotal.toFixed(2)}</td>
                            <td style={{ ...styles.tdBold, textAlign: 'right' }}>${rc.materialTotal.toFixed(2)}</td>
                            <td style={{ ...styles.tdBold, textAlign: 'right' }}>${rc.grandTotal.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* GRAND TOTAL */}
              <div style={styles.invoiceFooter}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>Grand Total (All Contractors)</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8' }}>
                  ${reportGrandTotal.toFixed(2)}
                </span>
              </div>

              {/* PER-CONTRACTOR BREAKDOWN BY SITE */}
              {reportContractors.map((rc) => (
                <div key={rc.email} style={{ marginTop: '24px', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#38bdf8' }}>
                      {rc.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Invoice #</label>
                        <input
                          type="text"
                          value={reportInvoiceNumbers[rc.email] || ''}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setReportInvoiceNumbers((prev) => ({ ...prev, [rc.email]: newVal }));
                          }}
                          onBlur={() => handleReportInvoiceNumberBlur(rc.email)}
                          placeholder={`INV-${100 + reportContractors.indexOf(rc)}`}
                          style={{ width: '90px', padding: '4px 8px', fontSize: '12px', color: '#ffffff', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px' }}
                        />
                      </div>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {rc.totalHours.toFixed(2)} hrs | Total: <strong style={{ color: '#ffffff' }}>${rc.grandTotal.toFixed(2)}</strong>
                      </span>
                    </div>
                  </div>

                  {rc.siteSummaries.map((ss) => {
                    const siteEntries = rc.entries
                      .filter((l) => (l.site || 'Unassigned') === ss.site)
                      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                    return (
                      <div key={ss.site} style={{ marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>
                            {ss.site}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {ss.hours.toFixed(2)} hrs | Subtotal: <strong style={{ color: '#ffffff' }}>${ss.total.toFixed(2)}</strong>
                          </span>
                        </div>
                        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                          <table className="report-table" style={styles.table}>
                            <thead>
                              <tr>
                                <th style={styles.th}>Date</th>
                                <th style={styles.th}>Type</th>
                                <th style={styles.th}>Description</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {siteEntries.map((l) => {
                                const amount = l.type === 'MATERIAL' ? Number(l.cost || 0) : Number(l.totalCost || 0);
                                return (
                                  <tr key={l.id} style={styles.tr}>
                                    <td style={styles.tdBold}>{l.date}</td>
                                    <td style={styles.td}>{formatEntryType(l.type)}</td>
                                    <td style={styles.td}>
                                      {l.type === 'TIME'
                                        ? `${l.hoursWorked} hrs @ ${l.hourlyRate || rc.rate}/hr`
                                        : l.description || '-'}
                                    </td>
                                    <td style={{ ...styles.tdBold, textAlign: 'right' }}>${amount.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
              </div>
            )}
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
                    <label style={styles.label}>Invoice Number</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        style={{ ...styles.input, flex: 1, ...(isAdmin ? {} : { color: '#94a3b8', cursor: 'not-allowed' }) }}
                        value={currentContractorStartNumber}
                        onChange={(e) => setCurrentContractorStartNumber(Number(e.target.value))}
                        disabled={!isAdmin}
                        readOnly={!isAdmin}
                      />
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateContractorInvoiceCounter(currentContractorStartNumber)}
                            style={styles.iconActionBtn}
                            title="Save Invoice Number"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateContractorInvoiceCounter(100)}
                            style={styles.iconActionBtn}
                            title="Reset Invoice Number to 100"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}
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

                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
                  <label style={styles.label}>Send Invoice via Email</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="email"
                      placeholder={targetInvoiceEmail || 'recipient@example.com'}
                      style={{ ...styles.input, flex: 1 }}
                      value={sendToEmail}
                      onChange={(e) => setSendToEmail(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => handleSendEmail('invoice')}
                      style={{ ...styles.button, background: '#059669', flex: '0 0 auto', padding: '10px 20px' }}
                    >
                      <Send className="w-4 h-4" style={{ marginRight: '8px' }} />
                      Send Email
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                    Leave blank to send to the selected contractor ({targetInvoiceEmail}).
                  </p>
                  {emailStatus && activeTab === 'invoices' && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: '#052e16', border: '1px solid #166534', borderRadius: '8px', fontSize: '12px', color: '#86efac' }}>
                      {emailStatus}
                    </div>
                  )}
                  {emailError && activeTab === 'invoices' && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: '#450a0a', border: '1px solid #991b1b', borderRadius: '8px', fontSize: '12px', color: '#fca5a5' }}>
                      {emailError}
                    </div>
                  )}
                </div>
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

              {/* ENTRIES GROUPED BY SITE LOCATION */}
              {siteNames.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No entries logged for this period.
                </div>
              ) : (
                siteNames.map((locName) => {
                  const group = siteGroups[locName];
                  return (
                    <div key={locName} style={{ marginTop: '20px', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#38bdf8' }}>
                          Location: {locName}
                        </span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {group.totalHours > 0 && `${group.totalHours.toFixed(2)} hrs | `}
                          Subtotal: <strong style={{ color: '#ffffff' }}>${group.subtotal.toFixed(2)}</strong>
                        </span>
                      </div>

                      <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table className="invoice-table" style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Date</th>
                              <th style={styles.th}>Type</th>
                              <th style={styles.th}>Description</th>
                              <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.entries.map((l) => {
                              const amount = l.type === 'MATERIAL' ? Number(l.cost || 0) : Number(l.totalCost || 0);
                              return (
                                <tr key={l.id} style={styles.tr}>
                                  <td style={styles.tdBold}>{l.date}</td>
                                  <td style={styles.td}>{formatEntryType(l.type)}</td>
                                  <td style={styles.td}>
                                    {l.type === 'TIME'
                                      ? `${l.hoursWorked} hrs @ ${l.hourlyRate || selectedContractorInfo.rate}/hr${l.workType ? ' (' + l.workType + ')' : ''}`
                                      : l.description}
                                  </td>
                                  <td style={{ ...styles.tdBold, textAlign: 'right' }}>${amount.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}

              {/* GRAND TOTAL */}
              <div style={styles.invoiceFooter}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>Total Due (All Sites)</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8' }}>
                  ${totalInvoiceAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="no-print" style={styles.sectionGap}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Change Password</h2>
              </div>

              {passwordMessage && (
                <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#052e16', border: '1px solid #166534', borderRadius: '8px', fontSize: '13px', color: '#86efac' }}>
                  {passwordMessage}
                </div>
              )}

              {passwordError && (
                <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#450a0a', border: '1px solid #991b1b', borderRadius: '8px', fontSize: '13px', color: '#fca5a5' }}>
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleChangePassword} style={styles.flexForm}>
                <div>
                  <label style={styles.label}>Current Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    style={styles.input}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div style={styles.formGrid2}>
                  <div>
                    <label style={styles.label}>New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      style={styles.input}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Confirm New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      style={styles.input}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" style={{ ...styles.button, width: '100%', marginTop: '4px' }}>
                  <KeyRound className="w-4 h-4" style={{ marginRight: '8px' }} /> Update Password
                </button>
              </form>
            </section>

            {isAdmin && (
              <section style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>Change Contractor Password</h2>
                </div>

                {adminResetMessage && (
                  <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#052e16', border: '1px solid #166534', borderRadius: '8px', fontSize: '13px', color: '#86efac' }}>
                    {adminResetMessage}
                  </div>
                )}

                {adminResetError && (
                  <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#450a0a', border: '1px solid #991b1b', borderRadius: '8px', fontSize: '13px', color: '#fca5a5' }}>
                    {adminResetError}
                  </div>
                )}

                <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                  Select a contractor to send them a password reset email. They'll receive a link from Firebase to set their own new password.
                </p>

                <form onSubmit={handleAdminResetPassword} style={styles.flexForm}>
                  <div>
                    <label style={styles.label}>Select Contractor</label>
                    <select
                      style={styles.input}
                      value={adminResetEmail}
                      onChange={(e) => setAdminResetEmail(e.target.value)}
                    >
                      <option value="">-- Select Contractor --</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.email}>
                          {u.name || u.email} — {u.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    style={{ ...styles.button, width: '100%', marginTop: '4px', background: '#d97706' }}
                  >
                    <KeyRound className="w-4 h-4" style={{ marginRight: '8px' }} /> Send Reset Email
                  </button>
                </form>
              </section>
            )}


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
    background: '#78350f',
    color: '#fcd34d',
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
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }
};
