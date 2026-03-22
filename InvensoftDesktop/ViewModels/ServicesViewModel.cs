using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Services;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class ServicesViewModel : ViewModelBase
{
    private readonly ApiService _api;
    private readonly PrintService _print;

    [ObservableProperty] private ObservableCollection<ServiceOrder> _orders = new();
    [ObservableProperty] private string _statusFilter = "";
    [ObservableProperty] private string _searchText = "";
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _successMessage = "";
    [ObservableProperty] private int _totalCount = 0;
    [ObservableProperty] private int _currentPage = 1;

    private const int PageSize = 40;
    public bool HasMore => Orders.Count < TotalCount;

    public ServicesViewModel(ApiService api, PrintService print)
    {
        _api = api;
        _print = print;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        CurrentPage = 1;
        IsLoading = true;
        ErrorMessage = "";
        try
        {
            var result = await _api.GetAsync<ServiceOrderListResponse>(BuildQuery(1));
            Orders.Clear();
            if (result != null)
            {
                TotalCount = result.Total;
                foreach (var o in result.Items) Orders.Add(o);
            }
            OnPropertyChanged(nameof(HasMore));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { ErrorMessage = "No se pudieron cargar las órdenes."; }
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
            var result = await _api.GetAsync<ServiceOrderListResponse>(BuildQuery(CurrentPage));
            if (result != null)
                foreach (var o in result.Items) Orders.Add(o);
            OnPropertyChanged(nameof(HasMore));
        }
        finally { IsLoading = false; }
    }

    [RelayCommand] private async Task FilterAllAsync()        { StatusFilter = "";           await LoadAsync(); }
    [RelayCommand] private async Task FilterReceivedAsync()   { StatusFilter = "RECEIVED";   await LoadAsync(); }
    [RelayCommand] private async Task FilterInProgressAsync() { StatusFilter = "IN_PROGRESS";await LoadAsync(); }
    [RelayCommand] private async Task FilterReadyAsync()      { StatusFilter = "READY";      await LoadAsync(); }
    [RelayCommand] private async Task SearchAsync()           { await LoadAsync(); }

    [RelayCommand]
    private async Task PrintOrderAsync(ServiceOrder order)
    {
        SuccessMessage = "";
        ErrorMessage = "";
        var (ok, err) = await _print.PrintServiceOrderAsync(order.Id);
        if (ok) SuccessMessage = $"Ticket #{order.TicketNumber} enviado a imprimir.";
        else    ErrorMessage = err;
    }

    [RelayCommand]
    private async Task MarkReadyAsync(ServiceOrder order)
    {
        ErrorMessage = "";
        SuccessMessage = "";
        try
        {
            var req = new UpdateStatusRequest { Status = "READY" };
            await _api.PostAsync<UpdateStatusRequest, object>($"services/orders/{order.Id}/status", req);
            SuccessMessage = $"Orden #{order.TicketNumber} marcada como Lista.";
            await LoadAsync();
        }
        catch { ErrorMessage = "No se pudo actualizar el estado."; }
    }

    private string BuildQuery(int page)
    {
        var skip = (page - 1) * PageSize;
        var q = $"services/orders?skip={skip}&limit={PageSize}";
        if (!string.IsNullOrWhiteSpace(StatusFilter))
            q += $"&status={StatusFilter}";
        if (!string.IsNullOrWhiteSpace(SearchText))
            q += $"&search={Uri.EscapeDataString(SearchText)}";
        return q;
    }
}
