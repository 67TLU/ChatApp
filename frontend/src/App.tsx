import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from '@/stores/authStore';
import React, { useEffect } from 'react';
import { socketService } from '@/services/socket/socket';
import ProfilePage from '@/pages/profile/ProfilePage';
// Import pages (sẽ tạo sau)
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import ChatLayout from '@/pages/chat/ChatLayout';
import { IncomingCallModal } from '@/components/call/IncomingCallModal';
import { CallRoom } from '@/components/call/CallRoom';
import { useCallSocket } from '@/hooks/useCallSocket';
import FriendsPage from './pages/friends/FriendsPage';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
useCallSocket();
  useEffect(() => {
    if (isAuthenticated) {
      socketService.connect();
    } else {
      socketService.disconnect();
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated]);

  // Reconnect socket when access token is refreshed
  useEffect(() => {
    if (accessToken && isAuthenticated) {
      socketService.connect();
    }
  }, [accessToken, isAuthenticated]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <ChatLayout />
              </ProtectedRoute>
            }
          />
          <Route path="/friends-requests" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
          <Route path="/conversations/:id" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      <IncomingCallModal />
      <CallRoom />
       <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

export default App;