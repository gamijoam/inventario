import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../api/axios';
import type { User, LoginCredentials, AuthResponse } from '../types/auth'; // Type-only import
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const navigate = useNavigate();

    useEffect(() => {
        const initializeAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await api.get<User>('/users/me');
                    setUser(response.data);
                    setIsAuthenticated(true);
                } catch (error) {
                    console.error('Session expired or invalid token', error);
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                    setIsAuthenticated(false);
                }
            }
            setIsLoading(false);
        };

        initializeAuth();
    }, []);

    const login = async (credentials: LoginCredentials) => {
        setIsLoading(true);
        try {
            // FastAPI OAuth2PasswordRequestForm requires:
            // 1. 'username' (even if it's an email)
            // 2. 'password'
            // 3. Format: application/x-www-form-urlencoded
            const params = new URLSearchParams();
            params.append('username', credentials.username);
            params.append('password', credentials.password);

            // Super admin login REQUIRES X-Tenant-ID: public
            // Without it the backend uses tenant context and rejects superadmins
            const response = await api.post<AuthResponse>('/auth/token', params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Tenant-ID': 'public',
                },
            });

            const { access_token } = response.data;
            localStorage.setItem('token', access_token);

            const userResponse = await api.get<User>('/users/me');
            setUser(userResponse.data);
            setIsAuthenticated(true);

            navigate('/dashboard');
        } catch (error) {
            console.error('Login failed', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setIsAuthenticated(false);
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
