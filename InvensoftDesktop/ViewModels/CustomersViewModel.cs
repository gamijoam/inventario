using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Customers;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class CustomersViewModel : ViewModelBase
{
    private readonly ApiService _api;

    [ObservableProperty] private ObservableCollection<Customer> _customers = new();
    [ObservableProperty] private string _searchText = "";
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private int _totalCount = 0;
    [ObservableProperty] private int _currentPage = 1;

    private const int PageSize = 40;

    public bool HasMore => Customers.Count < TotalCount;

    public CustomersViewModel(ApiService api)
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
            var result = await _api.GetAsync<CustomerListResponse>(BuildQuery(1));
            Customers.Clear();
            if (result != null)
            {
                TotalCount = result.Total;
                foreach (var c in result.Items) Customers.Add(c);
            }
            OnPropertyChanged(nameof(HasMore));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { ErrorMessage = "No se pudo cargar los clientes."; }
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
            var result = await _api.GetAsync<CustomerListResponse>(BuildQuery(CurrentPage));
            if (result != null)
                foreach (var c in result.Items) Customers.Add(c);
            OnPropertyChanged(nameof(HasMore));
        }
        finally { IsLoading = false; }
    }

    [RelayCommand] private async Task SearchAsync() => await LoadAsync();

    private string BuildQuery(int page)
    {
        var skip = (page - 1) * PageSize;
        var q = $"customers/?skip={skip}&limit={PageSize}";
        if (!string.IsNullOrWhiteSpace(SearchText))
            q += $"&search={Uri.EscapeDataString(SearchText)}";
        return q;
    }
}
