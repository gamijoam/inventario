import apiClient from '../config/axios';

export const getLots = (params) => apiClient.get('/pharmacy/lots', { params });
export const createLot = (data) => apiClient.post('/pharmacy/lots', data);
export const updateLot = (id, data) => apiClient.put(`/pharmacy/lots/${id}`, data);
export const getAlerts = () => apiClient.get('/pharmacy/alerts');
export const createPrescription = (data) => apiClient.post('/pharmacy/prescriptions', data);
export const getPrescriptions = (params) => apiClient.get('/pharmacy/prescriptions', { params });
export const getControlLog = (params) => apiClient.get('/pharmacy/control-log', { params });
