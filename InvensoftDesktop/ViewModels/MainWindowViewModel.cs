using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;

namespace InvensoftDesktop.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    private readonly DashboardViewModel _dashboardVm;
    private readonly AuthService _auth;

    [ObservableProperty] private ViewModelBase? _currentPage;
    [ObservableProperty] private string _currentPageTitle = "Dashboard";
    [ObservableProperty] private bool _isDashboardActive = true;

    public event Action? LogoutRequested;

    public MainWindowViewModel(DashboardViewModel dashboard, AuthService auth)
    {
        _dashboardVm = dashboard;
        _auth = auth;
        NavigateTo("Dashboard");
    }

    public void NavigateTo(string page)
    {
        IsDashboardActive = page == "Dashboard";
        CurrentPageTitle = page;

        CurrentPage = page switch
        {
            "Dashboard" => _dashboardVm,
            _ => _dashboardVm
        };

        if (page == "Dashboard")
            _ = _dashboardVm.LoadAsync();
    }

    [RelayCommand]
    private void GoToDashboard() => NavigateTo("Dashboard");

    [RelayCommand]
    private void Logout()
    {
        _auth.Logout();
        LogoutRequested?.Invoke();
    }
}
