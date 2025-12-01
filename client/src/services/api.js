import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const register = async (username, password, publicSigningKey, publicKeyExchangeKey) => {
  const response = await api.post('/auth/register', {
    username,
    password,
    publicSigningKey,
    publicKeyExchangeKey
  });
  return response.data;
};

export const login = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data;
};

export const getUsers = async () => {
  const response = await api.get('/auth/users');
  return response.data;
};

export const getUser = async (userId) => {
  const response = await api.get(`/auth/user/${userId}`);
  return response.data;
};

// Message APIs
export const sendMessage = async (recipientId, ciphertext, iv, nonce) => {
  const response = await api.post('/messages', {
    recipientId,
    ciphertext,
    iv,
    nonce
  });
  return response.data;
};

export const getMessages = async (recipientId, limit = 50, before = null) => {
  const params = { limit };
  if (before) params.before = before;
  
  const response = await api.get(`/messages/${recipientId}`, { params });
  return response.data;
};

// File APIs
export const uploadFile = async (recipientId, encryptedFile, iv, metadata) => {
  const formData = new FormData();
  formData.append('file', new Blob([encryptedFile]), 'encrypted');
  formData.append('iv', iv);
  formData.append('metadata', JSON.stringify(metadata));
  formData.append('recipientId', recipientId);
  
  const response = await api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const getFileInfo = async (fileId) => {
  const response = await api.get(`/files/${fileId}/info`);
  return response.data;
};

export const downloadFile = async (fileId) => {
  const response = await api.get(`/files/${fileId}/download`, {
    responseType: 'arraybuffer'
  });
  return response.data;
};

export const getFiles = async () => {
  const response = await api.get('/files');
  return response.data;
};

export default api;
