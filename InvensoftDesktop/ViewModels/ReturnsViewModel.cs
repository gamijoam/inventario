using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Returns;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class ReturnsViewModel : ViewModelBase
{
    private readonly ApiService _api;

    // ── Historial ────────────────────────────────────────────────────────
    [ObservableProperty] private ObservableCollection<ReturnRecord> _returns = new();
    [ObservableProperty] private bool _isLoadingHistory = false;
    [ObservableProperty] private int _totalCount = 0;

    public bool IsHistoryEmpty => !IsLoadingHistory && Returns.Count == 0;

    // ── Búsqueda de venta ─────────────────────────────────────────────
    [ObservableProperty] private string _searchText = "";
    [ObservableProperty] private ObservableCollection<SaleSearchResult> _searchResults = new();
    [ObservableProperty] private bool _isSearching = false;

    // ── Estado ───────────────────────────────────────────────────────────
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _successMessage = "";

    public ReturnsViewModel(ApiService api)
    {
        _api = api;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoadingHistory = true;
        ErrorMessage = "";
        try
        {
            var result = await _api.GetAsync<List<ReturnRecord>>("returns?skip=0&limit=50");
            Returns.Clear();
            if (result != null)
            {
                
                foreach (var r in result) Returns.Add(r);
            }
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch (Exception ex) { ErrorMessage = $"Error: {ex.Message}"; }
        finally
        {
            IsLoadingHistory = false;
            OnPropertyChanged(nameof(IsHistoryEmpty));
        }
    }

    [RelayCommand]
    private async Task SearchSalesAsync()
    {
        if (string.IsNullOrWhiteSpace(SearchText)) return;
        IsSearching = true;
        ErrorMessage = "";
        SearchResults.Clear();
        try
        {
            var result = await _api.GetAsync<SaleSearchResponse>(
                $"returns/sales/search?q={Uri.EscapeDataString(SearchText)}&limit=20");
            if (result != null)
                foreach (var s in result.Items) SearchResults.Add(s);

            if (SearchResults.Count == 0)
                ErrorMessage = "No se encontraron ventas para ese criterio.";
        }
        catch { ErrorMessage = "Error al buscar ventas."; }
        finally { IsSearching = false; }
    }
}
