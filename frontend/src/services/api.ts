import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.message || 'שגיאה לא ידועה';
    return Promise.reject(new Error(msg));
  }
);

// Shops
export const shopsApi = {
  list: () => api.get('/shops').then(r => r.data),
  get: (id: string) => api.get(`/shops/${id}`).then(r => r.data),
  create: (data: { name: string; proxy_url?: string; proxy_username?: string; proxy_password?: string }) =>
    api.post('/shops', data).then(r => r.data),
  update: (id: string, data: Partial<{ name: string; proxy_url: string; proxy_username: string; proxy_password: string }>) =>
    api.put(`/shops/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/shops/${id}`).then(r => r.data),
  getEtsyInfo: (id: string) => api.get(`/shops/${id}/etsy-info`).then(r => r.data),
  getShippingProfiles: (id: string) => api.get(`/shops/${id}/shipping-profiles`).then(r => r.data),
};

// Auth
export const authApi = {
  getUrl: (shopId: string) => api.get(`/auth/url/${shopId}`).then(r => r.data),
  disconnect: (shopId: string) => api.post(`/auth/disconnect/${shopId}`).then(r => r.data),
};

// Listings
export const listingsApi = {
  list: (shopId: string, status?: string) =>
    api.get(`/listings/shop/${shopId}`, { params: status ? { status } : {} }).then(r => r.data),
  create: (shopId: string, data: any) => api.post(`/listings/shop/${shopId}`, data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/listings/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/listings/${id}`).then(r => r.data),
  publish: (id: string) => api.post(`/listings/${id}/publish`).then(r => r.data),
  sync: (shopId: string) => api.post(`/listings/shop/${shopId}/sync`).then(r => r.data),
  uploadImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post(`/listings/${id}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};

// Research
export const researchApi = {
  keyword: (keyword: string, shopId?: string) =>
    api.post('/research/keyword', { keyword, shop_id: shopId }).then(r => r.data),
  bulkKeywords: (keywords: string[], shopId?: string) =>
    api.post('/research/keywords/bulk', { keywords, shop_id: shopId }).then(r => r.data),
  competitor: (shopName: string, shopId?: string) =>
    api.post('/research/competitor', { shop_name: shopName, shop_id: shopId }).then(r => r.data),
  trends: (keyword: string, shopId?: string) =>
    api.post('/research/trends', { keyword, shop_id: shopId }).then(r => r.data),
  history: (shopId: string) => api.get(`/research/history/${shopId}`).then(r => r.data),
};

// Orders
export const ordersApi = {
  list: (shopId: string) => api.get(`/orders/shop/${shopId}`).then(r => r.data),
};

export default api;
