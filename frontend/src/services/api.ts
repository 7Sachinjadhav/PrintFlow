const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('printflow_admin_token');

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If not FormData, add application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return (await response.text()) as unknown as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data.error || 'API Request failed', response.status);
  }

  return data.data !== undefined ? data.data : data;
}

export const api = {
  // Public Customer APIs
  getShop: () => request<any>('/shop'),
  getPricing: () => request<any>('/pricing'),
  calculatePrice: (items: any[]) => request<any>('/pricing/calculate', { method: 'POST', body: JSON.stringify({ items }) }),
  uploadFiles: (formData: FormData) => request<any>('/documents/upload', { method: 'POST', body: formData }),
  createOrder: (payload: any) => request<any>('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  getOrder: (id: string) => request<any>(`/orders/${id}`),
  getOrderStatus: (id: string) => request<any>(`/orders/${id}/status`),
  trackOrder: (tokenOrId: string) => request<any>(`/orders/track/${encodeURIComponent(tokenOrId)}`),
  verifyPayment: (payload: any) => request<any>('/payments/verify', { method: 'POST', body: JSON.stringify(payload) }),
  submitUtrPayment: (payload: { orderId: string; utrNumber: string; upiApp?: string }) =>
    request<any>('/payments/submit-utr', { method: 'POST', body: JSON.stringify(payload) }),
  simulateTestPayment: (payload: any) => request<any>('/payments/simulate-test', { method: 'POST', body: JSON.stringify(payload) }),
  testSmsWebhook: (payload: { text: string; secret?: string }) =>
    request<any>('/payments/webhook/sms/test', { method: 'POST', body: JSON.stringify(payload) }),
  createCashfreeSession: (orderId: string) =>
    request<any>('/payments/cashfree/create-session', { method: 'POST', body: JSON.stringify({ orderId }) }),
  verifyCashfreePayment: (orderId: string) =>
    request<any>(`/payments/cashfree/verify/${orderId}`),

  // Admin Auth
  adminLogin: (credentials: any) => request<any>('/admin/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getAdminMe: () => request<any>('/admin/me'),
  adminLogout: () => request<any>('/admin/logout', { method: 'POST' }),

  // Admin Dashboard & Queue
  getDashboardSummary: () => request<any>('/admin/reports/summary'),
  getAdminQueue: () => request<any>('/admin/queue'),
  getPendingApprovals: () => request<any>('/admin/orders/pending-approvals'),
  approveOrderPayment: (orderId: string) => request<any>(`/admin/orders/${orderId}/approve`, { method: 'POST' }),
  rejectOrderPayment: (orderId: string) => request<any>(`/admin/orders/${orderId}/reject`, { method: 'POST' }),
  getAllOrders: (params: { page?: number; limit?: number; status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.status) q.append('status', params.status);
    if (params.search) q.append('search', params.search);
    return request<any>(`/admin/orders?${q.toString()}`);
  },
  retryJob: (jobId: string) => request<any>(`/admin/queue/${jobId}/retry`, { method: 'POST' }),
  updateOrderStatus: (orderId: string, status: string) => request<any>(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  exportOrdersCsv: () => request<string>('/admin/reports/export'),

  // Admin Printers
  getPrinters: () => request<any>('/admin/printers'),
  createPrinter: (printer: any) => request<any>('/admin/printers', { method: 'POST', body: JSON.stringify(printer) }),
  updatePrinter: (id: string, printer: any) => request<any>(`/admin/printers/${id}`, { method: 'PATCH', body: JSON.stringify(printer) }),
  testPrint: (id: string) => request<any>(`/admin/printers/${id}/test`, { method: 'POST' }),

  // Admin Pricing
  getAdminPricing: () => request<any>('/admin/pricing'),
  updatePricingRule: (id: string, rule: any) => request<any>(`/admin/pricing/rules/${id}`, { method: 'PATCH', body: JSON.stringify(rule) }),
  updateService: (id: string, svc: any) => request<any>(`/admin/pricing/services/${id}`, { method: 'PATCH', body: JSON.stringify(svc) }),

  // Admin Settings
  updateShopSettings: (settings: any) => request<any>('/admin/shop', { method: 'PATCH', body: JSON.stringify(settings) }),
};
