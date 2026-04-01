/**
 * CotizacionesTab — usa el mismo QuoteList mejorado del módulo /quotes
 * para evitar duplicación de código.
 */
import React from 'react';
import QuoteList from '../../Quotes/QuoteList';

const CotizacionesTab = ({ onCreateNew, onEdit }) => (
    <QuoteList onCreateNew={onCreateNew} onEdit={onEdit} />
);

export default CotizacionesTab;
