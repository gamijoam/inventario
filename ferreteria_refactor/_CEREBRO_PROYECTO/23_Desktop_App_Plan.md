# 23 — Plan: InvensoftDesktop (App de Escritorio C# WPF)

**Fecha:** 2026-03-21
**Estado:** 🔜 Futuras Actualizaciones — No iniciado

---

## Concepto

Aplicación de escritorio nativa Windows que consume **la misma API REST** del backend FastAPI.
No es un wrapper web — es una app C# pura con WPF.
Proyecto separado del Bridge (que sigue siendo solo el bridge de impresora).

---

## Stack

| Componente | Tecnología |
|---|---|
| Framework | .NET 8.0 Windows |
| UI | WPF (XAML) |
| Patrón | MVVM |
| MVVM helper | CommunityToolkit.Mvvm |
| DI | Microsoft.Extensions.DependencyInjection |
| HTTP | HttpClient (via DI) |
| JSON | System.Text.Json (built-in .NET 8) |
| Auth storage | Windows Credential Manager |
| Config local | JSON en AppData (igual que el Bridge) |

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

### Fase 1 — MVP (implementar primero)
- [ ] Proyecto WPF + DI setup
- [ ] LoginWindow (server URL + tenant + user/pass)
- [ ] ApiService + AuthService + TokenHandler
- [ ] MainWindow shell (sidebar + navegación)
- [ ] DashboardPage (stats de `/reports/dashboard/financials`)
- [ ] POSPage (búsqueda + carrito + cobro)
- [ ] CashPage (abrir/cerrar caja)
- [ ] ProductsPage (listado + búsqueda)

### Fase 2
- [ ] CustomersPage
- [ ] PurchasesPage
- [ ] InventoryPage (ajustes, Kardex)
- [ ] EmployeesPage
- [ ] ReportsPage completa

### Fase 3
- [ ] Módulo Servicios/Órdenes
- [ ] Cotizaciones
- [ ] Devoluciones
- [ ] Farmacia / Garantías / RMA
- [ ] Integración con Bridge (impresión directa desde el Desktop)

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
