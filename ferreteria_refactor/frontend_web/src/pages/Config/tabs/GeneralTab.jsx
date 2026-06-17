import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import BusinessLogoUploader from './BusinessLogoUploader';
import { useConfig } from '../../../context/ConfigContext';
import configService from '../../../services/configService';
import { toast } from 'react-hot-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';

const GeneralTab = () => {
    const { business, refreshConfig, modules } = useConfig();

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
        <div className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
                <Card className="rounded-lg border-slate-200 shadow-sm">
                    <CardHeader className="p-5 pb-3">
                        <CardTitle className="text-xl font-black tracking-normal text-slate-900">Identidad del Negocio</CardTitle>
                        <CardDescription>Información visible en tickets, reportes y documentos</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 pt-0">
                        <div className="grid gap-2">
                            <Label htmlFor="bizName" className="text-sm font-bold text-slate-700">Nombre Comercial</Label>
                            <Input
                                id="bizName"
                                value={bizForm.name}
                                onChange={e => setBizForm({ ...bizForm, name: e.target.value })}
                                placeholder="Ej: Ferretería El Roble"
                                className="h-11 rounded-md"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bizSlogan" className="text-sm font-bold text-slate-700">Eslogan / Descripción</Label>
                            <Input placeholder="Tu aliado en construcción..." className="h-11 rounded-md" />
                        </div>
                    </CardContent>
                </Card>

                <BusinessLogoUploader />
            </div>

            <Card className="rounded-lg border-slate-200 shadow-sm">
                <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-xl font-black tracking-normal text-slate-900">Datos Fiscales y Contacto</CardTitle>
                    <CardDescription>Información legal para facturación y comunicación comercial</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 p-5 pt-0 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="bizId" className="text-sm font-bold text-slate-700">RIF / Documento Identidad</Label>
                        <Input
                            id="bizId"
                            value={bizForm.document_id}
                            onChange={e => setBizForm({ ...bizForm, document_id: e.target.value })}
                            placeholder="J-12345678-9"
                            className="h-11 rounded-md"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bizPhone" className="text-sm font-bold text-slate-700">Teléfono / WhatsApp del negocio</Label>
                        <Input
                            id="bizPhone"
                            value={bizForm.phone}
                            onChange={e => setBizForm({ ...bizForm, phone: e.target.value })}
                            placeholder="584121234567"
                            className="h-11 rounded-md font-mono"
                        />
                        <p className="text-[11px] leading-relaxed text-slate-400">
                            Incluye el código de país sin el signo +. Ejemplo Venezuela: 58 + número.
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bizEmail" className="text-sm font-bold text-slate-700">Correo Electrónico</Label>
                        <Input
                            id="bizEmail"
                            value={bizForm.email}
                            onChange={e => setBizForm({ ...bizForm, email: e.target.value })}
                            placeholder="contacto@empresa.com"
                            className="h-11 rounded-md"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bizAddr" className="text-sm font-bold text-slate-700">Dirección Fiscal</Label>
                        <Input
                            id="bizAddr"
                            value={bizForm.address}
                            onChange={e => setBizForm({ ...bizForm, address: e.target.value })}
                            placeholder="Av. Principal, Edif. A, Local 1"
                            className="h-11 rounded-md"
                        />
                    </div>
                </CardContent>
            </Card>

            {modules?.services && (
                <Card className="rounded-lg border-slate-200 shadow-sm">
                    <CardHeader className="p-5 pb-3">
                        <CardTitle className="text-xl font-black tracking-normal text-slate-900">Configuración de Créditos</CardTitle>
                        <CardDescription>Valores predeterminados para la calculadora de crédito de celulares</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 pt-0 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="defaultDownPayment" className="text-sm font-bold text-slate-700">% Enganche Predeterminado</Label>
                            <div className="relative">
                                <Input
                                    id="defaultDownPayment"
                                    type="number"
                                    value={bizForm.credit_default_down_payment_pct}
                                    onChange={e => setBizForm({ ...bizForm, credit_default_down_payment_pct: e.target.value })}
                                    placeholder="20"
                                    className="h-11 rounded-md pr-10"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="defaultInterest" className="text-sm font-bold text-slate-700">% Interés Predeterminado</Label>
                            <div className="relative">
                                <Input
                                    id="defaultInterest"
                                    type="number"
                                    value={bizForm.credit_default_interest_rate}
                                    onChange={e => setBizForm({ ...bizForm, credit_default_interest_rate: e.target.value })}
                                    placeholder="10"
                                    className="h-11 rounded-md pr-10"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="sticky bottom-4 z-10 flex justify-end pt-2">
                <Button onClick={handleBizSave} size="lg" className="rounded-md bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700">
                    <Save className="mr-2 h-4 w-4" /> Guardar Cambios
                </Button>
            </div>
        </div>
    );
};

export default GeneralTab;
