import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';

const ImpuestosTab = () => {
    const [defaultTaxRate, setDefaultTaxRate] = useState('');
    const [isSavingTax, setIsSavingTax] = useState(false);

    useEffect(() => {
        fetchDefaultTaxRate();
    }, []);

    const fetchDefaultTaxRate = async () => {
        try {
            const response = await apiClient.get('/config/tax-rate/default');
            setDefaultTaxRate(response.data.rate);
        } catch (error) {
            console.error('Error fetching tax rate:', error);
        }
    };

    const handleSaveTaxRate = async () => {
        setIsSavingTax(true);
        try {
            await apiClient.put('/config/tax-rate/default', { rate: parseFloat(defaultTaxRate) });
            toast.success("Impuesto por defecto actualizado");
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar impuesto");
        } finally {
            setIsSavingTax(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Configuración de Impuestos</CardTitle>
                    <CardDescription>Define el IVA por defecto para nuevos productos</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-w-xs">
                        <Label>Impuesto General (%)</Label>
                        <div className="flex gap-2 mt-2">
                            <Input
                                type="number"
                                value={defaultTaxRate}
                                onChange={e => setDefaultTaxRate(e.target.value)}
                                placeholder="16.00"
                            />
                            <Button onClick={handleSaveTaxRate} disabled={isSavingTax}>
                                {isSavingTax ? <Loader2 className="animate-spin" /> : <Save size={16} />}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ImpuestosTab;
