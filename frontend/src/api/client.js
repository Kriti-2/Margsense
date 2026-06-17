import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const OFFICER_TOKEN_KEY = 'parksense_officer_token';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

function officerHeaders() {
  const token = localStorage.getItem(OFFICER_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  loginOfficer: async (username, password) => {
    const res = await client.post('/auth/login', { username, password });
    localStorage.setItem(OFFICER_TOKEN_KEY, res.data.access_token);
    return res.data;
  },
  logoutOfficer: () => localStorage.removeItem(OFFICER_TOKEN_KEY),
  getHeatmap: (limit = 2000) => client.get('/heatmap', { params: { limit } }),
  getAnalytics: () => client.get('/analytics'),
  getPredictions: () => client.get('/predictions'),
  getSeverityQueue: (limit = 50) =>
    client.get('/severity-queue', { params: { limit }, headers: officerHeaders() }),
  getRecidivism: () => client.get('/recidivism'),
  getCorridors: () => client.get('/corridors'),
  getShiftPlanner: () => client.get('/shift-planner', { headers: officerHeaders() }),
  getHealth: () => client.get('/health'),
  getLiveStatus: () => client.get('/live/status'),
  ingestViolation: (data, apiKey) =>
    client.post('/ingest/violation', data, {
      headers: apiKey ? { 'X-API-Key': apiKey } : officerHeaders(),
    }),
};

export default client;
