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
    private readonly AuthService _auth;

    [ObservableProperty] private ViewModelBase? _currentPage;
    [ObservableProperty] private string _currentPageTitle = "Dashboard";

    public event Action? LogoutRequested;

    public MainWindowViewModel(
        DashboardViewModel dashboard,
        ProductsViewModel products,
        CashViewModel cash,
        POSViewModel pos,
        AuthService auth)
    {
        _dashboardVm = dashboard;
        _productsVm = products;
        _cashVm = cash;
        _posVm = pos;
        _auth = auth;
        NavigateTo("Dashboard");
    }

    public void NavigateTo(string page)
    {
        CurrentPageTitle = page switch
        {
            "Dashboard"  => "Dashboard",
            "POS"        => "Punto de Venta",
            "Products"   => "Productos",
            "Cash"       => "Caja",
            _            => page
        };

        CurrentPage = page switch
        {
            "Dashboard" => _dashboardVm,
            "POS"       => _posVm,
            "Products"  => _productsVm,
            "Cash"      => _cashVm,
            _           => _dashboardVm
        };

        // Trigger load on navigate
        _ = page switch
        {
            "Dashboard" => _dashboardVm.LoadAsync(),
            "Products"  => _productsVm.LoadAsync(),
            "Cash"      => _cashVm.LoadAsync(),
            _           => Task.CompletedTask
        };
    }

    [RelayCommand] private void GoToDashboard() => NavigateTo("Dashboard");
    [RelayCommand] private void GoToPOS()        => NavigateTo("POS");
    [RelayCommand] private void GoToProducts()   => NavigateTo("Products");
    [RelayCommand] private void GoToCash()       => NavigateTo("Cash");

    [RelayCommand]
    private void Logout()
    {
        _auth.Logout();
        LogoutRequested?.Invoke();
    }
}
