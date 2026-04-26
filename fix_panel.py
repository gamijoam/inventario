import re

with open('ferreteria_refactor/frontend_web/src/pages/Restaurant/components/OrderPanel.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "{(table.status === 'OCCUPIED' || order) && ("
start_idx = content.find(start_marker)

part1_start = content.find("{/* Menu & Search Area */}")
part2_start = content.find("{/* Current Order List */}")
part3_start = content.find("{/* Footer */}")

menu_search_area = content[part1_start:part2_start]
# We need to drop the trailing </div> from part 2 because it belongs to the old container
current_order_list = content[part2_start:part3_start].rsplit('</div>', 1)[0].rstrip()

new_block = """{(table.status === 'OCCUPIED' || order) && (
                        <div className={`flex flex-col h-full overflow-hidden ${isAddingProducts ? 'xl:flex-row' : ''}`}>
                            
                            {/* LEFT SIDE: MENU (Only visible when adding products) */}
                            {isAddingProducts && (
                                <div className="flex-[2] flex flex-col h-full border-r border-slate-200 bg-slate-50/50 overflow-hidden">
                                    <div className="p-4 flex justify-between items-center bg-white border-b border-slate-200">
                                        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                            <UtensilsCrossed size={20} className="text-indigo-600"/> Menú
                                        </h3>
                                        <button onClick={() => onToggleAddProducts(false)} className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-500">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
""" + menu_search_area + """
                                    </div>
                                </div>
                            )}

                            {/* RIGHT SIDE: CURRENT ORDER LIST */}
                            <div className="flex-1 flex flex-col h-full bg-white relative">
                                {!isAddingProducts && (
                                    <div className="px-4 pt-4 pb-2">
                                        <button
                                            onClick={() => onToggleAddProducts(true)}
                                            className="w-full py-3.5 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-600 font-black hover:bg-indigo-50 hover:border-indigo-300 transition flex items-center justify-center gap-2"
                                        >
                                            <Plus size={20} /> Agregar Productos
                                        </button>
                                    </div>
                                )}
""" + current_order_list + """
                            </div>
                        </div>
                    )}

                """

new_content = content[:start_idx] + new_block + content[part3_start:]

with open('ferreteria_refactor/frontend_web/src/pages/Restaurant/components/OrderPanel.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
