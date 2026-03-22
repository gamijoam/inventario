using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Reports;

namespace InvensoftDesktop.ViewModels;

public partial class ReportsViewModel : ViewModelBase
{
    private readonly ApiService _api;

    [ObservableProperty] private DashboardStats? _stats;
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _startDate = DateTime.Today.ToString("yyyy-MM-dd");
    [ObservableProperty] private string _endDate   = DateTime.Today.ToString("yyyy-MM-dd");

    public decimal Revenue => Stats?.TotalRevenue  ?? 0;
    public int     Sales   => Stats?.TotalSales    ?? 0;
    public decimal Cost    => Stats?.TotalCost     ?? 0;
    public decimal Profit  => Stats?.GrossProfit   ?? 0;
    public decimal RevenueBs => Stats?.TotalRevenueBs ?? 0;

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
            OnPropertyChanged(nameof(Revenue));
            OnPropertyChanged(nameof(Sales));
            OnPropertyChanged(nameof(Cost));
            OnPropertyChanged(nameof(Profit));
            OnPropertyChanged(nameof(RevenueBs));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch (Exception ex) { ErrorMessage = $"Error: {ex.Message}"; }
        finally { IsLoading = false; }
    }

    [RelayCommand] private async Task RefreshAsync() => await LoadAsync();
}
