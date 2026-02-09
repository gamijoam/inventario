export interface User {
    id: number;
    username: string;
    email: string | null;
    full_name: string | null;
    role: string;
    is_active: boolean;
    is_superuser: boolean;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
}

export interface LoginCredentials {
    username: string;
    password: string;
}
