# 23 — Plan: InvensoftDesktop (App de Escritorio — Avalonia UI)

**Fecha:** 2026-03-22
**Estado:** 🚀 En Desarrollo — Rama: `feature/desktop-app`

---

## Concepto

Aplicación de escritorio **multiplataforma** (Ubuntu dev → Windows deploy) que consume
la misma API REST del backend FastAPI. C# puro con Avalonia UI.

**Por qué Avalonia y no WPF:**
- WPF solo compila/ejecuta en Windows — no se puede desarrollar en Ubuntu
- Avalonia UI es XAML casi idéntico a WPF, mismo MVVM, pero corre en Linux, Windows y macOS
- Se desarrolla y prueba en Ubuntu directamente
- `dotnet publish -r win-x64 --self-contained` genera `.exe` para clientes Windows

Proyecto separado del Bridge (que sigue siendo solo el bridge de impresora).

---

## Stack

| Componente | Tecnología |
|---|---|
| Framework | .NET 8.0 (multiplataforma) |
| UI | Avalonia UI 11 (XAML cross-platform) |
| Patrón | MVVM |
| MVVM helper | CommunityToolkit.Mvvm |
| DI | Microsoft.Extensions.DependencyInjection |
| HTTP | HttpClient (via DI) |
| JSON | System.Text.Json (built-in .NET 8) |
| Auth storage | Archivo JSON cifrado en AppData |
| Config local | JSON en AppData |

---

## Estructura de Carpetas

```
InvensoftDesktop/
├── App.xaml                      ← Entry point, DI setup
├── App.xaml.cs
├── InvensoftDesktop.csproj
│
├── Core/
│   ├── ApiService.cs             ← HttpClient wrapper genérico
│   ├── AuthService.cs            ← Login, token, tenant
│   ├── NavigationService.cs      ← Cambio de vistas
│   └── SettingsManager.cs        ← Config local (serverUrl, tenant)
│
├── Models/                       ← DTOs que reflejan el backend
│   ├── Auth/
│   │   └── TokenResponse.cs
│   ├── Products/
│   │   ├── Product.cs
│   │   └── ProductLookupResult.cs
│   ├── Sales/
│   │   ├── CartItem.cs
│   │   └── SaleRequest.cs
│   ├── Cash/
│   │   └── CashSession.cs
│   ├── Reports/
│   │   └── DashboardStats.cs
│   └── Config/
│       └── AppConfig.cs          ← Modelo de config local
│
├── ViewModels/
│   ├── Base/
│   │   └── ViewModelBase.cs      ← ObservableObject + helpers
│   ├── LoginViewModel.cs
│   ├── MainViewModel.cs          ← Shell + navegación
│   ├── DashboardViewModel.cs
│   ├── POSViewModel.cs           ← Lógica del punto de venta
│   ├── ProductsViewModel.cs
│   ├── CashViewModel.cs
│   └── ReportsViewModel.cs
│
├── Views/
│   ├── LoginWindow.xaml
│   ├── MainWindow.xaml           ← Shell: sidebar + ContentArea
│   └── Pages/
│       ├── DashboardPage.xaml
│       ├── POSPage.xaml
│       ├── ProductsPage.xaml
│       ├── CashPage.xaml
│       └── ReportsPage.xaml
│
├── Controls/                     ← Controles reutilizables
│   ├── CartItemControl.xaml
│   ├── NumericInput.xaml
│   └── LoadingOverlay.xaml
│
└── Helpers/
    ├── Converters.cs             ← BoolToVisibility, etc.
    └── RelayCommand.cs           ← ICommand wrapper (si no usa CommunityToolkit)
```

---

## NuGet Packages

```xml
<PackageReference Include="CommunityToolkit.Mvvm" Version="8.*" />
<PackageReference Include="Microsoft.Extensions.DependencyInjection" Version="8.*" />
<PackageReference Include="Microsoft.Extensions.Http" Version="8.*" />
<PackageReference Include="AdysTech.CredentialManager" Version="1.*" />
```

> `System.Text.Json` viene incluido en .NET 8, no necesita NuGet.

---

## Autenticación

```
POST /auth/token
Headers: x-tenant-id: {tenant_slug}
Body (form): username={user}&password={pass}

Response: { "access_token": "...", "tenant_slug": "..." }
```

Todas las requests subsecuentes llevan:
```
Authorization: Bearer {token}
x-tenant-id: {tenant_slug}
```

El token y el tenant_slug se guardan en **Windows Credential Manager** (no en disco plano).
La URL del servidor y el tenant_slug también se guardan en `AppData/Roaming/Invensoft/desktop_config.json`.

---

## Patrón ApiService

```csharp
public class ApiService
{
    private readonly HttpClient _http;
    private readonly AuthService _auth;

    public async Task<T> GetAsync<T>(string endpoint)
    public async Task<TRes> PostAsync<TReq, TRes>(string endpoint, TReq body)
    public async Task<TRes> PutAsync<TReq, TRes>(string endpoint, TReq body)
    public async Task DeleteAsync(string endpoint)
}
```

El `HttpClient` se configura en DI con un `DelegatingHandler` que inyecta automáticamente:
- `Authorization: Bearer {token}`
- `x-tenant-id: {tenant}`

---

## Navegación

`MainWindow` tiene:
- Sidebar izquierdo fijo con botones de módulos
- `ContentControl` central que muestra `UserControl` según la vista activa
- `NavigationService` expone `NavigateTo(string pageName)` que swapea el DataContext

```csharp
NavigationService.NavigateTo("POS");      // → POSPage
NavigationService.NavigateTo("Products"); // → ProductsPage
```

---

## POS — Flujo

1. Campo de búsqueda → `GET /products/lookup?q={barcode_o_nombre}`
2. Resultado → agregar a `ObservableCollection<CartItem>` local
3. Totales calculados localmente (precio × cantidad)
4. Botón Cobrar → modal de pago → `POST /products/sales/` con payload:
   ```json
   {
     "total_amount": 25.00,
     "payment_method": "Efectivo",
     "payments": [{ "amount": 25.00, "currency": "USD", "payment_method": "Efectivo" }],
     "items": [{ "product_id": 1, "quantity": 2, "unit_price": 12.50, "subtotal": 25.00 }],
     "session_id": 5,
     "warehouse_id": 1
   }
   ```
5. Éxito → limpiar carrito + mostrar confirmación

---

## Fases de Implementación

### Fase 1 — MVP
- [x] Proyecto Avalonia + DI setup (.NET 8, CommunityToolkit.Mvvm)
- [x] LoginWindow — selector Cloud/Local, campos condicionales
- [x] ApiService + AuthService (JWT, x-tenant-id header automático)
- [x] SettingsManager (persist en AppData)
- [x] BackendLauncher — levanta invensoft_api.exe en local, espera respuesta
- [x] MainWindow shell (sidebar oscuro + ContentControl navegación)
- [x] DashboardPage (4 tarjetas: ventas, ingresos, costo, ganancia)
- [x] Modelo híbrido Cloud/Local con build scripts (PyInstaller + Inno Setup)
- [x] ProductsPage (listado + búsqueda + paginación)
- [x] CashPage (abrir/cerrar sesión de caja)
- [x] POSPage (búsqueda por código/nombre, carrito, cobro)

### Fase 2
- [x] CustomersPage (lista + búsqueda + paginación, estado, crédito)
- [x] PurchasesPage (filtros por estado, monto pendiente)
- [x] InventoryPage (ajuste entrada/salida + Kardex con filtro)
- [x] EmployeesPage (lista, status, % comisión)
- [x] ReportsPage (rango fechas + 5 tarjetas: ventas, USD, Bs, costo, ganancia)

### Fase 3
- [ ] Módulo Servicios/Órdenes
- [ ] Cotizaciones
- [ ] Devoluciones
- [ ] Farmacia / Garantías / RMA
- [ ] Integración con Bridge (impresión directa desde el Desktop)

### Modelo de Distribución (definido 2026-03-22)
- **Edición Cloud:** conecta a `api.miinventariofacil.com`, suscripción mensual
- **Edición Local:** backend PyInstaller + PostgreSQL en PC del cliente, licencia única
- Build: `InvensoftDesktop/build/build_local_edition.sh`
- Instalador Windows: `InvensoftDesktop/build/installer.iss` (Inno Setup)

---

## Comunicación con el Bridge (Fase 3)

El Bridge ya corre como tray app. Para imprimir desde el Desktop:
- Opción A: El Desktop llama al mismo endpoint `/config/test-print` del backend → el Bridge ya escucha eso por WebSocket.
- Opción B: Pipe local / Named Pipe entre los dos procesos Windows.

---

## Consideraciones

- **Sin internet:** Mostrar pantalla de error claro con botón de reintentar. POS offline NO está en scope inicial.
- **Multi-tenant:** El tenant slug es configurable en la pantalla de login y se guarda en config local. Un usuario puede cambiar de tenant en Settings.
- **Tasas de cambio:** Cargar al iniciar desde `/config/exchange-rates`. Cachear en memoria por sesión.
- **Token expirado:** Interceptor en HttpClient detecta 401 → redirige a Login.
