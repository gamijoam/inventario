using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Inventory;
using System.Collections.ObjectModel;
using System.Text.Json.Serialization;

namespace InvensoftDesktop.ViewModels;

public class StockAdjustmentRequest
{
    [JsonPropertyName("product_id")]   public int ProductId { get; set; }
    [JsonPropertyName("warehouse_id")] public int? WarehouseId { get; set; }
    [JsonPropertyName("type")]         public string Type { get; set; } = "ADJUSTMENT_IN";
    [JsonPropertyName("quantity")]     public decimal Quantity { get; set; }
    [JsonPropertyName("reason")]       public string Reason { get; set; } = "";
}

public partial class InventoryViewModel : ViewModelBase
{
    private readonly ApiService _api;

    // ── Kardex ───────────────────────────────────────────────────────────
    [ObservableProperty] private ObservableCollection<KardexEntry> _kardex = new();
    [ObservableProperty] private string _productIdFilter = "";
    [ObservableProperty] private bool _isLoadingKardex = false;
    [ObservableProperty] private int _kardexTotal = 0;
    [ObservableProperty] private int _kardexPage = 1;

    // ── Ajuste ───────────────────────────────────────────────────────────
    [ObservableProperty] private string _adjProductId = "";
    [ObservableProperty] private string _adjQuantity = "";
    [ObservableProperty] private string _adjReason = "";
    [ObservableProperty] private string _adjType = "ADJUSTMENT_IN";
    [ObservableProperty] private bool _isAdjIn = true;
    [ObservableProperty] private bool _isProcessing = false;

    public string AdjInBg  => IsAdjIn ? "#059669" : "#F1F5F9";
    public string AdjInFg  => IsAdjIn ? "White"   : "#64748B";
    public string AdjOutBg => !IsAdjIn ? "#DC2626" : "#F1F5F9";
    public string AdjOutFg => !IsAdjIn ? "White"   : "#64748B";

    // ── Estado ───────────────────────────────────────────────────────────
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _successMessage = "";

    private const int PageSize = 50;
    public bool HasMoreKardex => Kardex.Count < KardexTotal;

    public InventoryViewModel(ApiService api)
    {
        _api = api;
    }

    [RelayCommand]
    public async Task LoadAsync() => await LoadKardexAsync();

    [RelayCommand]
    public async Task LoadKardexAsync()
    {
        KardexPage = 1;
        IsLoadingKardex = true;
        ErrorMessage = "";
        try
        {
            var result = await _api.GetAsync<KardexListResponse>(BuildKardexQuery(1));
            Kardex.Clear();
            if (result != null)
            {
                KardexTotal = result.Total;
                foreach (var k in result.Items) Kardex.Add(k);
            }
            OnPropertyChanged(nameof(HasMoreKardex));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { ErrorMessage = "No se pudo cargar el Kardex."; }
        finally { IsLoadingKardex = false; }
    }

    [RelayCommand]
    public async Task LoadMoreKardexAsync()
    {
        if (!HasMoreKardex || IsLoadingKardex) return;
        IsLoadingKardex = true;
        try
        {
            KardexPage++;
            var result = await _api.GetAsync<KardexListResponse>(BuildKardexQuery(KardexPage));
            if (result != null)
                foreach (var k in result.Items) Kardex.Add(k);
            OnPropertyChanged(nameof(HasMoreKardex));
        }
        finally { IsLoadingKardex = false; }
    }

    [RelayCommand]
    private void SetAdjIn()
    {
        IsAdjIn = true;
        AdjType = "ADJUSTMENT_IN";
        OnPropertyChanged(nameof(AdjInBg));  OnPropertyChanged(nameof(AdjInFg));
        OnPropertyChanged(nameof(AdjOutBg)); OnPropertyChanged(nameof(AdjOutFg));
    }

    [RelayCommand]
    private void SetAdjOut()
    {
        IsAdjIn = false;
        AdjType = "ADJUSTMENT_OUT";
        OnPropertyChanged(nameof(AdjInBg));  OnPropertyChanged(nameof(AdjInFg));
        OnPropertyChanged(nameof(AdjOutBg)); OnPropertyChanged(nameof(AdjOutFg));
    }

    [RelayCommand]
    private async Task ConfirmAdjustmentAsync()
    {
        if (!int.TryParse(AdjProductId, out var productId) || productId <= 0)
        { ErrorMessage = "Ingresa un ID de producto válido."; return; }
        if (!decimal.TryParse(AdjQuantity, out var qty) || qty <= 0)
        { ErrorMessage = "Ingresa una cantidad válida."; return; }

        IsProcessing = true;
        ErrorMessage = "";
        SuccessMessage = "";
        try
        {
            var endpoint = IsAdjIn ? "inventory/add" : "inventory/remove";
            var req = new StockAdjustmentRequest
            {
                ProductId = productId,
                Type      = AdjType,
                Quantity  = qty,
                Reason    = AdjReason
            };
            await _api.PostAsync<StockAdjustmentRequest, object>(endpoint, req);

            SuccessMessage = $"Ajuste registrado: {(IsAdjIn ? "+" : "-")}{qty} unidades (producto #{productId})";
            AdjProductId = "";
            AdjQuantity  = "";
            AdjReason    = "";

            // Refresh kardex
            await LoadKardexAsync();
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { ErrorMessage = "Error al registrar el ajuste."; }
        finally { IsProcessing = false; }
    }

    private string BuildKardexQuery(int page)
    {
        var skip = (page - 1) * PageSize;
        var q = $"inventory/kardex?skip={skip}&limit={PageSize}";
        if (!string.IsNullOrWhiteSpace(ProductIdFilter) && int.TryParse(ProductIdFilter, out var pid))
            q += $"&product_id={pid}";
        return q;
    }
}
