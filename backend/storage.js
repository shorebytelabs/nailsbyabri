const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'db.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ users: [], consentLogs: [] }, null, 2),
      'utf8',
    );
  }
}

function readData() {
  ensureDataFile();
  const fileContents = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(fileContents);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      consentLogs: Array.isArray(parsed.consentLogs) ? parsed.consentLogs : [],
    };
  } catch (error) {
    console.error('Failed to parse data file, resetting state.', error);
    return { users: [], consentLogs: [] };
  }
}

function writeData(nextState) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(nextState, null, 2), 'utf8');
}

module.exports = {
  readData,
  writeData,
};

