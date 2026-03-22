using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Reports;

namespace InvensoftDesktop.ViewModels;

public partial class DashboardViewModel : ViewModelBase
{
    private readonly ApiService _api;

    [ObservableProperty] private decimal _totalRevenue;
    [ObservableProperty] private int _totalSales;
    [ObservableProperty] private decimal _grossProfit;
    [ObservableProperty] private decimal _totalCost;
    [ObservableProperty] private bool _isLoading = true;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _greeting = "";

    public DashboardViewModel(ApiService api)
    {
        _api = api;
        Greeting = GetGreeting();
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoading = true;
        ErrorMessage = "";
        try
        {
            var stats = await _api.GetAsync<DashboardStats>("reports/dashboard/financials");
            if (stats != null)
            {
                TotalRevenue = stats.TotalRevenue;
                TotalSales = stats.TotalSales;
                GrossProfit = stats.GrossProfit;
                TotalCost = stats.TotalCost;
            }
        }
        catch (UnauthorizedAccessException)
        {
            ErrorMessage = "Sesión expirada. Por favor vuelve a iniciar sesión.";
        }
        catch
        {
            ErrorMessage = "No se pudo cargar el resumen. Verifica la conexión.";
        }
        finally
        {
            IsLoading = false;
        }
    }

    private static string GetGreeting()
    {
        var hour = DateTime.Now.Hour;
        return hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
    }
}
