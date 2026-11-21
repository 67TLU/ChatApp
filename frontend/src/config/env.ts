export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  socketUrl: import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000',
  frontendUrl: import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173',
};