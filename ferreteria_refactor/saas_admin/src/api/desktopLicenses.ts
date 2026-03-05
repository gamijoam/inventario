import api from './axios';

export interface DesktopLicense {
    id: number;
    license_key: string;
    plan_name: string;
    customer_name: string | null;
    customer_email: string | null;
    has_restaurant_module: boolean;
    has_laundry_module: boolean;
    has_hardware_module: boolean;
    has_services_module: boolean;
    has_barbershop_module: boolean;
    max_devices: number;
    activations_count: number;
    expires_at: string | null;   // ISO 8601 o null (perpetua)
    is_active: boolean;
    notes: string | null;
    created_at: string | null;
}

export interface CreateLicenseDTO {
    customer_name: string;
    customer_email?: string;
    plan_name: string;
    has_restaurant_module: boolean;
    has_laundry_module: boolean;
    has_hardware_module: boolean;
    has_services_module: boolean;
    has_barbershop_module: boolean;
    max_devices: number;
    expires_at?: string | null;
    notes?: string;
}

export interface UpdateLicenseDTO {
    customer_name?: string;
    customer_email?: string;
    plan_name?: string;
    has_restaurant_module?: boolean;
    has_laundry_module?: boolean;
    has_hardware_module?: boolean;
    has_services_module?: boolean;
    has_barbershop_module?: boolean;
    max_devices?: number;
    expires_at?: string | null;
    is_active?: boolean;
    notes?: string;
}

export const getLicenses = async (): Promise<DesktopLicense[]> => {
    const res = await api.get<DesktopLicense[]>('/desktop/licenses');
    return res.data;
};

export const createLicense = async (data: CreateLicenseDTO): Promise<DesktopLicense> => {
    const res = await api.post<DesktopLicense>('/desktop/licenses', data);
    return res.data;
};

export const updateLicense = async (id: number, data: UpdateLicenseDTO): Promise<DesktopLicense> => {
    const res = await api.put<DesktopLicense>(`/desktop/licenses/${id}`, data);
    return res.data;
};

export const deactivateLicense = async (id: number): Promise<void> => {
    await api.delete(`/desktop/licenses/${id}`);
};
