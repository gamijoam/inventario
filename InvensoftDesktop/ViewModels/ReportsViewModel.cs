using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Reports;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class ReportsViewModel : ViewModelBase
{
    private readonly ApiService _api;

    [ObservableProperty] private DashboardStats? _stats;
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _startDate = DateTime.Today.ToString("yyyy-MM-dd");
    [ObservableProperty] private string _endDate   = DateTime.Today.ToString("yyyy-MM-dd");

    // Colección observable para la tabla de ventas por moneda
    [ObservableProperty] private ObservableCollection<CurrencyStat> _salesByCurrency = new();

    // Propiedades de métricas principales
    public decimal Revenue    => Stats?.TotalRevenue  ?? 0;
    public int     Sales      => Stats?.TotalSales    ?? 0;
    public decimal Cost       => Stats?.TotalCost     ?? 0;
    public decimal Profit     => Stats?.GrossProfit   ?? 0;
    public decimal RevenueBs  => Stats?.TotalRevenueBs ?? 0;

    // Control de visibilidad de secciones
    public bool HasData       => Stats?.HasData ?? false;
    public bool HasNoData     => Stats != null && !HasData;

    public ReportsViewModel(ApiService api)
    {
        _api = api;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoading = true;
        ErrorMessage = "";
        try
        {
            var q = $"reports/dashboard/financials?start_date={StartDate}&end_date={EndDate}";
            Stats = await _api.GetAsync<DashboardStats>(q);

            // Actualizar colección observable de monedas
            SalesByCurrency.Clear();
            if (Stats?.SalesByCurrency != null)
                foreach (var s in Stats.SalesByCurrency)
                    SalesByCurrency.Add(s);

            // Notificar todas las propiedades derivadas
            OnPropertyChanged(nameof(Revenue));
            OnPropertyChanged(nameof(Sales));
            OnPropertyChanged(nameof(Cost));
            OnPropertyChanged(nameof(Profit));
            OnPropertyChanged(nameof(RevenueBs));
            OnPropertyChanged(nameof(HasData));
            OnPropertyChanged(nameof(HasNoData));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch (Exception ex) { ErrorMessage = $"Error: {ex.Message}"; }
        finally { IsLoading = false; }
    }

    [RelayCommand] private async Task RefreshAsync() => await LoadAsync();
}
