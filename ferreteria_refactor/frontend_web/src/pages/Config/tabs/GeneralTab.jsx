import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useConfig } from '../../../context/ConfigContext';
import configService from '../../../services/configService';
import { toast } from 'react-hot-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';

const GeneralTab = () => {
    const { business, refreshConfig } = useConfig();

    const [bizForm, setBizForm] = useState({ name: '', document_id: '', address: '', phone: '', email: '', credit_default_down_payment_pct: 20, credit_default_interest_rate: 10 });

    useEffect(() => {
        if (business) {
            setBizForm({
                name: business.name || '',
                document_id: business.document_id || '',
                address: business.address || '',
                phone: business.phone || '',
                email: business.email || '', credit_default_down_payment_pct: business.credit_default_down_payment_pct || 20, credit_default_interest_rate: business.credit_default_interest_rate || 10
            });
        }
    }, [business]);

    const handleBizSave = async () => {
        try {
            await configService.updateBusinessInfo(bizForm);
            toast.success("Datos de negocio actualizados");
            refreshConfig();
        } catch (e) {
            console.error(e);
            toast.error("Error al guardar cambios");
        }
    };

    return (
        <div className="space-y-6">
            {/* Identity Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Identidad del Negocio</CardTitle>
                    <CardDescription>Información visible en tickets y reportes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="bizName">Nombre Comercial</Label>
                        <Input
                            id="bizName"
                            value={bizForm.name}
                            onChange={e => setBizForm({ ...bizForm, name: e.target.value })}
                            placeholder="Ej: Ferretería El Roble"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bizSlogan">Eslogan / Descripción</Label>
                        <Input placeholder="Tu aliado en construcción..." />
                    </div>
                </CardContent>
            </Card>

            {/* Fiscal Data Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Datos Fiscales y Contacto</CardTitle>
                    <CardDescription>Información legal para facturación</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="bizId">RIF / Documento Identidad</Label>
                        <Input
                            id="bizId"
                            value={bizForm.document_id}
                            onChange={e => setBizForm({ ...bizForm, document_id: e.target.value })}
                            placeholder="J-12345678-9"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bizPhone">Teléfono / WhatsApp del negocio</Label>
                        <Input
                            id="bizPhone"
                            value={bizForm.phone}
                            onChange={e => setBizForm({ ...bizForm, phone: e.target.value })}
                            placeholder="584121234567"
                            className="font-mono"
                        />
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            Incluye el código de país <strong>sin el signo +</strong>.
                            Este número se usa para el botón WhatsApp del catálogo público.<br/>
                            🇻🇪 Venezuela: <strong>58</strong> + número · 🇨🇴 Colombia: <strong>57</strong> · 🇲🇽 México: <strong>52</strong>
                        </p>
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                        <Label htmlFor="bizEmail">Correo Electrónico</Label>
                        <Input
                            id="bizEmail"
                            value={bizForm.email}
                            onChange={e => setBizForm({ ...bizForm, email: e.target.value })}
                            placeholder="contacto@empresa.com"
                        />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                        <Label htmlFor="bizAddr">Dirección Fiscal</Label>
                        <Input
                            id="bizAddr"
                            value={bizForm.address}
                            onChange={e => setBizForm({ ...bizForm, address: e.target.value })}
                            placeholder="Av. Principal, Edif. A, Local 1"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Credit Configuration Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Configuración de Créditos (Celulares)</CardTitle>
                    <CardDescription>Valores predeterminados para la calculadora de crédito</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="defaultDownPayment">% Enganche Predeterminado</Label>
                        <div className="relative">
                            <Input
                                id="defaultDownPayment"
                                type="number"
                                value={bizForm.credit_default_down_payment_pct}
                                onChange={e => setBizForm({ ...bizForm, credit_default_down_payment_pct: e.target.value })}
                                placeholder="20"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="defaultInterest">% Interés Predeterminado</Label>
                        <div className="relative">
                            <Input
                                id="defaultInterest"
                                type="number"
                                value={bizForm.credit_default_interest_rate}
                                onChange={e => setBizForm({ ...bizForm, credit_default_interest_rate: e.target.value })}
                                placeholder="10"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
                <Button onClick={handleBizSave} size="lg" className="bg-indigo-600 hover:bg-indigo-700">
                    <Save className="mr-2 h-4 w-4" /> Guardar Cambios
                </Button>
            </div>
        </div>
    );
};

export default GeneralTab;
