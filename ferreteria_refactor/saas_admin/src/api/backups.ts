
import api from './axios';

export interface BackupFile {
    filename: string;
    size_bytes: number;
    size_mb: number;
    created_at: string;
}

export const backupsApi = {
    list: async (): Promise<BackupFile[]> => {
        const response = await api.get('/admin/backups');
        return response.data;
    },

    create: async (): Promise<BackupFile> => {
        const response = await api.post('/admin/backups');
        return response.data;
    },

    delete: async (filename: string): Promise<void> => {
        await api.delete(`/admin/backups/${filename}`);
    },

    downloadBlob: async (filename: string): Promise<Blob> => {
        const response = await api.get(`/admin/backups/${filename}`, {
            responseType: 'blob'
        });
        return response.data;
    }
};
