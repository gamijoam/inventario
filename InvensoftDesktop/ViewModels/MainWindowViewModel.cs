using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;

namespace InvensoftDesktop.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    private readonly DashboardViewModel _dashboardVm;
    private readonly ProductsViewModel _productsVm;
    private readonly CashViewModel _cashVm;
    private readonly POSViewModel _posVm;
    private readonly CustomersViewModel _customersVm;
    private readonly EmployeesViewModel _employeesVm;
    private readonly PurchasesViewModel _purchasesVm;
    private readonly InventoryViewModel _inventoryVm;
    private readonly ReportsViewModel _reportsVm;
    private readonly AuthService _auth;

    [ObservableProperty] private ViewModelBase? _currentPage;
    [ObservableProperty] private string _currentPageTitle = "Dashboard";

    public event Action? LogoutRequested;

    public MainWindowViewModel(
        DashboardViewModel dashboard,
        ProductsViewModel products,
        CashViewModel cash,
        POSViewModel pos,
        CustomersViewModel customers,
        EmployeesViewModel employees,
        PurchasesViewModel purchases,
        InventoryViewModel inventory,
        ReportsViewModel reports,
        AuthService auth)
    {
        _dashboardVm = dashboard;
        _productsVm = products;
        _cashVm = cash;
        _posVm = pos;
        _customersVm = customers;
        _employeesVm = employees;
        _purchasesVm = purchases;
        _inventoryVm = inventory;
        _reportsVm = reports;
        _auth = auth;
        NavigateTo("Dashboard");
    }

    public void NavigateTo(string page)
    {
        CurrentPageTitle = page switch
        {
            "Dashboard" => "Dashboard",
            "POS"       => "Punto de Venta",
            "Products"  => "Productos",
            "Cash"      => "Caja",
            "Customers" => "Clientes",
            "Employees" => "Empleados",
            "Purchases" => "Compras",
            "Inventory" => "Inventario",
            "Reports"   => "Reportes",
            _           => page
        };

        CurrentPage = page switch
        {
            "Dashboard" => (ViewModelBase)_dashboardVm,
            "POS"       => _posVm,
            "Products"  => _productsVm,
            "Cash"      => _cashVm,
            "Customers" => _customersVm,
            "Employees" => _employeesVm,
            "Purchases" => _purchasesVm,
            "Inventory" => _inventoryVm,
            "Reports"   => _reportsVm,
            _           => _dashboardVm
        };

        // Trigger load on navigate
        _ = page switch
        {
            "Dashboard" => _dashboardVm.LoadAsync(),
            "Products"  => _productsVm.LoadAsync(),
            "Cash"      => _cashVm.LoadAsync(),
            "Customers" => _customersVm.LoadAsync(),
            "Employees" => _employeesVm.LoadAsync(),
            "Purchases" => _purchasesVm.LoadAsync(),
            "Inventory" => _inventoryVm.LoadAsync(),
            "Reports"   => _reportsVm.LoadAsync(),
            _           => Task.CompletedTask
        };
    }

    [RelayCommand] private void GoToDashboard() => NavigateTo("Dashboard");
    [RelayCommand] private void GoToPOS()        => NavigateTo("POS");
    [RelayCommand] private void GoToProducts()   => NavigateTo("Products");
    [RelayCommand] private void GoToCash()       => NavigateTo("Cash");
    [RelayCommand] private void GoToCustomers()  => NavigateTo("Customers");
    [RelayCommand] private void GoToEmployees()  => NavigateTo("Employees");
    [RelayCommand] private void GoToPurchases()  => NavigateTo("Purchases");
    [RelayCommand] private void GoToInventory()  => NavigateTo("Inventory");
    [RelayCommand] private void GoToReports()    => NavigateTo("Reports");

    [RelayCommand]
    private void Logout()
    {
        _auth.Logout();
        LogoutRequested?.Invoke();
    }
}
