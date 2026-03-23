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
    [ObservableProperty] private string _statusFilter = "";

    // Visibilidad del estado vacío
    public bool HasPurchases => Purchases.Count > 0;
    public bool IsEmpty      => !IsLoading && Purchases.Count == 0 && string.IsNullOrEmpty(ErrorMessage);

    public PurchasesViewModel(ApiService api) { _api = api; }

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoading = true;
        ErrorMessage = "";
        try
        {
            // GET /api/v1/purchases/?status=... → List<PurchaseOrderResponse> (lista plana)
            var q = "purchases";
            if (!string.IsNullOrWhiteSpace(StatusFilter))
                q += $"?status={StatusFilter}";

            var result = await _api.GetAsync<List<PurchaseOrder>>(q);
            Purchases.Clear();
            if (result != null)
                foreach (var p in result) Purchases.Add(p);
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch (Exception ex) { ErrorMessage = $"Error: {ex.Message}"; }
        finally
        {
            IsLoading = false;
            OnPropertyChanged(nameof(HasPurchases));
            OnPropertyChanged(nameof(IsEmpty));
        }
    }

    [RelayCommand] private async Task FilterAllAsync()
    {
        StatusFilter = "";
        await LoadAsync();
    }

    [RelayCommand] private async Task FilterPendingAsync()
    {
        StatusFilter = "PENDING";
        await LoadAsync();
    }

    [RelayCommand] private async Task FilterPaidAsync()
    {
        StatusFilter = "PAID";
        await LoadAsync();
    }
}
