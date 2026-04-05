import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('skillstamp_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  getMessage: (walletAddress: string) =>
    api.post('/auth/message', { walletAddress }).then(r => r.data.message),
  loginWithWallet: (walletAddress: string, email?: string) =>
    api.post('/auth/wallet', { walletAddress, email }).then(r => r.data),
  getMe: () => api.get('/auth/me').then(r => r.data),
};

export const usersApi = {
  getMe: () => api.get('/users/me').then(r => r.data),
  updateProfile: (data: any) => api.patch('/users/me/profile', data).then(r => r.data),
  completeOnboarding: (data: any) => api.patch('/users/me/onboarding', data).then(r => r.data),
  getLeaderboard: () => api.get('/users/leaderboard').then(r => r.data),
  getByWallet: (wallet: string) => api.get(`/users/${wallet}`).then(r => r.data),
};

export const challengesApi = {
  getAll: (params?: { trackId?: string; difficulty?: number }) =>
    api.get('/challenges', { params }).then(r => r.data),
  getOne: (id: string) => api.get(`/challenges/${id}`).then(r => r.data),
  start: (challengeId: string) =>
    api.post('/challenges/start', { challengeId }).then(r => r.data),
  submit: (completionId: string, text: string, videoUrl?: string) =>
    api.post(`/challenges/${completionId}/submit`, { text, videoUrl }).then(r => r.data),
  getMyCompletions: () => api.get('/challenges/my/completions').then(r => r.data),
};

export const sbtsApi = {
  getStudentSbts: (wallet: string) => api.get(`/sbts/student/${wallet}`).then(r => r.data),
  getStudentTags: (wallet: string) => api.get(`/sbts/student/${wallet}/tags`).then(r => r.data),
};

export const tasksApi = {
  getFeed: () => api.get('/tasks/feed').then(r => r.data),
  getMyTasks: () => api.get('/tasks/my').then(r => r.data),
  getOne: (id: string) => api.get(`/tasks/${id}`).then(r => r.data),
  create: (data: any) => api.post('/tasks', data).then(r => r.data),
  apply: (id: string) => api.post(`/tasks/${id}/apply`).then(r => r.data),
  submit: (id: string, submissionHash: string) =>
    api.post(`/tasks/${id}/submit`, { submissionHash }).then(r => r.data),
  confirm: (id: string) => api.patch(`/tasks/${id}/confirm`).then(r => r.data),
};

export const recommendationsApi = {
  getChallenges: () => api.get('/recommendations/challenges').then(r => r.data),
  getLearningPath: () => api.get('/recommendations/learning-path').then(r => r.data),
};
