using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Purchases;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class PurchasesViewModel : ViewModelBase
{
    private readonly ApiService _api;

    [ObservableProperty] private ObservableCollection<PurchaseOrder> _purchases = new();
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private int _totalCount = 0;
    [ObservableProperty] private int _currentPage = 1;
    // Filter: "" = all, "PENDING" = pendientes, "PAID" = pagadas
    [ObservableProperty] private string _statusFilter = "";

    private const int PageSize = 40;
    public bool HasMore => Purchases.Count < TotalCount;

    public PurchasesViewModel(ApiService api)
    {
        _api = api;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        CurrentPage = 1;
        IsLoading = true;
        ErrorMessage = "";
        try
        {
            var result = await _api.GetAsync<PurchaseListResponse>(BuildQuery(1));
            Purchases.Clear();
            if (result != null)
            {
                TotalCount = result.Total;
                foreach (var p in result.Items) Purchases.Add(p);
            }
            OnPropertyChanged(nameof(HasMore));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { ErrorMessage = "No se pudo cargar las compras."; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task LoadMoreAsync()
    {
        if (!HasMore || IsLoading) return;
        IsLoading = true;
        try
        {
            CurrentPage++;
            var result = await _api.GetAsync<PurchaseListResponse>(BuildQuery(CurrentPage));
            if (result != null)
                foreach (var p in result.Items) Purchases.Add(p);
            OnPropertyChanged(nameof(HasMore));
        }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task FilterAllAsync()     { StatusFilter = "";        await LoadAsync(); }
    [RelayCommand]
    private async Task FilterPendingAsync() { StatusFilter = "PENDING";  await LoadAsync(); }
    [RelayCommand]
    private async Task FilterPaidAsync()    { StatusFilter = "PAID";     await LoadAsync(); }

    private string BuildQuery(int page)
    {
        var skip = (page - 1) * PageSize;
        var q = $"purchases/?skip={skip}&limit={PageSize}";
        if (!string.IsNullOrWhiteSpace(StatusFilter))
            q += $"&status={StatusFilter}";
        return q;
    }
}
