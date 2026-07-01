import React, { useMemo, useState } from 'react';
import { useCloudConfig } from '../../context/CloudConfigContext';
import toast from 'react-hot-toast';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Cloud,
    MonitorCog,
    RefreshCw,
    Server,
    ShieldCheck,
    Store,
    Wifi,
} from 'lucide-react';
import './InitialSetupWizard.css';

const CLOUD_ROOTS = [
    { value: 'miinventariofacil.com', label: 'Produccion', example: 'tenant.miinventariofacil.com' },
    { value: 'qa.miinventariofacil.com', label: 'QA / pruebas', example: 'tenant.qa.miinventariofacil.com' },
];

const CLOUD_ROOT_VALUES = CLOUD_ROOTS.map(root => root.value);

const INSTALL_MODES = [
    {
        id: 'store_server',
        title: 'Servidor local de tienda',
        description: 'Recomendado para tiendas con varias cajas. Este equipo guarda la base local y sincroniza con la nube.',
        icon: Server,
    },
    {
        id: 'client_terminal',
        title: 'Caja cliente en red local',
        description: 'Usa otra PC como servidor local. Ideal para caja 2, caja 3 o equipos secundarios.',
        icon: MonitorCog,
    },
    {
        id: 'standalone',
        title: 'Equipo unico',
        description: 'Una sola computadora vende, imprime y sincroniza. Sencillo para negocios pequenos.',
        icon: Store,
    },
];

const normalizeTenant = (value = '') => value.trim().toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');

const parseTenantInput = (value = '') => {
    const raw = value.trim().toLowerCase();
    if (!raw) return { tenant: '', cloudRoot: null };

    if (raw.includes('.') || raw.includes('/') || raw.includes('://')) {
        try {
            const url = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
            const host = url.hostname.replace(/^www\./, '');
            const cloudRoot = CLOUD_ROOT_VALUES.find(root => host === root || host.endsWith(`.${root}`));
            if (cloudRoot) {
                const tenantPart = host === cloudRoot ? '' : host.slice(0, -(cloudRoot.length + 1));
                const tenant = tenantPart.split('.').filter(Boolean)[0] || '';
                return { tenant: normalizeTenant(tenant), cloudRoot };
            }
        } catch (error) {
            // Si no es una URL valida, se trata como subdominio normal.
        }
    }

    return { tenant: normalizeTenant(raw), cloudRoot: null };
};

const InitialSetupWizard = ({ onComplete }) => {
    const { saveConfig, testConnection } = useCloudConfig();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        installMode: 'store_server',
        localServerName: 'Servidor principal',
        tenantSubdomain: '',
        cloudRoot: CLOUD_ROOTS[0].value,
        useCustomUrl: false,
        customUrl: '',
        cloudUrl: '',
        syncEnabled: true,
        syncIntervalMinutes: 10,
        safeStockMode: true,
    });
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const computedCloudUrl = useMemo(() => {
        if (formData.useCustomUrl) return formData.customUrl.trim();
        const tenant = normalizeTenant(formData.tenantSubdomain);
        if (!tenant) return '';
        return `https://${tenant}.${formData.cloudRoot}`;
    }, [formData.cloudRoot, formData.customUrl, formData.tenantSubdomain, formData.useCustomUrl]);

    const canContinueConnection = testResult?.success && computedCloudUrl;

    const updateField = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        setTestResult(null);
    };

    const handleInputChange = (event) => {
        const { name, value, type, checked } = event.target;
        updateField(name, type === 'checkbox' ? checked : value);
    };

    const handleTenantChange = (event) => {
        const parsed = parseTenantInput(event.target.value);
        setFormData(prev => ({
            ...prev,
            tenantSubdomain: parsed.tenant,
            cloudRoot: parsed.cloudRoot || prev.cloudRoot,
        }));
        setTestResult(null);
    };

    const handleTestConnection = async () => {
        const tenant = normalizeTenant(formData.tenantSubdomain);
        const url = computedCloudUrl;

        if (!url) {
            setTestResult({ success: false, error: 'Indica el subdominio del tenant o una URL personalizada.' });
            return;
        }

        setTesting(true);
        setTestResult(null);
        const result = await testConnection(url, tenant);
        setTestResult(result);
        if (result.success && result.cleanedUrl) {
            setFormData(prev => ({ ...prev, cloudUrl: result.cleanedUrl }));
        }
        setTesting(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const result = await saveConfig({
            ...formData,
            tenantSubdomain: normalizeTenant(formData.tenantSubdomain),
            cloudUrl: testResult?.cleanedUrl || computedCloudUrl,
        });
        setSaving(false);

        if (result.success) {
            toast.success('Equipo configurado para modo local');
            onComplete?.();
        } else {
            toast.error('Error al guardar configuracion: ' + result.error);
        }
    };

    const handleLocalOnly = async () => {
        setSaving(true);
        const result = await saveConfig({
            ...formData,
            cloudUrl: 'http://localhost:8000',
            syncEnabled: false,
            installMode: 'standalone',
        });
        setSaving(false);
        if (result.success) onComplete?.();
    };

    const steps = [
        { number: 1, label: 'Equipo' },
        { number: 2, label: 'Tenant' },
        { number: 3, label: 'Sync' },
    ];

    return (
        <div className="miw-overlay">
            <section className="miw-shell" aria-label="Asistente de configuracion offline">
                <aside className="miw-rail">
                    <div className="miw-brand">
                        <div className="miw-brandIcon"><Cloud size={24} /></div>
                        <div>
                            <span>Mi Inventario</span>
                            <strong>Modo local</strong>
                        </div>
                    </div>

                    <div className="miw-progress">
                        {steps.map(item => (
                            <button
                                key={item.number}
                                type="button"
                                className={`miw-stepPill ${step === item.number ? 'active' : ''} ${step > item.number ? 'done' : ''}`}
                                onClick={() => item.number < step && setStep(item.number)}
                            >
                                <span>{step > item.number ? <CheckCircle2 size={16} /> : item.number}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="miw-note">
                        <ShieldCheck size={18} />
                        <p>La nube sigue siendo la fuente principal. Este equipo solo trabaja offline con datos sincronizados.</p>
                    </div>
                </aside>

                <main className="miw-main">
                    <header className="miw-header">
                        <div>
                            <p>Configuracion para tecnicos</p>
                            <h1>Conectar tienda local con su tenant</h1>
                        </div>
                        <button type="button" className="miw-linkBtn" onClick={handleLocalOnly} disabled={saving}>
                            Modo local sin nube
                        </button>
                    </header>

                    {step === 1 && (
                        <div className="miw-panel">
                            <div className="miw-sectionTitle">
                                <h2>Tipo de instalacion</h2>
                                <p>Define el rol de esta computadora dentro de la tienda.</p>
                            </div>

                            <div className="miw-modeGrid">
                                {INSTALL_MODES.map(mode => {
                                    const Icon = mode.icon;
                                    return (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            className={`miw-modeCard ${formData.installMode === mode.id ? 'selected' : ''}`}
                                            onClick={() => updateField('installMode', mode.id)}
                                        >
                                            <span><Icon size={22} /></span>
                                            <strong>{mode.title}</strong>
                                            <small>{mode.description}</small>
                                        </button>
                                    );
                                })}
                            </div>

                            <label className="miw-field">
                                <span>Nombre interno del equipo</span>
                                <input
                                    name="localServerName"
                                    value={formData.localServerName}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Servidor tienda principal"
                                />
                            </label>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="miw-panel">
                            <div className="miw-sectionTitle">
                                <h2>Tenant y subdominio</h2>
                                <p>El tecnico solo coloca el subdominio. El asistente arma la URL y valida que exista.</p>
                            </div>

                            <div className="miw-twoCols">
                                <label className="miw-field">
                                    <span>Subdominio del tenant</span>
                                    <input
                                        name="tenantSubdomain"
                                        value={formData.tenantSubdomain}
                                        onChange={handleTenantChange}
                                        placeholder="restaurante3 o URL completa"
                                    />
                                    <small>Puedes escribir solo el tenant o pegar https://restaurante3.qa.miinventariofacil.com/#/login.</small>
                                </label>

                                <label className="miw-field">
                                    <span>Ambiente</span>
                                    <select name="cloudRoot" value={formData.cloudRoot} onChange={handleInputChange} disabled={formData.useCustomUrl}>
                                        {CLOUD_ROOTS.map(root => (
                                            <option key={root.value} value={root.value}>{root.label} - {root.value}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <label className="miw-toggleRow">
                                <input
                                    type="checkbox"
                                    name="useCustomUrl"
                                    checked={formData.useCustomUrl}
                                    onChange={handleInputChange}
                                />
                                <span>Usar URL personalizada</span>
                            </label>

                            {formData.useCustomUrl && (
                                <label className="miw-field">
                                    <span>URL completa</span>
                                    <input
                                        name="customUrl"
                                        value={formData.customUrl}
                                        onChange={handleInputChange}
                                        placeholder="https://tenant.miinventariofacil.com"
                                    />
                                    <small>Solo usala si el cliente tiene un dominio distinto al patron normal.</small>
                                </label>
                            )}

                            <div className="miw-urlPreview">
                                <Wifi size={18} />
                                <div>
                                    <span>URL a validar</span>
                                    <strong>{computedCloudUrl || 'Pendiente por subdominio'}</strong>
                                </div>
                            </div>

                            <button type="button" className="miw-testBtn" onClick={handleTestConnection} disabled={testing || !computedCloudUrl}>
                                {testing ? <RefreshCw size={18} className="miw-spin" /> : <Wifi size={18} />}
                                {testing ? 'Probando conexion...' : 'Probar conexion y tenant'}
                            </button>

                            {testResult && (
                                <div className={`miw-result ${testResult.success ? 'success' : 'error'}`}>
                                    {testResult.success ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                                    <div>
                                        <strong>{testResult.success ? 'Conexion validada' : 'No se pudo validar'}</strong>
                                        <p>
                                            {testResult.success
                                                ? `Tenant: ${testResult.tenantName || testResult.tenantSubdomain || 'validado'}`
                                                : testResult.error}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="miw-panel">
                            <div className="miw-sectionTitle">
                                <h2>Reglas de sincronizacion</h2>
                                <p>Estas opciones controlan como se comporta la tienda cuando no hay internet.</p>
                            </div>

                            <label className="miw-toggleCard">
                                <input
                                    type="checkbox"
                                    name="syncEnabled"
                                    checked={formData.syncEnabled}
                                    onChange={handleInputChange}
                                />
                                <span>
                                    <strong>Sincronizacion automatica</strong>
                                    <small>El equipo intenta enviar ventas y descargar cambios cuando vuelve internet.</small>
                                </span>
                            </label>

                            {formData.syncEnabled && (
                                <label className="miw-field compact">
                                    <span>Intervalo de sincronizacion</span>
                                    <select name="syncIntervalMinutes" value={formData.syncIntervalMinutes} onChange={handleInputChange}>
                                        <option value="5">Cada 5 minutos</option>
                                        <option value="10">Cada 10 minutos</option>
                                        <option value="15">Cada 15 minutos</option>
                                        <option value="30">Cada 30 minutos</option>
                                        <option value="60">Cada hora</option>
                                    </select>
                                </label>
                            )}

                            <label className="miw-toggleCard">
                                <input
                                    type="checkbox"
                                    name="safeStockMode"
                                    checked={formData.safeStockMode}
                                    onChange={handleInputChange}
                                />
                                <span>
                                    <strong>Modo seguro de stock e IMEI</strong>
                                    <small>Solo permite vender existencias descargadas/asignadas al equipo local.</small>
                                </span>
                            </label>

                            <div className="miw-summary">
                                <h3>Resumen</h3>
                                <dl>
                                    <div><dt>Equipo</dt><dd>{INSTALL_MODES.find(m => m.id === formData.installMode)?.title}</dd></div>
                                    <div><dt>Tenant</dt><dd>{normalizeTenant(formData.tenantSubdomain) || 'Sin definir'}</dd></div>
                                    <div><dt>Nube</dt><dd>{testResult?.cleanedUrl || computedCloudUrl}</dd></div>
                                    <div><dt>Sync</dt><dd>{formData.syncEnabled ? `Cada ${formData.syncIntervalMinutes} min` : 'Manual / desactivada'}</dd></div>
                                </dl>
                            </div>
                        </div>
                    )}

                    <footer className="miw-actions">
                        <button type="button" className="miw-secondary" onClick={() => setStep(step - 1)} disabled={step === 1 || saving}>
                            <ArrowLeft size={18} />
                            Atras
                        </button>

                        {step < 3 ? (
                            <button
                                type="button"
                                className="miw-primary"
                                onClick={() => setStep(step + 1)}
                                disabled={step === 2 && !canContinueConnection}
                            >
                                Siguiente
                                <ArrowRight size={18} />
                            </button>
                        ) : (
                            <button type="button" className="miw-primary" onClick={handleSave} disabled={saving || !computedCloudUrl}>
                                {saving ? <RefreshCw size={18} className="miw-spin" /> : <CheckCircle2 size={18} />}
                                {saving ? 'Guardando...' : 'Guardar configuracion'}
                            </button>
                        )}
                    </footer>
                </main>
            </section>
        </div>
    );
};

export default InitialSetupWizard;
