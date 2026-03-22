using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Products;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class ProductsViewModel : ViewModelBase
{
    private readonly ApiService _api;

    [ObservableProperty] private ObservableCollection<Product> _products = new();
    [ObservableProperty] private string _searchText = "";
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private int _totalCount = 0;
    [ObservableProperty] private int _currentPage = 1;

    private const int PageSize = 40;
    private string _lastSearch = "";

    public bool HasMore => Products.Count < TotalCount;

    public ProductsViewModel(ApiService api)
    {
        _api = api;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        _lastSearch = SearchText;
        CurrentPage = 1;
        IsLoading = true;
        ErrorMessage = "";

        try
        {
            var query = BuildQuery(1);
            var result = await _api.GetAsync<ProductListResponse>(query);
            Products.Clear();
            if (result != null)
            {
                TotalCount = result.Total;
                foreach (var p in result.Items) Products.Add(p);
            }
        }
        catch (UnauthorizedAccessException)
        {
            ErrorMessage = "Sesión expirada.";
        }
        catch
        {
            ErrorMessage = "No se pudo cargar los productos.";
        }
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
            var result = await _api.GetAsync<ProductListResponse>(BuildQuery(CurrentPage));
            if (result != null)
                foreach (var p in result.Items) Products.Add(p);
        }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task SearchAsync()
    {
        await LoadAsync();
    }

    private string BuildQuery(int page)
    {
        var skip = (page - 1) * PageSize;
        var q = $"products/catalog?skip={skip}&limit={PageSize}";
        if (!string.IsNullOrWhiteSpace(SearchText))
            q += $"&search={Uri.EscapeDataString(SearchText)}";
        return q;
    }
}
