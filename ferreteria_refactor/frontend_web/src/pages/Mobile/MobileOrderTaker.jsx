import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import restaurantService from '../../services/restaurantService';
import { ChevronLeft, ShoppingCart, Minus, Plus, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';

const MobileOrderTaker = () => {
    const { tableId } = useParams();
    const navigate = useNavigate();

    // Data State
    const [table, setTable] = useState(null);
    const [order, setOrder] = useState(null); // Existing order if any
    const [menu, setMenu] = useState([]);

    // UI State
    const [activeSection, setActiveSection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewCart, setViewCart] = useState(false);

    // Local Cart State (New Items)
    // [{ product_id, name, price, quantity, notes }]
    const [cart, setCart] = useState([]);

    useEffect(() => {
        loadData();
    }, [tableId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Get Table Info (Reuse getTables or similar? No getTableById endpoint yet?)
            // We can find it from the full list or assume we need it
            // Let's assume we can get it from getTables for now or add getTable endpoint.
            // Efficient: getTables().find
            const tables = await restaurantService.getTables();
            const foundTable = tables.find(t => t.id === parseInt(tableId));
            if (!foundTable) {
                toast.error("Mesa no encontrada");
                navigate('/mobile/tables');
                return;
            }
            setTable(foundTable);

            // 2. Get Menu
            const menuData = await restaurantService.getMenuFull();
            if (menuData.sections) {
                setMenu(menuData.sections);
                if (menuData.sections.length > 0) setActiveSection(menuData.sections[0].id);
            }

            // 3. Get Current Order if occupied
            if (foundTable.status === 'OCCUPIED') {
                const orderData = await restaurantService.getCurrentOrder(foundTable.id);
                setOrder(orderData);
            }

        } catch (error) {
            console.error(error);
            toast.error("Error cargando datos");
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(i => i.product_id === product.product_id);
            if (existing) {
                return prev.map(i => i.product_id === product.product_id
                    ? { ...i, quantity: i.quantity + 1 }
                    : i
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        toast.success(`+1 ${product.alias || product.product_name}`, { duration: 1000, position: 'bottom-center' });
    };

    const updateCartQty = (productId, delta) => {
        setCart(prev => {
            return prev.map(i => {
                if (i.product_id === productId) {
                    return { ...i, quantity: Math.max(0, i.quantity + delta) };
                }
                return i;
            }).filter(i => i.quantity > 0);
        });
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const handleSendOrder = async () => {
        if (cart.length === 0) return;

        try {
            let currentOrderId = order?.id;

            // 1. If Available, Open Table
            if (table.status === 'AVAILABLE') {
                await restaurantService.openTable(table.id);
                // Need to fetch the new order ID. Usually openTable doesn't return ID.
                // We fetch current order immediately
                const newOrder = await restaurantService.getCurrentOrder(table.id);
                currentOrderId = newOrder.id;
            }

            // 2. Add Items
            const itemsPayload = cart.map(i => ({
                product_id: i.product_id,
                quantity: i.quantity,
                notes: i.notes || ''
            }));

            await restaurantService.addItemsToOrder(currentOrderId, itemsPayload);

            toast.success("Pedido enviado a cocina");
            setCart([]);
            setViewCart(false);

            // Refresh logic: go back to tables or stay?
            // Usually stay or go back. Let's go back for flow.
            navigate('/mobile/tables');

        } catch (error) {
            console.error(error);
            toast.error("Error enviando pedido");
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando...</div>;

    if (viewCart) {
        return (
            <div className="bg-white min-h-screen flex flex-col">
                <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                    <h2 className="text-lg font-bold">Confirmar Pedido</h2>
                    <button onClick={() => setViewCart(false)}><X /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {cart.map(item => (
                        <div key={item.product_id} className="flex justify-between items-center py-4 border-b">
                            <div>
                                <div className="font-bold">{item.alias || item.product_name}</div>
                                <div className="text-gray-500">${item.price}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => updateCartQty(item.product_id, -1)} className="p-1 bg-gray-200 rounded"><Minus size={16} /></button>
                                <span className="font-bold w-6 text-center">{item.quantity}</span>
                                <button onClick={() => updateCartQty(item.product_id, 1)} className="p-1 bg-gray-200 rounded"><Plus size={16} /></button>
                            </div>
                        </div>
                    ))}

                    <div className="mt-8 text-right text-xl font-bold">
                        Total: ${cartTotal.toFixed(2)}
                    </div>
                </div>

                <div className="p-4 border-t">
                    <button
                        onClick={handleSendOrder}
                        className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"
                    >
                        <Send size={20} /> Enviar Comanda
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100 pb-20"> {/* pb for fixed footer */}
            {/* Header */}
            <div className="bg-white p-3 shadow-sm flex items-center gap-2 sticky top-0 z-10">
                <button onClick={() => navigate('/mobile/tables')} className="p-2 -ml-2"><ChevronLeft /></button>
                <div>
                    <h1 className="font-bold text-lg">{table?.name}</h1>
                    <p className="text-xs text-gray-500">{order ? `Orden #${order.id}` : 'Nueva Orden'}</p>
                </div>
            </div>

            {/* Categories */}
            <div className="bg-white border-b overflow-x-auto flex gap-4 p-3 sticky top-[60px] z-10 custom-scrollbar">
                {menu.map(section => (
                    <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition ${activeSection === section.id
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        {section.name}
                    </button>
                ))}
            </div>

            {/* Products Grid */}
            <div className="p-3 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                    {menu.find(s => s.id === activeSection)?.items.map(item => (
                        <button
                            key={item.id}
                            onClick={() => addToCart(item)}
                            className="bg-white p-3 rounded-xl shadow border border-gray-100 flex flex-col justify-between text-left h-28 active:scale-95 transition"
                        >
                            <span className="font-bold text-gray-800 line-clamp-2 text-sm">
                                {item.alias || item.product_name}
                            </span>
                            <span className="text-green-600 font-bold self-end">${item.price}</span>
                        </button>
                    ))}
                </div>
                {/* Spacer for footer */}
                <div className="h-20"></div>
            </div>

            {/* Bottom Bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg animate-in slide-in-from-bottom-4 z-20">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500 font-medium">{cartCount} items</span>
                        <span className="text-xl font-bold text-gray-900">${cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={() => setViewCart(true)}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 active:bg-blue-700"
                    >
                        <ShoppingCart size={20} /> Ver Pedido
                    </button>
                </div>
            )}
        </div>
    );
};

export default MobileOrderTaker;
