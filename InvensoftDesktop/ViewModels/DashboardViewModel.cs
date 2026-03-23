using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Reports;
using System.Collections.ObjectModel;

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
    [ObservableProperty] private bool _hasData = false;
    [ObservableProperty] private ObservableCollection<CurrencyStat> _salesByCurrency = new();

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
        HasData = false;
        try
        {
            var stats = await _api.GetAsync<DashboardStats>("reports/dashboard/financials");
            if (stats != null)
            {
                TotalRevenue = stats.TotalRevenue;
                TotalSales = stats.TotalSales;
                GrossProfit = stats.GrossProfit;
                TotalCost = stats.TotalCost;

                SalesByCurrency.Clear();
                foreach (var c in stats.SalesByCurrency)
                    SalesByCurrency.Add(c);

                HasData = TotalSales > 0 || TotalRevenue > 0;
            }
            else
            {
                HasData = false;
            }
        }
        catch (UnauthorizedAccessException)
        {
            ErrorMessage = "Sesion expirada. Por favor vuelve a iniciar sesion.";
        }
        catch
        {
            ErrorMessage = "No se pudo cargar el resumen. Verifica la conexion.";
        }
        finally
        {
            IsLoading = false;
        }
    }

    private static string GetGreeting()
    {
        var hour = DateTime.Now.Hour;
        return hour < 12 ? "Buenos dias" : hour < 18 ? "Buenas tardes" : "Buenas noches";
    }
}
