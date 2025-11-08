const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { readData, writeData } = require('./storage');

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

function calculateAge(dobString) {
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function sanitizeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function publicConsentLog(log) {
  const { token, ...rest } = log;
  return rest;
}

app.post('/auth/signup', async (req, res) => {
  const {
    name,
    email,
    password,
    dob,
    parent_email: parentEmailRaw,
    parent_phone: parentPhoneRaw,
  } = req.body || {};

  if (!name || !email || !password || !dob) {
    return res
      .status(400)
      .json({ error: 'Missing required fields: name, email, password, dob' });
  }

  const normalizedEmail = normalizeEmail(email);
  const parentEmail = parentEmailRaw ? normalizeEmail(parentEmailRaw) : null;
  const parentPhone = parentPhoneRaw ? String(parentPhoneRaw).trim() : null;

  const age = calculateAge(dob);
  if (age === null) {
    return res.status(400).json({ error: 'Invalid date of birth' });
  }

  const isMinor = age < 18;
  if (isMinor && !parentEmail && !parentPhone) {
    return res.status(400).json({
      error: 'Parent or guardian contact is required for minors',
    });
  }

  const state = readData();
  const existingUser = state.users.find(
    (storedUser) => normalizeEmail(storedUser.email) === normalizedEmail,
  );

  if (existingUser) {
    return res.status(409).json({ error: 'Account already exists for this email' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const userId = uuid();

  const newUser = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    dob: new Date(dob).toISOString().split('T')[0],
    age,
    parentEmail,
    parentPhone,
    createdAt: now,
    pendingConsent: isMinor,
    consentedAt: isMinor ? null : now,
    consentApprover: isMinor ? null : name.trim(),
    consentChannel: isMinor ? null : 'self',
    passwordHash,
  };

  let consentToken = null;
  const consentLog = {
    id: uuid(),
    userId,
    status: isMinor ? 'pending' : 'approved',
    channel: isMinor ? (parentEmail ? 'email' : 'sms') : 'self',
    contact: isMinor ? parentEmail || parentPhone : normalizedEmail,
    createdAt: now,
    approvedAt: isMinor ? null : now,
    approverName: isMinor ? null : name.trim(),
    token: null,
  };

  if (isMinor) {
    consentToken = uuid();
    consentLog.token = consentToken;
  }

  state.users.push(newUser);
  state.consentLogs.push(consentLog);
  writeData(state);

  return res.status(201).json({
    user: sanitizeUser(newUser),
    consentRequired: isMinor,
    consentToken: consentToken || undefined,
    consentLog: publicConsentLog(consentLog),
  });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const normalizedEmail = normalizeEmail(email);
  const state = readData();
  const user = state.users.find(
    (storedUser) => normalizeEmail(storedUser.email) === normalizedEmail,
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.pendingConsent) {
    return res.status(403).json({
      error: 'Parental consent is still pending',
      pendingConsent: true,
      user: sanitizeUser(user),
    });
  }

  return res.json({
    user: sanitizeUser(user),
  });
});

app.post('/auth/consent', (req, res) => {
  const { token, approver_name: approverNameRaw } = req.body || {};
  const approverName = approverNameRaw ? String(approverNameRaw).trim() : null;

  if (!token) {
    return res.status(400).json({ error: 'Missing consent token' });
  }

  const state = readData();
  const consentLog = state.consentLogs.find((log) => log.token === token);

  if (!consentLog) {
    return res.status(404).json({ error: 'Consent request not found' });
  }

  if (consentLog.status === 'approved') {
    return res.status(409).json({ error: 'Consent already approved' });
  }

  const user = state.users.find((storedUser) => storedUser.id === consentLog.userId);
  if (!user) {
    return res
      .status(404)
      .json({ error: 'Child account not found for consent request' });
  }

  const now = new Date().toISOString();
  user.pendingConsent = false;
  user.consentedAt = now;
  user.consentApprover = approverName;
  user.consentChannel = consentLog.channel;

  consentLog.status = 'approved';
  consentLog.approvedAt = now;
  consentLog.approverName = approverName;
  consentLog.token = null;

  writeData(state);

  return res.json({
    user: sanitizeUser(user),
    consentLog: publicConsentLog(consentLog),
  });
});

app.get('/auth/consent/logs', (_req, res) => {
  const state = readData();
  return res.json({
    logs: state.consentLogs.map(publicConsentLog),
    count: state.consentLogs.length,
  });
});

app.listen(PORT, () => {
  console.log(`Auth service listening on port ${PORT}`);
});

