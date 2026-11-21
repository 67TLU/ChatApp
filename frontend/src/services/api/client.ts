import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { config } from '@/config/env';
import { useAuthStore } from '@/stores/authStore';

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshQueue: ((token: string) => void)[] = [];

  constructor() {
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Cho phép gửi cookie
    });

    // 1. Request interceptor - tự động gắn access token vào header
    this.client.interceptors.request.use((cfg) => {
      const token = useAuthStore.getState().accessToken;
      if (token && cfg.headers) {
        cfg.headers.Authorization = `Bearer ${token}`;
      }
      return cfg;
    });

    // 2. Response interceptor - xử lý tự động refresh token khi gặp lỗi 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest: any = error.config;

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;

          // Bỏ qua các route /auth/* khỏi logic retry - sẽ xử lý riêng ở logout
          if (originalRequest.url?.includes('/auth/')) {
            // Chỉ logout nếu không phải là refresh endpoint
            if (!originalRequest.url?.includes('/auth/refresh')) {
              return this.handleAuthError(originalRequest);
            }
            // Nếu là refresh endpoint, trả về reject để store logout xử lý
            return Promise.reject(error);
          }

          // Deduplication: chờ refresh token đang chạy khác nếu có
          if (this.isRefreshing) {
            return new Promise((resolve) => {
              this.refreshQueue.push((token: string) => {
                originalRequest.headers!.Authorization = `Bearer ${token}`;
                resolve(this.client(originalRequest));
              });
            });
          }

          try {
            this.isRefreshing = true;
            await useAuthStore.getState().refreshToken();
            const token = useAuthStore.getState().accessToken;
            originalRequest.headers!.Authorization = `Bearer ${token}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            return this.handleAuthError(originalRequest, refreshError);
          } finally {
            this.isRefreshing = false;
            // Gửi token mới cho các request đang chờ trong queue
            while (this.refreshQueue.length > 0) {
              const callback = this.refreshQueue.shift()!;
              // Note: callback sẽ được resolve bởi request gốc, không cần gọi lại ở đây
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async handleAuthError(
    originalRequest: any,
    refreshError?: any
  ) {
    // Đặt lại token và isAuthenticated để logout có thể chạy mà không bị 401
    useAuthStore.getState().logout();
    return Promise.reject(refreshError || error);
  }

  getInstance() {
    return this.client;
  }
}

export const apiClient = new ApiClient().getInstance();
