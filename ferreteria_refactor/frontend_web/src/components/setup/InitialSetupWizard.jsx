import React, { useState } from 'react';
import { useCloudConfig } from '../../context/CloudConfigContext';
import './InitialSetupWizard.css';

const InitialSetupWizard = ({ onComplete }) => {
    const { saveConfig, testConnection } = useCloudConfig();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        cloudUrl: '',
        syncEnabled: true,
        syncIntervalMinutes: 10
    });
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        setTestResult(null); // Reset test result when URL changes
    };

    const handleTestConnection = async () => {
        if (!formData.cloudUrl.trim()) {
            setTestResult({ success: false, error: 'Por favor ingresa una URL' });
            return;
        }

        setTesting(true);
        setTestResult(null);

        const result = await testConnection(formData.cloudUrl);
        setTestResult(result);
        setTesting(false);
    };

    const handleSave = async () => {
        const result = await saveConfig(formData);
        if (result.success) {
            onComplete();
        } else {
            alert('Error al guardar configuración: ' + result.error);
        }
    };

    const handleSkip = () => {
        // Guardar con configuración por defecto (localhost)
        saveConfig({
            cloudUrl: 'http://localhost:8000',
            syncEnabled: false,
            syncIntervalMinutes: 10
        });
        onComplete();
    };

    return (
        <div className="setup-wizard-overlay">
            <div className="setup-wizard-container">
                <div className="setup-wizard-header">
                    <h1>🚀 Configuración Inicial</h1>
                    <p>Configura la conexión con el servidor en la nube</p>
                </div>

                <div className="setup-wizard-content">
                    {step === 1 && (
                        <div className="setup-step">
                            <h2>Paso 1: URL del Servidor</h2>
                            <p className="step-description">
                                Ingresa la URL del servidor en la nube proporcionada por tu proveedor.
                            </p>

                            <div className="form-group">
                                <label htmlFor="cloudUrl">URL del Servidor *</label>
                                <input
                                    type="text"
                                    id="cloudUrl"
                                    name="cloudUrl"
                                    value={formData.cloudUrl}
                                    onChange={handleInputChange}
                                    placeholder="https://tu-servidor.com"
                                    className="form-input"
                                />
                                <small className="form-hint">
                                    Ejemplo: https://ferreteria.miempresa.com o http://192.168.1.100:8000
                                </small>
                            </div>

                            <button
                                onClick={handleTestConnection}
                                disabled={testing || !formData.cloudUrl.trim()}
                                className="btn btn-secondary"
                            >
                                {testing ? '🔄 Probando...' : '🔌 Probar Conexión'}
                            </button>

                            {testResult && (
                                <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                                    {testResult.success ? (
                                        <>
                                            <span className="icon">✅</span>
                                            <span>Conexión exitosa</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="icon">❌</span>
                                            <span>{testResult.error}</span>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="wizard-actions">
                                <button onClick={handleSkip} className="btn btn-ghost">
                                    Omitir (Modo Local)
                                </button>
                                <button
                                    onClick={() => setStep(2)}
                                    disabled={!testResult?.success}
                                    className="btn btn-primary"
                                >
                                    Siguiente →
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="setup-step">
                            <h2>Paso 2: Configuración de Sincronización</h2>
                            <p className="step-description">
                                Personaliza cómo y cuándo se sincronizarán los datos.
                            </p>

                            <div className="form-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="syncEnabled"
                                        checked={formData.syncEnabled}
                                        onChange={handleInputChange}
                                    />
                                    <span>Habilitar sincronización automática</span>
                                </label>
                            </div>

                            {formData.syncEnabled && (
                                <div className="form-group">
                                    <label htmlFor="syncIntervalMinutes">Intervalo de sincronización</label>
                                    <select
                                        id="syncIntervalMinutes"
                                        name="syncIntervalMinutes"
                                        value={formData.syncIntervalMinutes}
                                        onChange={handleInputChange}
                                        className="form-select"
                                    >
                                        <option value="5">Cada 5 minutos</option>
                                        <option value="10">Cada 10 minutos</option>
                                        <option value="15">Cada 15 minutos</option>
                                        <option value="30">Cada 30 minutos</option>
                                        <option value="60">Cada hora</option>
                                    </select>
                                </div>
                            )}

                            <div className="config-summary">
                                <h3>Resumen de Configuración:</h3>
                                <ul>
                                    <li><strong>Servidor:</strong> {formData.cloudUrl}</li>
                                    <li><strong>Sincronización:</strong> {formData.syncEnabled ? 'Habilitada' : 'Deshabilitada'}</li>
                                    {formData.syncEnabled && (
                                        <li><strong>Intervalo:</strong> Cada {formData.syncIntervalMinutes} minutos</li>
                                    )}
                                </ul>
                            </div>

                            <div className="wizard-actions">
                                <button onClick={() => setStep(1)} className="btn btn-ghost">
                                    ← Atrás
                                </button>
                                <button onClick={handleSave} className="btn btn-primary">
                                    ✅ Guardar y Continuar
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="setup-wizard-footer">
                    <small>💡 Puedes cambiar esta configuración más tarde desde Ajustes</small>
                </div>
            </div>
        </div>
    );
};

export default InitialSetupWizard;
